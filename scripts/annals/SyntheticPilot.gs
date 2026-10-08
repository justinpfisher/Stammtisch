/* Manual, synthetic-only Annals pilot. Deploy with PilotCore.js ONLY.
 * No triggers, AI, outbound mail, publication or public web deployment.
 * GmailApp/DriveApp require broad account access: dedicated account only.
 */

function annalsSyntheticPreflight() {
  var p = PropertiesService.getScriptProperties();
  var state = {
    enabled: p.getProperty('ANNALS_SYNTHETIC_PILOT_ENABLED') === 'true' &&
      p.getProperty('ANNALS_SYNTHETIC_READ_APPROVED') === 'true',
    hasPrivateFolder: !!p.getProperty('ANNALS_PRIVATE_FOLDER_ID'),
    trustedSenderCount: AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || '').length,
    productionEnabled: p.getProperty('ANNALS_INTAKE_ENABLED') === 'true' ||
      p.getProperty('ANNALS_ALLOW_PRODUCTION_MAIL') === 'true',
    usesPaidAI: false,
    publishesAnything: false
  };
  console.log(JSON.stringify(state)); // Booleans/counts only.
  return state;
}

function annalsSyntheticHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value))
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

function annalsSyntheticAssertPrivate_(item) {
  if (item.getSharingAccess() !== DriveApp.Access.PRIVATE ||
      item.getEditors().length || item.getViewers().length) {
    throw new Error('Annals pilot requires owner-only private storage');
  }
}

function annalsSyntheticEscape_(value) {
  return String(value).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function annalsSyntheticPreview_(proposal) {
  var escape = annalsSyntheticEscape_;
  var media = proposal.attachmentManifest.items.map(function (a) {
    var heldByTotal = proposal.attachmentManifest.reason === 'total_attachments_too_large';
    return '<li>' + escape(heldByTotal ? 'Not staged: total attachment limit exceeded' : (a.storageName || 'Not staged')) + ': ' + escape(a.reason) + '</li>';
  }).join('');
  return '<!doctype html><html lang="en-CA"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'">' +
    '<title>Private synthetic Annals preview</title><style>' +
    'body{font:18px/1.6 system-ui;margin:2rem auto;padding:0 1rem;max-width:48rem;background:#f7f3e8;color:#153c2c}' +
    'pre{white-space:pre-wrap;overflow-wrap:anywhere}aside{border:2px solid #8c6e37;padding:1rem}</style></head><body>' +
    '<h1>Private synthetic intake preview</h1><aside>TEST MATERIAL ONLY. Not approved for publication.</aside>' +
    '<p>Suggested category: <strong>' + escape(proposal.categorisation) + '</strong>. Heuristic only; no AI interpretation.</p>' +
    '<h2>Submitted test text</h2><pre>' + escape(proposal.source.excerpt) + '</pre>' +
    '<h2>Attachment handling</h2><ul>' + media + '</ul>' +
    '<h2>Review required</h2><p>Event date, attribution and consent are unconfirmed. Recipe quantities and handwriting have not been interpreted or verified.</p>' +
    (proposal.requiresClarification ? '<p>Attachment or text limits require additional review. The original remains in Gmail.</p>' : '') +
    '<p>No email acknowledgement, paid processing or publication occurred.</p></body></html>';
}

function annalsSyntheticStage_(root, message) {
  var id = annalsSyntheticHash_(message.getId());
  var folders = root.getFoldersByName(id);
  var folder = folders.hasNext() ? folders.next() : root.createFolder(id);
  if (folders.hasNext()) throw new Error('Ambiguous private staging folder');
  annalsSyntheticAssertPrivate_(folder);
  var files = folder.getFiles();
  while (files.hasNext()) annalsSyntheticAssertPrivate_(files.next());
  var manifests = folder.getFilesByName('manifest-private.json');
  var previews = folder.getFilesByName('preview-private.html');
  // Manifest is the completion marker. Never duplicate a completed source.
  if (manifests.hasNext()) {
    if (!previews.hasNext()) throw new Error('Completed pilot item lacks its private preview');
    return 'duplicates';
  }
  var attachments = message.getAttachments({ includeInlineImages: true, includeAttachments: true });
  var proposal = AnnalsPilot.privateProposal({
    sourceId: id, from: message.getFrom(), subject: message.getSubject(),
    body: message.getPlainBody(), receivedAt: message.getDate().toISOString(),
    attachments: attachments.map(function (a) { return { mime: a.getContentType(), size: a.getSize() }; })
  });
  // A total-size hold must never copy the otherwise individually allowed files.
  if (proposal.attachmentManifest.reason !== 'total_attachments_too_large') {
    proposal.attachmentManifest.items.forEach(function (a) {
      if (!a.accepted) return;
      if (!folder.getFilesByName(a.storageName).hasNext()) {
        annalsSyntheticAssertPrivate_(folder.createFile(attachments[a.index - 1].copyBlob().setName(a.storageName)));
      }
    });
  }
  if (!previews.hasNext()) {
    annalsSyntheticAssertPrivate_(folder.createFile('preview-private.html', annalsSyntheticPreview_(proposal), MimeType.HTML));
  }
  annalsSyntheticAssertPrivate_(folder.createFile('manifest-private.json', JSON.stringify(proposal), MimeType.PLAIN_TEXT));
  return proposal.requiresClarification ? 'held' : 'staged';
}

function runAnnalsSyntheticPilot() {
  var summary = { enabled: false, staged: 0, held: 0, duplicates: 0, skipped: 0 };
  var state = annalsSyntheticPreflight();
  if (!state.enabled) return summary;
  if (state.productionEnabled || !state.hasPrivateFolder || !state.trustedSenderCount) {
    throw new Error('Configure synthetic-only pilot; production gates must remain false');
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return summary;
  try {
    var properties = PropertiesService.getScriptProperties();
    var allowed = AnnalsPilot.allowedSenders(properties.getProperty('ANNALS_ALLOWED_SENDERS'));
    var root = DriveApp.getFolderById(properties.getProperty('ANNALS_PRIVATE_FOLDER_ID'));
    annalsSyntheticAssertPrivate_(root);
    var label = GmailApp.getUserLabelByName('Annals-Pilot');
    if (!label) throw new Error('Create the dedicated Annals-Pilot test label first');
    var threads = label.getThreads(0, 10);
    summary.enabled = true;
    threads.forEach(function (thread) {
      thread.getMessages().forEach(function (message) {
        // Labels apply to threads: check EACH message before reading its body/media.
        if (message.getSubject().indexOf('[ANNALS SYNTHETIC PILOT] ') !== 0 ||
            allowed.indexOf(AnnalsPilot.senderAddress(message.getFrom())) < 0) {
          summary.skipped += 1;
          return;
        }
        summary[annalsSyntheticStage_(root, message)] += 1;
      });
    });
    console.log(JSON.stringify(summary));
    return summary;
  } catch (error) {
    // Provider exceptions can contain private identifiers; replace them.
    throw new Error('Private synthetic pilot stopped; inspect account configuration privately');
  } finally {
    lock.releaseLock();
  }
}
