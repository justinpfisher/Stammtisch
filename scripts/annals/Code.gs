/* Stammtisch Annals — dedicated Gmail / Apps Script private intake.
 *
 * NOT CONNECTED OR ACTIVE. No triggers, external API calls, public GitHub
 * writes, acknowledgements or model calls are installed by this source file.
 *
 * Copy PilotCore.js and this file into a NEW Google Apps Script project
 * attached to a dedicated club submissions account, only after owner approval.
 * Explicit setup is documented in docs/annals-pilot-runbook.md.
 *
 * Two separate script property gates are required for actual mailbox reads:
 *   ANNALS_INTAKE_ENABLED=true
 *   ANNALS_ALLOW_PRODUCTION_MAIL=true
 *   ANNALS_PRIVATE_FOLDER_ID=<private Drive folder ID>
 *   ANNALS_ALLOWED_SENDERS=<comma separated dedicated member addresses>
 * The source is public CODE ONLY; never add real addresses or folder IDs here.
 */

/** No side effects when intake is disabled. */
function annalsPilotPreflight() {
  var properties = PropertiesService.getScriptProperties();
  var enabled = properties.getProperty('ANNALS_INTAKE_ENABLED') === 'true' &&
    properties.getProperty('ANNALS_ALLOW_PRODUCTION_MAIL') === 'true';
  return {
    enabled: enabled,
    hasPrivateFolder: !!properties.getProperty('ANNALS_PRIVATE_FOLDER_ID'),
    trustedSenderCount: AnnalsPilot.allowedSenders(
      properties.getProperty('ANNALS_ALLOWED_SENDERS') || ''
    ).length,
    publishesAnything: false,
    usesPaidAI: false
  };
}

function annalsSha256_(value) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value));
  return digest.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

/** Message storage is private and idempotent. Never stage in public GitHub. */
function annalsStageMessage_(rootFolder, message, properties, allowedAddresses) {
  var sender = AnnalsPilot.senderAddress(message.getFrom());
  if (!sender || allowedAddresses.indexOf(sender) < 0) return 'untrusted';
  var id = String(message.getId());
  var sourceId = annalsSha256_(id);
  var processedKey = 'annals.msg.' + sourceId;
  if (properties.getProperty(processedKey) === 'staged') return 'duplicate';

  var attachments = message.getAttachments({ includeInlineImages: true, includeAttachments: true });
  var meta = attachments.map(function (a) {
    return { mime: a.getContentType(), size: a.getSize() };
  });
  var proposal = AnnalsPilot.privateProposal({
    sourceId: sourceId,
    from: sender,
    subject: message.getSubject(),
    body: message.getPlainBody(),
    receivedAt: message.getDate().toISOString(),
    attachments: meta
  });

  var existingFolders = rootFolder.getFoldersByName(sourceId);
  var folder = existingFolders.hasNext() ? existingFolders.next() : rootFolder.createFolder(sourceId);
  var knownManifest = folder.getFilesByName('manifest-private.json');
  if (!knownManifest.hasNext()) {
    proposal.attachmentManifest.items.forEach(function (entry) {
      if (!entry.accepted) return; // Unsupported files remain in private Gmail.
      var existing = folder.getFilesByName(entry.storageName);
      if (!existing.hasNext()) {
        folder.createFile(attachments[entry.index - 1].copyBlob().setName(entry.storageName));
      }
    });
    // Manifest is written LAST. A crash before it leaves an incomplete folder
    // that a retry can fill in rather than a "published" submission.
    folder.createFile('manifest-private.json', JSON.stringify(proposal), MimeType.PLAIN_TEXT);
  }
  properties.setProperty(processedKey, 'staged');
  return proposal.requiresClarification ? 'held_private' : 'staged_private';
}

/** The only Apps Script entry point. Intentionally no trigger registration. */
function runAnnalsPrivateIntake() {
  var summary = { enabled: false, staged: 0, held: 0, untrusted: 0, duplicates: 0 };
  var state = annalsPilotPreflight();
  if (!state.enabled) return summary;
  if (!state.hasPrivateFolder || !state.trustedSenderCount) {
    throw new Error('Annals pilot is not configured with private folder and allowed senders');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return summary;
  try {
    var props = PropertiesService.getScriptProperties();
    var allowedAddresses = AnnalsPilot.allowedSenders(props.getProperty('ANNALS_ALLOWED_SENDERS'));
    var rootFolder = DriveApp.getFolderById(props.getProperty('ANNALS_PRIVATE_FOLDER_ID'));
    summary.enabled = true;
    // Dedicated club mailbox only. Limit work per cycle; repeat on next trigger.
    var threads = GmailApp.search('in:inbox', 0, 30);
    for (var t = 0; t < threads.length; t += 1) {
      var messages = threads[t].getMessages();
      for (var m = 0; m < messages.length; m += 1) {
        try {
          var outcome = annalsStageMessage_(rootFolder, messages[m], props, allowedAddresses);
          if (outcome === 'untrusted') summary.untrusted += 1;
          if (outcome === 'duplicate') summary.duplicates += 1;
          if (outcome === 'staged_private') summary.staged += 1;
          if (outcome === 'held_private') summary.held += 1;
        } catch (error) {
          // Keep message unmarked for a later retry. Never log email contents,
          // personal addresses, names, filenames or private folder IDs.
          throw new Error('Annals private-staging failure; review Apps Script execution securely');
        }
      }
    }
    return summary;
  } finally {
    lock.releaseLock();
  }
}

/** No publishing or AI call exists in the pilot. */
function annalsPilotNeverPublish() {
  return AnnalsPilot.publicationBlocked();
}
