/* Private production automation. Owner-only Apps Script project. */
function annalsProps_() { return PropertiesService.getScriptProperties(); }
function annalsHex_(bytes) { return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
function annalsHash_(value) { return annalsHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)); }
function annalsOwner_() {
  return AnnalsProduction.owner(Session.getActiveUser().getEmail(), Session.getEffectiveUser().getEmail(),
    annalsProps_().getProperty('ANNALS_OWNER_EMAIL'));
}
function annalsPrivate_(item) {
  var expected = annalsProps_().getProperty('ANNALS_OWNER_EMAIL');
  if (!expected || item.getSharingAccess() !== DriveApp.Access.PRIVATE || item.getEditors().length || item.getViewers().length ||
      !item.getOwner() || item.getOwner().getEmail().toLowerCase() !== expected.toLowerCase()) throw new Error('Owner-only storage required');
  return item;
}
function annalsRoot_() { return annalsPrivate_(DriveApp.getFolderById(annalsProps_().getProperty('ANNALS_PRODUCTION_FOLDER_ID'))); }
function annalsFolder_(id, create) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid item');
  var root = annalsRoot_(), matches = root.getFoldersByName(id), folder = matches.hasNext() ? matches.next() : null;
  if (matches.hasNext()) throw new Error('Ambiguous storage');
  if (!folder && create) folder = root.createFolder(id);
  if (!folder) throw new Error('Missing item');
  return annalsPrivate_(folder);
}
function annalsFile_(folder, name) {
  var files = folder.getFilesByName(name), file = files.hasNext() ? files.next() : null;
  if (files.hasNext()) throw new Error('Ambiguous private file');
  return file ? annalsPrivate_(file) : null;
}
function annalsRead_(folder, name) {
  var file = annalsFile_(folder, name);
  return file ? JSON.parse(file.getBlob().getDataAsString('UTF-8')) : null;
}
function annalsWriteOnce_(folder, name, value) {
  if (annalsFile_(folder, name)) throw new Error('Existing immutable record');
  return annalsPrivate_(folder.createFile(name, JSON.stringify(value), MimeType.PLAIN_TEXT));
}
function annalsSavePrivate_(folder, name, value) {
  var file = annalsFile_(folder, name), content = JSON.stringify(value);
  if (file) file.setContent(content); else annalsWriteOnce_(folder, name, value);
}
function annalsAuthentication_(message, sender) {
  // Read raw headers and reject duplicates: a sender-supplied forged result must
  // never be selected ambiguously alongside Gmail's own authentication result.
  if (typeof message.getRawContent !== 'function') return false;
  var raw = String(message.getRawContent() || ''), boundary = raw.search(/\r?\n\r?\n/);
  if (boundary < 0) return false;
  var lines = raw.slice(0, boundary).replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/), results = [];
  lines.forEach(function (line) { if (/^authentication-results:/i.test(line)) results.push(line.replace(/^authentication-results:\s*/i, '')); });
  if (results.length !== 1) return false;
  var header = results[0].toLowerCase();
  var domain = String(sender.split('@')[1] || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!header || !/(^|[\s;])mx\.google\.com(?:[\s;]|$)/.test(header) || !domain) return false;
  var dkim = new RegExp('dkim=pass[^;]*(?:header\\.d=' + domain + '(?:[\\s;]|$)|header\\.i=[^;\\s]*@' + domain + '(?:[\\s;]|$))');
  var dmarc = new RegExp('dmarc=pass[^;]*header\\.from=' + domain + '(?:[\\s;]|$)');
  return dkim.test(header) || dmarc.test(header);
}
function annalsConsentRegistry_() { return annalsRead_(annalsRoot_(), 'consent-registry-private.json') || { schemaVersion: 1, members: {} }; }
function annalsConsentActive_(sender) {
  sender = String(sender || '').toLowerCase();
  if (AnnalsPilot.allowedSenders(annalsProps_().getProperty('ANNALS_ALLOWED_SENDERS') || '').indexOf(sender) < 0) return false;
  var record = annalsConsentRegistry_().members[sender.toLowerCase()];
  return !!record && record.status === 'active' && record.scope === 'future_text_ai_drafting' && record.consentedAt && !record.revokedAt;
}
function annalsStandingPublicationActive_(sender, receivedAt) {
  sender = String(sender || '').toLowerCase();
  if (AnnalsPilot.allowedSenders(annalsProps_().getProperty('ANNALS_ALLOWED_SENDERS') || '').indexOf(sender) < 0 ||
      !annalsConsentActive_(sender)) return false;
  var member = annalsConsentRegistry_().members[sender];
  var permission = member && member.autoPublication;
  var activated = Date.parse(permission && permission.consentedAt);
  var received = Date.parse(receivedAt);
  return !!permission && permission.status === 'active' && permission.scope === 'future_source_grounded_text_publication' &&
    !permission.revokedAt && Number.isFinite(activated) && Number.isFinite(received) && received >= activated;
}
function annalsHandleConsentReply_(sender, body) {
  var root = annalsRoot_(), registry = annalsConsentRegistry_(), member = registry.members[sender.toLowerCase()];
  var text = String(body || '').split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean)[0] || '';
  if (member && member.autoPublication && member.autoPublication.status === 'pending' &&
      text === 'I CONSENT TO AUTOMATIC PUBLIC ANNALS TEXT PUBLICATION. CODE: ' + member.autoPublication.challenge) {
    member.autoPublication.status = 'active';
    member.autoPublication.scope = 'future_source_grounded_text_publication';
    member.autoPublication.consentedAt = new Date().toISOString();
    delete member.autoPublication.challenge;
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    MailApp.sendEmail(sender, 'Annals automatic publication consent recorded',
      'Your separate standing permission for eligible future text submissions is active. The public website and GitHub history are accessible to everyone and old copies may remain after withdrawal. Unsafe or uncertain material stays private. You can revoke future automatic publication by emailing the exact line: REVOKE ANNALS AUTOMATIC PUBLICATION. You may also revoke private AI processing separately.');
    return 'auto_consent_activated';
  }
  if (member && member.autoPublication && member.autoPublication.status === 'active' &&
      text === 'REVOKE ANNALS AUTOMATIC PUBLICATION') {
    member.autoPublication.status = 'revoked';
    member.autoPublication.revokedAt = new Date().toISOString();
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    MailApp.sendEmail(sender, 'Annals automatic publication consent revoked',
      'Future automatic publication is disabled. Existing public entries and GitHub history are not erased. Contact the club owner to request a withdrawal.');
    return 'auto_consent_revoked';
  }
  if (member && member.status === 'pending' && text === 'I CONSENT TO PRIVATE AI DRAFTING FOR FUTURE TEXT SUBMISSIONS. CODE: ' + member.challenge) {
    member.status = 'active'; member.scope = 'future_text_ai_drafting'; member.consentedAt = new Date().toISOString(); delete member.challenge;
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    MailApp.sendEmail(sender, 'Annals processing consent recorded', 'Your one-time consent is recorded for private AI drafting of future text submissions. You may revoke it at any time by replying exactly: REVOKE ANNALS AI PROCESSING. Public publication requires either your separate standing automatic-publication consent for narrowly eligible text or separate exact owner approval.');
    return 'consent_activated';
  }
  if (member && member.status === 'active' && text === 'REVOKE ANNALS AI PROCESSING') {
    member.status = 'revoked'; member.revokedAt = new Date().toISOString();
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    MailApp.sendEmail(sender, 'Annals processing consent revoked', 'Future submissions will no longer be sent for AI drafting. Existing drafts remain private for owner review.');
    return 'consent_revoked';
  }
  return null;
}
function annalsAckOnce_(folder, sender, itemId, state) {
  if (annalsFile_(folder, 'acknowledgement-private.json')) return false;
  var record = { at: new Date().toISOString(), state: state, delivery: 'attempted_once' };
  annalsWriteOnce_(folder, 'acknowledgement-private.json', record);
  try {
    MailApp.sendEmail(sender, 'Annals submission received',
      'Your submission was received. Eligible consented text may publish automatically; uncertain submissions remain private. The public site, not this receipt, confirms publication.');
    record.delivery = 'sent';
  } catch (e) { record.delivery = 'unknown_no_retry'; }
  annalsFile_(folder, 'acknowledgement-private.json').setContent(JSON.stringify(record));
  return record.delivery === 'sent';
}
function annalsRecordAttemptOutcome_(folder, reason, httpStatus) {
  var outcome = { state: 'held', reason: reason, at: new Date().toISOString() };
  if (Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599) outcome.httpStatus = httpStatus;
  try {
    if (!annalsFile_(folder, 'ai-outcome-private.json')) annalsWriteOnce_(folder, 'ai-outcome-private.json', outcome);
  } catch (ignored) { /* Never replace the safe generic failure with private storage details. */ }
}
function annalsLocked_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('Another operation is running; try again shortly');
  try { return fn(); } finally { lock.releaseLock(); }
}
function annalsUiCall_(nonce, fn) {
  annalsOwner_();
  if (typeof nonce !== 'string' || !CacheService.getUserCache().get('annals.' + nonce)) throw new Error('Reload the private review page');
  try { return fn(); } catch (e) { throw new Error('Operation held. Check configuration or review the private item; no automatic retry was made.'); }
}
function annalsProductionPreflight() {
  var p = annalsProps_();
  var result = { intakeEnabled: p.getProperty('ANNALS_PRODUCTION_INTAKE_ENABLED') === 'true',
    aiEnabled: p.getProperty('ANNALS_AI_ENABLED') === 'true',
    hasPrivateFolder: !!p.getProperty('ANNALS_PRODUCTION_FOLDER_ID'),
    hasOwner: !!p.getProperty('ANNALS_OWNER_EMAIL'), hasApiKey: !!p.getProperty('ANNALS_OPENAI_API_KEY'),
    hasApprovalKey: (p.getProperty('ANNALS_APPROVAL_KEY') || '').length >= 32,
    hasActivationBoundary: Number.isFinite(Date.parse(p.getProperty('ANNALS_ACTIVATED_AT'))),
    hasBudgetLedger: !!p.getProperty('ANNALS_BUDGET_LEDGER'), hasReviewUrl: /^https:\/\/script\.google\.com\/macros\/s\//.test(p.getProperty('ANNALS_REVIEW_URL') || ''),
    hasPublishToken: !!p.getProperty('ANNALS_GITHUB_TOKEN'), hasPublishSigningKey: (p.getProperty('ANNALS_PUBLISH_SIGNING_KEY') || '').length >= 32,
    publishKeySeparate: !!p.getProperty('ANNALS_PUBLISH_SIGNING_KEY') && p.getProperty('ANNALS_PUBLISH_SIGNING_KEY') !== p.getProperty('ANNALS_APPROVAL_KEY'),
    hasPublishRepository: /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(p.getProperty('ANNALS_GITHUB_REPOSITORY') || ''),
    publicationRequiresExactOwnerApproval: true, // always true for manually held material
    autoPublicationEnabled: p.getProperty('ANNALS_AUTO_PUBLICATION_ENABLED') === 'true',
    standingPublicationRequiresContributorConsent: true, sendsAcknowledgements: true };
  console.log(JSON.stringify(result)); return result;
}
function annalsStampProductionActivation() {
  annalsOwner_();
  var p = annalsProps_();
  if (p.getProperty('ANNALS_PRODUCTION_INTAKE_ENABLED') === 'true' || p.getProperty('ANNALS_AI_ENABLED') === 'true' || p.getProperty('ANNALS_AUTO_PUBLICATION_ENABLED') === 'true') throw new Error('Disable intake and AI before recording the activation boundary');
  if (!AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || '').length || !p.getProperty('ANNALS_PRODUCTION_FOLDER_ID') ||
      !p.getProperty('ANNALS_OWNER_EMAIL') || (p.getProperty('ANNALS_APPROVAL_KEY') || '').length < 32) throw new Error('Private production preflight incomplete');
  var activatedAt = new Date().toISOString();
  p.setProperty('ANNALS_ACTIVATED_AT', activatedAt);
  return { recorded: true, activatedAt: activatedAt, intakeEnabled: false, aiEnabled: false };
}
function annalsInitialiseBudget() {
  annalsOwner_();
  return annalsLocked_(function () {
    var p = annalsProps_();
    if (p.getProperty('ANNALS_BUDGET_LEDGER')) throw new Error('Budget ledger already exists; never reset it to obtain more allowance');
    if (p.getProperty('ANNALS_AI_ENABLED') === 'true') throw new Error('Disable AI before first configuration');
    var root = annalsRoot_();
    // Marker prevents accidental ledger reinitialisation against a used root.
    if (annalsFile_(root, 'budget-initialised-private.json')) throw new Error('Restore the existing budget ledger; do not reinitialise');
    var ledger = { schemaVersion: 1, month: Utilities.formatDate(new Date(), 'America/Toronto', 'yyyy-MM'), reservedCents: 0 };
    annalsWriteOnce_(root, 'budget-initialised-private.json', { createdAt: new Date().toISOString() });
    p.setProperty('ANNALS_BUDGET_LEDGER', JSON.stringify(ledger));
    return { initialised: true, monthlyLimitUsd: 5 };
  });
}
function annalsStageProduction_(message, activation, allowed) {
  var sender = AnnalsPilot.senderAddress(message.getFrom());
  if (!sender || allowed.indexOf(sender) < 0 || message.getDate().getTime() < activation ||
      /^\[ANNALS SYNTHETIC PILOT\]/.test(message.getSubject())) return 'skipped';
  var id = annalsHash_(message.getId()), folder = annalsFolder_(id, true);
  if (annalsRead_(folder, 'source-private.json')) return 'duplicates';
  var authenticated = annalsAuthentication_(message, sender);
  if (authenticated) {
    var consentResult = annalsHandleConsentReply_(sender, message.getPlainBody());
    if (consentResult) return consentResult;
    var firstLine = String(message.getPlainBody() || '').trim().split(/\r?\n/)[0] || '';
    if (/^(?:I CONSENT TO |REVOKE ANNALS )/.test(firstLine)) return 'held'; // invalid/stale challenges are not submissions
  }
  var attachments = message.getAttachments({ includeInlineImages: false, includeAttachments: true });
  var source = AnnalsPilot.privateProposal({ sourceId: id, from: sender, subject: message.getSubject(),
    body: message.getPlainBody(), receivedAt: message.getDate().toISOString(),
    attachments: attachments.map(function (a) { return { mime: a.getContentType(), size: a.getSize() }; }) });
  if (source.attachmentManifest.reason !== 'total_attachments_too_large') {
    source.attachmentManifest.items.forEach(function (a) {
      if (a.accepted && !annalsFile_(folder, a.storageName)) annalsPrivate_(folder.createFile(attachments[a.index - 1].copyBlob().setName(a.storageName)));
    });
  }
  source.senderAuthenticated = authenticated;
  source.aiConsentActive = source.senderAuthenticated && annalsConsentActive_(sender);
  source.autoConsentAtReceipt = source.senderAuthenticated && annalsStandingPublicationActive_(sender, message.getDate().toISOString());
  annalsWriteOnce_(folder, 'source-private.json', source);
  if (!source.senderAuthenticated) return 'unverified';
  if (!source.aiConsentActive) { annalsAckOnce_(folder, sender, id, 'private_review_only'); return 'awaiting_consent'; }
  if (source.requiresClarification || attachments.length || !source.source.excerpt || source.source.excerptTruncated) {
    annalsAckOnce_(folder, sender, id, 'held_for_private_review'); return 'held';
  }
  annalsAckOnce_(folder, sender, id, 'consented_private_drafting');
  return 'staged';
}
/** Create one fixed, private synthetic item for a manual provider check; never reads Gmail or calls AI. */
function annalsCreateSyntheticCheckItem() {
  annalsOwner_();
  return annalsLocked_(function () {
    var root = annalsRoot_(), messageId = 'stammtisch-annals-production-check-v1';
    var id = annalsHash_(messageId), existing = root.getFoldersByName(id);
    if (existing.hasNext()) throw new Error('Synthetic integration item already exists; do not recreate it');
    var sender = 'synthetic@invalid.example', received = new Date();
    var message = { getId: function () { return messageId; }, getFrom: function () { return sender; },
      getSubject: function () { return 'Synthetic production integration check — not club history'; },
      getDate: function () { return received; },
      getPlainBody: function () { return 'Fictional test only. Imaginary recipe: 1/2 oz imaginary syrup and 1 oz test juice. This is not a real contribution and has no publication permission.'; },
      getAttachments: function () { return []; } };
    var result = annalsStageProduction_(message, received.getTime() - 1000, [sender]);
    if (result !== 'unverified') throw new Error('Synthetic integration item could not be held privately');
    return { created: true, automaticAi: false, publishesAnything: false };
  });
}
/** Bounded inbox traversal; no mail, labels or read/unread state is changed.
 * A saved thread/message position is resumed on the next run, then wraps.
 */
function runAnnalsProductionIntake() {
  var p = annalsProps_(), summary = { enabled: false, staged: 0, held: 0, duplicates: 0, skipped: 0, unverified: 0, awaiting_consent: 0, consent_activated: 0, consent_revoked: 0, auto_consent_activated: 0, auto_consent_revoked: 0, drafted: 0, verified: 0 };
  if (p.getProperty('ANNALS_PRODUCTION_INTAKE_ENABLED') !== 'true') return summary;
  try {
    return annalsLocked_(function () {
      if (Session.getEffectiveUser().getEmail().toLowerCase() !== (p.getProperty('ANNALS_OWNER_EMAIL') || '').toLowerCase()) throw new Error('Wrong account');
      if (p.getProperty('ANNALS_AI_ENABLED') !== 'true' || !p.getProperty('ANNALS_OPENAI_API_KEY') || !p.getProperty('ANNALS_BUDGET_LEDGER') ||
          !p.getProperty('ANNALS_GITHUB_TOKEN') || (p.getProperty('ANNALS_PUBLISH_SIGNING_KEY') || '').length < 32 ||
          !p.getProperty('ANNALS_GITHUB_REPOSITORY') || !p.getProperty('ANNALS_REVIEW_URL')) throw new Error('Production automation configuration incomplete');
      var activation = Date.parse(p.getProperty('ANNALS_ACTIVATED_AT'));
      var allowed = AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || '');
      if (!Number.isFinite(activation) || activation > Date.now() || !allowed.length ||
          (p.getProperty('ANNALS_AUTO_PUBLICATION_ENABLED') === 'true' && allowed.length !== 6)) throw new Error('Intake configuration incomplete');
      annalsRoot_();
      var cursor = JSON.parse(p.getProperty('ANNALS_INBOX_CURSOR') || '{"offset":0,"message":0,"threadId":null}');
      if (!Number.isSafeInteger(cursor.offset) || cursor.offset < 0 || !Number.isSafeInteger(cursor.message) || cursor.message < 0) throw new Error('Invalid cursor');
      var thread = cursor.threadId ? GmailApp.getThreadById(cursor.threadId) : GmailApp.getInboxThreads(cursor.offset, 1)[0];
      if (!thread) {
        p.deleteProperty('ANNALS_INBOX_CURSOR');
        summary.enabled = true;
        summary.drafted = annalsResumeConsentedDrafts_(10);
        summary.verified = annalsVerifyAutomaticPublications_(3);
        console.log(JSON.stringify(summary));
        return summary;
      }
      summary.enabled = true;
      cursor.threadId = thread.getId();
      var messages = thread.getMessages(), end = Math.min(messages.length, cursor.message + 10);
      for (var i = cursor.message; i < end; i++) {
        summary[annalsStageProduction_(messages[i], activation, allowed)]++;
        cursor.message = i + 1;
        p.setProperty('ANNALS_INBOX_CURSOR', JSON.stringify(cursor));
      }
      if (end >= messages.length) p.setProperty('ANNALS_INBOX_CURSOR', JSON.stringify({ offset: cursor.offset + 1, message: 0, threadId: null }));
      summary.drafted = annalsResumeConsentedDrafts_(10);
      summary.verified = annalsVerifyAutomaticPublications_(3);
      console.log(JSON.stringify(summary)); return summary;
    });
  } catch (e) { throw new Error('Private intake stopped; review account configuration privately'); }
}
function annalsResumeConsentedDrafts_(limit) {
  var p = annalsProps_(), cursor = p.getProperty('ANNALS_DRAFT_CURSOR');
  var folders = cursor ? DriveApp.continueFolderIterator(cursor) : annalsRoot_().getFolders(), done = 0, checked = 0;
  while (folders.hasNext() && checked++ < 50 && done < limit) {
    var folder = annalsPrivate_(folders.next()), id = folder.getName();
    if (!/^[a-f0-9]{64}$/.test(id)) continue;
    var source = annalsRead_(folder, 'source-private.json');
    if (!source) continue;
    if (annalsFile_(folder, 'draft-private.json')) {
      var dispatched = annalsAutoPublishCandidate_(id);
      if (!dispatched && !annalsFile_(folder, 'draft-notice-private.json')) annalsNotifyDraftReady_(folder);
      continue;
    }
    if (annalsFile_(folder, 'ai-attempt-private.json') || source.senderAuthenticated !== true ||
        source.aiConsentActive !== true || !annalsConsentActive_(source.source.sender) ||
        source.requiresClarification || source.source.excerptTruncated ||
        !annalsSafeTextForAutoAi_(source.source.subject + '\n' + source.source.excerpt)) continue;
    try { if (annalsProcessConsentedText_(id)) done++; }
    catch (e) {
      // An attempt marker permanently prevents a second provider charge.
      if (annalsFile_(folder, 'ai-attempt-private.json')) {
        try { MailApp.sendEmail(annalsProps_().getProperty('ANNALS_OWNER_EMAIL'), 'Annals draft requires private review',
          'A consented submission could not complete drafting. It remains private and will not be retried automatically. Open the owner-only review desk: ' + annalsProps_().getProperty('ANNALS_REVIEW_URL')); } catch (ignored) {}
      }
    }
  }
  if (folders.hasNext()) p.setProperty('ANNALS_DRAFT_CURSOR', folders.getContinuationToken()); else p.deleteProperty('ANNALS_DRAFT_CURSOR');
  return done;
}
function doGet() {
  annalsOwner_();
  return HtmlService.createHtmlOutputFromFile('ReviewUi').setTitle('Private Annals review');
}
function annalsReviewSession() {
  annalsOwner_();
  var nonce = Utilities.getUuid();
  CacheService.getUserCache().put('annals.' + nonce, '1', 1800);
  return { nonce: nonce };
}
function annalsInviteProcessingConsent(nonce, email) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    var address = String(email || '').trim().toLowerCase(), allowed = AnnalsPilot.allowedSenders(annalsProps_().getProperty('ANNALS_ALLOWED_SENDERS') || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || allowed.indexOf(address) < 0) throw new Error('Use an address on the private sender allowlist');
    var root = annalsRoot_(), registry = annalsConsentRegistry_(), existing = registry.members[address];
    if (existing && existing.status === 'active') throw new Error('Consent is already active');
    var challenge = Utilities.getUuid() + Utilities.getUuid();
    registry.members[address] = { status: 'pending', scope: 'future_text_ai_drafting', invitedAt: new Date().toISOString(), challenge: challenge };
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    MailApp.sendEmail(address, 'Choose whether to allow private Annals AI drafting',
      'You may explicitly opt in to private AI drafting for future text submissions. To opt in, reply to this message with this exact sentence:\n\nI CONSENT TO PRIVATE AI DRAFTING FOR FUTURE TEXT SUBMISSIONS. CODE: ' + challenge +
      '\n\nThis consent alone does not authorize publication. You may separately opt in to narrow automatic public text publication or seek individual approval. To revoke AI processing, reply exactly: REVOKE ANNALS AI PROCESSING.');
    return { invited: true };
  }); });
}
function annalsInviteAutoPublicationConsent(nonce, email) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    var address = String(email || '').trim().toLowerCase();
    var allowed = AnnalsPilot.allowedSenders(annalsProps_().getProperty('ANNALS_ALLOWED_SENDERS') || '');
    if (allowed.indexOf(address) < 0 || !annalsConsentActive_(address)) throw new Error('Private AI-processing consent must be active first');
    var root = annalsRoot_(), registry = annalsConsentRegistry_(), member = registry.members[address];
    if (member.autoPublication && member.autoPublication.status === 'active') throw new Error('Standing consent is already active');
    var challenge = Utilities.getUuid() + Utilities.getUuid();
    member.autoPublication = { status: 'pending', scope: 'future_source_grounded_text_publication',
      invitedAt: new Date().toISOString(), challenge: challenge };
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    MailApp.sendEmail(address, 'Choose whether future Annals text can publish automatically',
      'This is an OPTIONAL, separate, revocable authorisation. If you agree, original text and recipes you personally have the right to publish may automatically appear on the PUBLIC Stammtisch website and in PUBLIC permanent GitHub history without per-entry review. The system may visibly censor strong profanity and may use anonymous attribution. Photos, other people\'s words, personal details, uncertain recipes and unsafe material will be held for private review. You affirm you will not submit third-party content without the necessary permissions. Your original email stays private. Withdrawal from the current website cannot erase copies or Git history.\n\nTo opt in, reply with this exact sentence:\n\nI CONSENT TO AUTOMATIC PUBLIC ANNALS TEXT PUBLICATION. CODE: ' + challenge +
      '\n\nTo revoke at any time, send: REVOKE ANNALS AUTOMATIC PUBLICATION. AI processing consent remains separate.');
    return { invited: true };
  }); });
}
function annalsRevokeAutoPublicationConsent(nonce, email) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    var address = String(email || '').trim().toLowerCase();
    var root = annalsRoot_(), registry = annalsConsentRegistry_(), member = registry.members[address];
    if (!member || !member.autoPublication || member.autoPublication.status !== 'active') throw new Error('No active automatic-publication consent');
    member.autoPublication.status = 'revoked';
    member.autoPublication.revokedAt = new Date().toISOString();
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    return { revoked: true };
  }); });
}
function annalsReviewConsentStatus(nonce) {
  return annalsUiCall_(nonce, function () {
    var members = annalsConsentRegistry_().members;
    return Object.keys(members).map(function (address) { return { address: address, status: members[address].status, consentedAt: members[address].consentedAt || null, revokedAt: members[address].revokedAt || null, autoStatus: (members[address].autoPublication || {}).status || 'not_invited', autoConsentedAt: (members[address].autoPublication || {}).consentedAt || null }; });
  });
}
function annalsRevokeProcessingConsent(nonce, email) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    var address = String(email || '').trim().toLowerCase(), root = annalsRoot_(), registry = annalsConsentRegistry_(), member = registry.members[address];
    if (!member || member.status !== 'active') throw new Error('No active consent record');
    member.status = 'revoked'; member.revokedAt = new Date().toISOString();
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    return { revoked: true };
  }); });
}
function annalsReviewList(nonce, continuation) {
  return annalsUiCall_(nonce, function () {
    annalsRoot_();
    var folders = continuation ? DriveApp.continueFolderIterator(continuation) : annalsRoot_().getFolders(), items = [], checked = 0;
    while (folders.hasNext() && checked++ < 30) {
      var f = annalsPrivate_(folders.next()), id = f.getName();
      if (!/^[a-f0-9]{64}$/.test(id)) continue;
      var source = annalsRead_(f, 'source-private.json');
      if (!source) continue;
      var approval = annalsRead_(f, 'approval-private.json'), correction = annalsRead_(f, 'correction-approval-private.json'), removal = annalsRead_(f, 'removal-private.json');
      items.push({ id: id, subject: source.source.subject, receivedAt: source.source.receivedAt,
        state: removal ? 'Removal request — ' + removal.state : correction ? 'Correction — ' + correction.publicationState :
          approval ? (approval.publicationState === 'dispatch_accepted' ? 'Exact approval — publish request accepted' : 'Exact approval — publication needs attention') :
          annalsFile_(f, 'draft-private.json') ? 'Draft ready' :
          annalsFile_(f, 'ai-attempt-private.json') ? 'AI attempt requires review' : 'Awaiting processing consent' });
    }
    return { items: items, continuation: folders.hasNext() ? folders.getContinuationToken() : null };
  });
}
function annalsReviewItem(nonce, id) {
  return annalsUiCall_(nonce, function () {
    var f = annalsFolder_(id), source = annalsRead_(f, 'source-private.json');
    if (!source) throw new Error('Incomplete source');
    var originalApproval = annalsRead_(f, 'approval-private.json'), correction = annalsRead_(f, 'correction-approval-private.json');
    var published = correction && correction.publicationState === 'dispatch_accepted' ? correction : originalApproval;
    var publicationState = correction && correction.publicationState !== 'dispatch_accepted' ? 'correction_result_uncertain' : (published || {}).publicationState || null;
    var names = source.attachmentManifest.items.filter(function (a) { return a.accepted && annalsFile_(f, a.storageName); })
      .map(function (a) { return { name: a.storageName, mime: a.mime, size: a.size }; });
    return { id: id, subject: source.source.subject, text: source.source.excerpt, receivedAt: source.source.receivedAt,
      truncated: source.source.excerptTruncated, attachments: names, folderUrl: f.getUrl(),
      draft: annalsRead_(f, 'draft-private.json'), review: annalsRead_(f, 'review-private.json'),
      photoDerivative: annalsRead_(f, 'photo-derivative-private.json') ? annalsPhotoDerivative_(f) : null,
      outcome: annalsRead_(f, 'ai-outcome-private.json'), correctionReview: annalsRead_(f, 'correction-review-private.json'),
      correctionApproval: correction, removal: annalsRead_(f, 'removal-private.json'),
      publishedEntry: (published || {}).entry || null,
      publishedEntryHash: (published || {}).entry ? annalsHash_(AnnalsProduction.serial(published.entry)) : null,
      attempted: !!annalsFile_(f, 'ai-attempt-private.json'), approved: !!annalsFile_(f, 'approval-private.json'),
      publicationState: publicationState,
      dispatchAttempted: !!annalsFile_(f, 'publication-dispatch-private.json') };
  });
}
function annalsJpegDerivativeSafe_(bytes) {
  if (!bytes || bytes.length < 4 || (bytes[0] & 255) !== 255 || (bytes[1] & 255) !== 216 ||
      (bytes[bytes.length - 2] & 255) !== 255 || (bytes[bytes.length - 1] & 255) !== 217) return false;
  var i = 2, sawScan = false;
  while (i < bytes.length - 2) {
    if ((bytes[i] & 255) !== 255) return false;
    while (i < bytes.length && (bytes[i] & 255) === 255) i++;
    if (i >= bytes.length) return false;
    var marker = bytes[i++] & 255;
    if (marker === 0xda) { sawScan = true; break; }
    if (marker === 0xd9 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
    if (i + 1 >= bytes.length) return false;
    var length = ((bytes[i] & 255) << 8) | (bytes[i + 1] & 255);
    if (length < 2 || i + length > bytes.length || (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe) return false;
    i += length;
  }
  return sawScan;
}
function annalsSavePhotoDerivative(nonce, id, base64) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    var folder = annalsFolder_(id), source = annalsRead_(folder, 'source-private.json');
    if (!source || typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length > 44000) throw new Error('Invalid photo derivative');
    var bytes = Utilities.base64Decode(base64);
    if (bytes.length > 32768 || !annalsJpegDerivativeSafe_(bytes)) throw new Error('Photo derivative must be a small metadata-free JPEG');
    var previous = annalsFile_(folder, 'photo-derivative-private.jpg');
    if (previous) previous.setTrashed(true);
    var file = annalsPrivate_(folder.createFile(Utilities.newBlob(bytes, 'image/jpeg', 'photo-derivative-private.jpg')));
    var metadata = { sha256: annalsHash_(bytes), size: bytes.length, name: 'photo-derivative-private.jpg', savedAt: new Date().toISOString() };
    annalsSavePrivate_(folder, 'photo-derivative-private.json', metadata);
    return { saved: true, sha256: metadata.sha256, size: metadata.size };
  }); });
}
function annalsPhotoDerivative_(folder) {
  var metadata = annalsRead_(folder, 'photo-derivative-private.json'), file = annalsFile_(folder, 'photo-derivative-private.jpg');
  if (!metadata || !file) return null;
  var bytes = file.getBlob().getBytes();
  if (bytes.length !== metadata.size || annalsHash_(bytes) !== metadata.sha256 || !annalsJpegDerivativeSafe_(bytes)) throw new Error('Private photo derivative integrity failed');
  return { sha256: metadata.sha256, size: metadata.size, base64: Utilities.base64Encode(bytes) };
}
function annalsPrepareDraft(nonce, id, text, selectedNames, consent) {
  return annalsUiCall_(nonce, function () { return annalsPrepareDraftCore_(id, text, selectedNames, consent); });
}
function annalsPrepareDraftCore_(id, text, selectedNames, consent, intakeLockHeld) {
  var process = function () {
    if (consent !== true) throw new Error('Processing consent required');
    var p = annalsProps_(), f = annalsFolder_(id);
    if (p.getProperty('ANNALS_AI_ENABLED') !== 'true' || !p.getProperty('ANNALS_OPENAI_API_KEY')) throw new Error('AI configuration incomplete');
    if (Date.now() > Date.parse('2026-11-08T00:00:00Z')) throw new Error('Review current model pricing before further use');
    if (annalsFile_(f, 'ai-attempt-private.json')) throw new Error('An attempt already exists; no duplicate spend');
    var source = annalsRead_(f, 'source-private.json');
    if (!source || !Array.isArray(selectedNames) || selectedNames.length > 3 || new Set(selectedNames).size !== selectedNames.length) throw new Error('Invalid sources');
    var images = selectedNames.map(function (name) {
      var item = source.attachmentManifest.items.find(function (a) { return a.storageName === name; });
      if (!item || !item.accepted || ['image/jpeg', 'image/png'].indexOf(item.mime) < 0 || item.size > 4 * 1024 * 1024) throw new Error('Unsupported AI attachment');
      var file = annalsFile_(f, name);
      if (!file || file.getSize() > 4 * 1024 * 1024) throw new Error('Attachment changed');
      return { mime: item.mime, base64: Utilities.base64Encode(file.getBlob().getBytes()) };
    });
    var request = AnnalsProduction.request(text, images);
    var month = Utilities.formatDate(new Date(), 'America/Toronto', 'yyyy-MM');
    var ledger = AnnalsProduction.reserve(JSON.parse(p.getProperty('ANNALS_BUDGET_LEDGER') || 'null'), month);
    p.setProperty('ANNALS_BUDGET_LEDGER', JSON.stringify(ledger)); // before any network request
    annalsWriteOnce_(f, 'ai-attempt-private.json', { state: 'attempt_reserved', reservedCents: 10,
      at: new Date().toISOString(), owner: annalsOwner_(), model: AnnalsProduction.MODEL,
      processingConsent: true, submittedText: text, selectedNames: selectedNames });
    var response;
    try {
      response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
        method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + p.getProperty('ANNALS_OPENAI_API_KEY') },
        payload: JSON.stringify(request), muteHttpExceptions: true, followRedirects: false, validateHttpsCertificates: true });
    } catch (e) {
      annalsRecordAttemptOutcome_(f, 'network_error');
      throw new Error('AI attempt held; no automatic retry');
    }
    var status;
    try { status = response.getResponseCode(); }
    catch (e) {
      annalsRecordAttemptOutcome_(f, 'provider_response_error');
      throw new Error('AI attempt held; no automatic retry');
    }
    if (status !== 200) {
      annalsRecordAttemptOutcome_(f, 'provider_http_error', status);
      throw new Error('AI attempt held; no automatic retry');
    }
    var candidate;
    try { candidate = AnnalsProduction.response(JSON.parse(response.getContentText())); }
    catch (e) {
      annalsRecordAttemptOutcome_(f, 'invalid_response');
      throw new Error('AI attempt held; no automatic retry');
    }
    try { annalsWriteOnce_(f, 'draft-private.json', candidate); }
    catch (e) {
      annalsRecordAttemptOutcome_(f, 'private_storage_error');
      throw new Error('AI attempt held; no automatic retry');
    }
    return { drafted: true };
  };
  return intakeLockHeld === true ? process() : annalsLocked_(process);
}
function annalsProcessConsentedText_(id) {
  var source = annalsRead_(annalsFolder_(id), 'source-private.json');
  if (!source || source.senderAuthenticated !== true || source.aiConsentActive !== true || !annalsConsentActive_(source.source.sender) ||
      source.requiresClarification || source.source.excerptTruncated ||
      !annalsSafeTextForAutoAi_(source.source.subject + '\n' + source.source.excerpt) ||
      annalsProps_().getProperty('ANNALS_AI_ENABLED') !== 'true') return false;
  var fullText = source.source.subject + '\n' + source.source.excerpt;
  annalsPrepareDraftCore_(id, fullText, [], true, true); // caller already holds intake lock
  var dispatched = annalsAutoPublishCandidate_(id);
  if (!dispatched) annalsNotifyDraftReady_(annalsFolder_(id));
  return true;
}
function annalsNotifyDraftReady_(folder) {
  if (annalsFile_(folder, 'draft-notice-private.json')) return false;
  var p = annalsProps_(), reviewUrl = p.getProperty('ANNALS_REVIEW_URL');
  if (!reviewUrl || !/^https:\/\/script\.google\.com\/macros\/s\//.test(reviewUrl)) throw new Error('Private review URL not configured');
  annalsWriteOnce_(folder, 'draft-notice-private.json', { state: 'attempted_once', at: new Date().toISOString() });
  var delivery = 'unknown_no_retry';
  try {
    MailApp.sendEmail(p.getProperty('ANNALS_OWNER_EMAIL'), 'Private Annals draft ready',
      'A consented submission requires private attention; no automatic publication was confirmed. Any manual publication requires your exact approval.\n\n' + reviewUrl + '?item=' + encodeURIComponent(folder.getName()));
    delivery = 'sent';
  } catch (e) {}
  annalsFile_(folder, 'draft-notice-private.json').setContent(JSON.stringify({ state: delivery, at: new Date().toISOString() }));
  return delivery === 'sent';
}
function annalsSafeTextForAutoAi_(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 6000) return false;
  return !/(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?:\/\/|www\.|(?:\+?1[- .]?)?\(?[2-9]\d{2}\)?[- .][2-9]\d{2}[- .]\d{4}|^\s*>|^\s*from:\s|^\s*sent:\s|^\s*subject:\s|^\s*--\s*$|\b(?:forwarded message|original message|confidential|private address|phone number|contact details)\b)/im.test(text);
}
function annalsSaveReview(nonce, id, rawEntry) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    var f = annalsFolder_(id);
    if (!annalsRead_(f, 'source-private.json') || annalsFile_(f, 'approval-private.json')) throw new Error('Item cannot be edited here');
    var entry = AnnalsProduction.publicEntry(rawEntry);
    if (entry.id !== 'annal-' + id.slice(0, 24)) throw new Error('Entry mismatch');
    var review = { entry: entry, hash: annalsHash_(AnnalsProduction.serial(entry)), savedAt: new Date().toISOString() };
    var file = annalsFile_(f, 'review-private.json');
    if (file) file.setContent(JSON.stringify(review)); else annalsWriteOnce_(f, 'review-private.json', review);
    return review;
  }); });
}
function annalsApproveReview(nonce, id, expectedHash, consents, evidenceNote, uncertaintiesReviewed) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    var f = annalsFolder_(id), review = annalsRead_(f, 'review-private.json');
    if (!review || review.hash !== expectedHash || annalsHash_(AnnalsProduction.serial(review.entry)) !== expectedHash ||
        uncertaintiesReviewed !== true || typeof evidenceNote !== 'string' || evidenceNote.trim().length < 10 || evidenceNote.length > 2000) throw new Error('Exact review and consent evidence required');
    var entry = AnnalsProduction.publicEntry(review.entry);
    var key = annalsProps_().getProperty('ANNALS_APPROVAL_KEY') || '';
    if (key.length < 32) throw new Error('Missing signing configuration');
    if (annalsFile_(f, 'approval-private.json')) throw new Error('Already approved; use the correction process for changes');
    var receipt = { entryId: entry.id, approvedAt: new Date().toISOString(), reviewedBy: annalsOwner_(),
      consents: AnnalsProduction.consents(entry, consents), contentSha256: review.hash };
    var signature = annalsHex_(Utilities.computeHmacSha256Signature(AnnalsProduction.serial({ entry: entry, receipt: receipt }), key, Utilities.Charset.UTF_8));
    receipt.signature = signature;
    var publication = annalsPublicApproval_(entry, receipt, annalsProps_().getProperty('ANNALS_PUBLISH_SIGNING_KEY') || '');
    var saved = { entry: entry, receipt: receipt, publication: publication,
      evidenceNote: evidenceNote, uncertaintiesReviewed: true, publicationState: 'approved_private_pending_publish' };
    annalsWriteOnce_(f, 'approval-private.json', saved);
    var sent = annalsDispatchApproved_(f, entry, publication, 'annals-approved-entry', 'publication-dispatch-private.json');
    saved.publicationState = sent ? 'dispatch_accepted' : 'dispatch_not_configured_or_held';
    var approvalFile = annalsFile_(f, 'approval-private.json');
    approvalFile.setContent(JSON.stringify(saved));
    return { approved: true, dispatchAccepted: sent, published: false };
  }); });
}
function annalsPublicApproval_(entry, receipt, key) {
  if (key.length < 32 || key === (annalsProps_().getProperty('ANNALS_APPROVAL_KEY') || '')) return null;
  var proof = { entryId: entry.id, approvedAt: receipt.approvedAt, consents: receipt.consents, contentSha256: receipt.contentSha256 };
  if (receipt.reviewedBy === 'standing-consent-automation-v1') proof.mode = AnnalsAuto.MODE;
  proof.signature = annalsHex_(Utilities.computeHmacSha256Signature(AnnalsProduction.serial({ entry: entry, approval: proof }), key, Utilities.Charset.UTF_8));
  return proof;
}
function annalsPublicRemoval_(entry, approvedAt, key) {
  if (key.length < 32 || key === (annalsProps_().getProperty('ANNALS_APPROVAL_KEY') || '')) return null;
  var proof = { entryId: entry.id, approvedAt: approvedAt, contentSha256: annalsHash_(AnnalsProduction.serial(entry)) };
  proof.signature = annalsHex_(Utilities.computeHmacSha256Signature(AnnalsProduction.serial({ operation: 'remove', removal: proof }), key, Utilities.Charset.UTF_8));
  return proof;
}
function annalsPrivateReceiptValid_(entry, receipt) {
  var key = annalsProps_().getProperty('ANNALS_APPROVAL_KEY') || '';
  if (!receipt || key.length < 32 || annalsHash_(AnnalsProduction.serial(entry)) !== receipt.contentSha256) return false;
  var unsigned = { entryId: receipt.entryId, approvedAt: receipt.approvedAt, reviewedBy: receipt.reviewedBy,
    consents: receipt.consents, contentSha256: receipt.contentSha256 };
  var expected = annalsHex_(Utilities.computeHmacSha256Signature(AnnalsProduction.serial({ entry: entry, receipt: unsigned }), key, Utilities.Charset.UTF_8));
  return expected === receipt.signature;
}
function annalsDispatchEvent_(folder, eventType, clientPayload, markerName) {
  var p = annalsProps_(), token = p.getProperty('ANNALS_GITHUB_TOKEN'), repo = p.getProperty('ANNALS_GITHUB_REPOSITORY');
  if (!token || (p.getProperty('ANNALS_PUBLISH_SIGNING_KEY') || '').length < 32 ||
      p.getProperty('ANNALS_PUBLISH_SIGNING_KEY') === p.getProperty('ANNALS_APPROVAL_KEY') ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '') ||
      ['annals-approved-entry','annals-auto-entry','annals-correct-entry','annals-remove-entry'].indexOf(eventType) < 0 || annalsFile_(folder, markerName)) return false;
  var marker = { state: 'attempt_reserved', at: new Date().toISOString() };
  var requestBody = JSON.stringify({ event_type: eventType, client_payload: clientPayload });
  if (Utilities.newBlob(requestBody, 'application/json').getBytes().length > 60000) return false;
  annalsWriteOnce_(folder, markerName, marker);
  var response;
  try {
    response = UrlFetchApp.fetch('https://api.github.com/repos/' + repo + '/dispatches', {
      method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      payload: requestBody,
      muteHttpExceptions: true, followRedirects: false, validateHttpsCertificates: true });
  } catch (e) { marker.state = 'unknown_no_retry'; annalsFile_(folder, markerName).setContent(JSON.stringify(marker)); return false; }
  try { marker.state = response.getResponseCode() === 204 ? 'accepted' : 'rejected_no_retry'; }
  catch (e) { marker.state = 'unknown_no_retry'; }
  marker.completedAt = new Date().toISOString();
  annalsFile_(folder, markerName).setContent(JSON.stringify(marker));
  return marker.state === 'accepted';
}
function annalsDispatchApproved_(folder, entry, approval, eventType, markerName) {
  if (!approval) return false;
  var payload = { entry: entry, approval: approval };
  if (entry.photo) {
    var derivative = annalsPhotoDerivative_(folder);
    if (!derivative || derivative.sha256 !== entry.photo.sha256 || derivative.size > 32768) return false;
    payload.imageBase64 = derivative.base64;
  }
  return annalsDispatchEvent_(folder, eventType, payload, markerName);
}
function annalsDispatchRemoval_(folder, entryId, approval) {
  if (!approval) return false;
  return annalsDispatchEvent_(folder, 'annals-remove-entry', { entryId: entryId, approval: approval }, 'removal-dispatch-private.json');
}
function annalsPublishApproved(nonce, id) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    var folder = annalsFolder_(id), saved = annalsRead_(folder, 'approval-private.json');
    if (!saved || annalsFile_(folder, 'publication-dispatch-private.json')) return { dispatchAccepted: false, retryAllowed: false };
    var receipt = saved.receipt, p = annalsProps_();
    if (!annalsPrivateReceiptValid_(saved.entry, receipt)) throw new Error('Private approval signature invalid');
    var publication = saved.publication || annalsPublicApproval_(saved.entry, receipt, p.getProperty('ANNALS_PUBLISH_SIGNING_KEY') || '');
    if (!publication) return { dispatchAccepted: false, retryAllowed: true };
    saved.publication = publication;
    saved.publicationState = 'approved_private_pending_publish';
    annalsFile_(folder, 'approval-private.json').setContent(JSON.stringify(saved));
    var accepted = annalsDispatchApproved_(folder, saved.entry, publication, 'annals-approved-entry', 'publication-dispatch-private.json');
    saved.publicationState = accepted ? 'dispatch_accepted' : 'dispatch_not_configured_or_held';
    annalsFile_(folder, 'approval-private.json').setContent(JSON.stringify(saved));
    return { dispatchAccepted: accepted, retryAllowed: false };
  }); });
}
function annalsSaveCorrection(nonce, id, rawEntry) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    var folder = annalsFolder_(id), original = annalsRead_(folder, 'approval-private.json');
    if (!original || original.publicationState !== 'dispatch_accepted' || annalsFile_(folder, 'removal-private.json') ||
        annalsFile_(folder, 'correction-approval-private.json') || !annalsPrivateReceiptValid_(original.entry, original.receipt)) throw new Error('Only a verified published entry can be corrected');
    var entry = AnnalsProduction.publicEntry(rawEntry);
    if (entry.id !== original.entry.id || AnnalsProduction.serial(entry) === AnnalsProduction.serial(original.entry)) throw new Error('Correction must change this exact entry');
    var review = { entry: entry, hash: annalsHash_(AnnalsProduction.serial(entry)), savedAt: new Date().toISOString() };
    var prior = annalsFile_(folder, 'correction-review-private.json');
    if (prior) prior.setContent(JSON.stringify(review)); else annalsWriteOnce_(folder, 'correction-review-private.json', review);
    return review;
  }); });
}
function annalsApproveCorrection(nonce, id, expectedHash, consents, evidenceNote, uncertaintiesReviewed) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    var folder = annalsFolder_(id), original = annalsRead_(folder, 'approval-private.json'), review = annalsRead_(folder, 'correction-review-private.json');
    if (!original || original.publicationState !== 'dispatch_accepted' || !review || review.hash !== expectedHash || expectedHash !== annalsHash_(AnnalsProduction.serial(review.entry)) ||
        annalsFile_(folder, 'correction-approval-private.json') || annalsFile_(folder, 'removal-private.json') ||
        uncertaintiesReviewed !== true || typeof evidenceNote !== 'string' || evidenceNote.trim().length < 10 || evidenceNote.length > 2000 ||
        !annalsPrivateReceiptValid_(original.entry, original.receipt)) throw new Error('Exact correction review and private evidence required');
    var entry = AnnalsProduction.publicEntry(review.entry), key = annalsProps_().getProperty('ANNALS_APPROVAL_KEY') || '';
    var receipt = { entryId: entry.id, approvedAt: new Date().toISOString(), reviewedBy: annalsOwner_(),
      consents: AnnalsProduction.consents(entry, consents), contentSha256: expectedHash };
    receipt.signature = annalsHex_(Utilities.computeHmacSha256Signature(AnnalsProduction.serial({ entry: entry, receipt: receipt }), key, Utilities.Charset.UTF_8));
    var publication = annalsPublicApproval_(entry, receipt, annalsProps_().getProperty('ANNALS_PUBLISH_SIGNING_KEY') || '');
    if (!publication) throw new Error('Separate public signing configuration required');
    var record = { entry: entry, receipt: receipt, publication: publication, evidenceNote: evidenceNote,
      uncertaintiesReviewed: true, publicationState: 'approved_correction_pending' };
    annalsWriteOnce_(folder, 'correction-approval-private.json', record);
    var sent = annalsDispatchApproved_(folder, entry, publication, 'annals-correct-entry', 'correction-dispatch-private.json');
    record.publicationState = sent ? 'dispatch_accepted' : 'dispatch_not_configured_or_held';
    annalsFile_(folder, 'correction-approval-private.json').setContent(JSON.stringify(record));
    return { approved: true, dispatchAccepted: sent };
  }); });
}
function annalsApproveRemoval(nonce, id, expectedHash, reason, confirmed) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    var folder = annalsFolder_(id), original = annalsRead_(folder, 'approval-private.json'), correction = annalsRead_(folder, 'correction-approval-private.json');
    var current = correction && correction.publicationState === 'dispatch_accepted' ? correction : original;
    if (!current || (correction && correction.publicationState !== 'dispatch_accepted') || current.publicationState !== 'dispatch_accepted' || !annalsPrivateReceiptValid_(current.entry, current.receipt) ||
        annalsFile_(folder, 'removal-private.json') ||
        expectedHash !== annalsHash_(AnnalsProduction.serial(current.entry)) || confirmed !== true ||
        typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 2000) throw new Error('Exact public entry and private removal reason required');
    var key = annalsProps_().getProperty('ANNALS_PUBLISH_SIGNING_KEY') || '', approvedAt = new Date().toISOString();
    var proof = annalsPublicRemoval_(current.entry, approvedAt, key);
    if (!proof) throw new Error('Separate public signing configuration required');
    var record = { entry: current.entry, proof: proof, reason: reason, reviewedBy: annalsOwner_(), approvedAt: approvedAt, state: 'approved_removal_pending' };
    annalsWriteOnce_(folder, 'removal-private.json', record);
    var sent = annalsDispatchRemoval_(folder, original.entry.id, proof);
    record.state = sent ? 'dispatch_accepted' : 'dispatch_not_configured_or_held';
    annalsFile_(folder, 'removal-private.json').setContent(JSON.stringify(record));
    return { approved: true, dispatchAccepted: sent };
  }); });
}
function annalsInstallIntakeSchedule() {
  annalsOwner_();
  if (annalsProps_().getProperty('ANNALS_PRODUCTION_INTAKE_ENABLED') !== 'true') throw new Error('Enable configured intake first');
  var p = annalsProps_();
  if (p.getProperty('ANNALS_AI_ENABLED') !== 'true' || !p.getProperty('ANNALS_OPENAI_API_KEY') || !p.getProperty('ANNALS_BUDGET_LEDGER') ||
      !p.getProperty('ANNALS_GITHUB_TOKEN') || (p.getProperty('ANNALS_PUBLISH_SIGNING_KEY') || '').length < 32 ||
      p.getProperty('ANNALS_PUBLISH_SIGNING_KEY') === p.getProperty('ANNALS_APPROVAL_KEY') || (p.getProperty('ANNALS_APPROVAL_KEY') || '').length < 32 || !p.getProperty('ANNALS_GITHUB_REPOSITORY') ||
      !p.getProperty('ANNALS_REVIEW_URL') || !Number.isFinite(Date.parse(p.getProperty('ANNALS_ACTIVATED_AT'))) ||
      !AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || '').length) throw new Error('Private drafting and approved publication configuration incomplete');
  annalsRoot_();
  var existing = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'runAnnalsProductionIntake'; });
  if (existing.length > 1) throw new Error('Review duplicate intake triggers');
  if (!existing.length) ScriptApp.newTrigger('runAnnalsProductionIntake').timeBased().everyMinutes(15).create();
  return { scheduled: true, intervalMinutes: 15, automaticAi: true, automaticPublication: p.getProperty('ANNALS_AUTO_PUBLICATION_ENABLED') === 'true' ? 'standing-consent source-grounded text only' : 'disabled' };
}
function annalsStopProduction() {
  annalsOwner_();
  return annalsLocked_(function () {
    var p = annalsProps_();
    p.setProperty('ANNALS_PRODUCTION_INTAKE_ENABLED', 'false');
    p.setProperty('ANNALS_AI_ENABLED', 'false');
    p.setProperty('ANNALS_AUTO_PUBLICATION_ENABLED', 'false');
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'runAnnalsProductionIntake') ScriptApp.deleteTrigger(t);
    });
    return { intakeEnabled: false, aiEnabled: false };
  });
}
