/* Private production CANDIDATE. Copy with PilotCore, ProductionCore and ReviewUi
 * into a separate owner-only Apps Script project. See production runbook.
 * No GitHub publishing or email sending is implemented in this candidate.
 */
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
    hasBudgetLedger: !!p.getProperty('ANNALS_BUDGET_LEDGER'), publishesAnything: false, sendsMail: false };
  console.log(JSON.stringify(result)); return result;
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
  var attachments = message.getAttachments({ includeInlineImages: false, includeAttachments: true });
  var source = AnnalsPilot.privateProposal({ sourceId: id, from: sender, subject: message.getSubject(),
    body: message.getPlainBody(), receivedAt: message.getDate().toISOString(),
    attachments: attachments.map(function (a) { return { mime: a.getContentType(), size: a.getSize() }; }) });
  if (source.attachmentManifest.reason !== 'total_attachments_too_large') {
    source.attachmentManifest.items.forEach(function (a) {
      if (a.accepted && !annalsFile_(folder, a.storageName)) annalsPrivate_(folder.createFile(attachments[a.index - 1].copyBlob().setName(a.storageName)));
    });
  }
  source.senderAuthenticated = false; // From is triage only, never an AI or publication permission.
  annalsWriteOnce_(folder, 'source-private.json', source);
  return source.requiresClarification ? 'held' : 'staged';
}
/** Bounded inbox traversal; no mail, labels or read/unread state is changed.
 * A saved thread/message position is resumed on the next run, then wraps.
 */
function runAnnalsProductionIntake() {
  var p = annalsProps_(), summary = { enabled: false, staged: 0, held: 0, duplicates: 0, skipped: 0 };
  if (p.getProperty('ANNALS_PRODUCTION_INTAKE_ENABLED') !== 'true') return summary;
  try {
    return annalsLocked_(function () {
      if (Session.getEffectiveUser().getEmail().toLowerCase() !== (p.getProperty('ANNALS_OWNER_EMAIL') || '').toLowerCase()) throw new Error('Wrong account');
      var activation = Date.parse(p.getProperty('ANNALS_ACTIVATED_AT'));
      var allowed = AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || '');
      if (!Number.isFinite(activation) || activation > Date.now() || !allowed.length) throw new Error('Intake configuration incomplete');
      annalsRoot_();
      var cursor = JSON.parse(p.getProperty('ANNALS_INBOX_CURSOR') || '{"offset":0,"message":0,"threadId":null}');
      if (!Number.isSafeInteger(cursor.offset) || cursor.offset < 0 || !Number.isSafeInteger(cursor.message) || cursor.message < 0) throw new Error('Invalid cursor');
      var thread = cursor.threadId ? GmailApp.getThreadById(cursor.threadId) : GmailApp.getInboxThreads(cursor.offset, 1)[0];
      if (!thread) { p.deleteProperty('ANNALS_INBOX_CURSOR'); return summary; }
      summary.enabled = true;
      cursor.threadId = thread.getId();
      var messages = thread.getMessages(), end = Math.min(messages.length, cursor.message + 10);
      for (var i = cursor.message; i < end; i++) {
        summary[annalsStageProduction_(messages[i], activation, allowed)]++;
        cursor.message = i + 1;
        p.setProperty('ANNALS_INBOX_CURSOR', JSON.stringify(cursor));
      }
      if (end >= messages.length) p.setProperty('ANNALS_INBOX_CURSOR', JSON.stringify({ offset: cursor.offset + 1, message: 0, threadId: null }));
      console.log(JSON.stringify(summary)); return summary;
    });
  } catch (e) { throw new Error('Private intake stopped; review account configuration privately'); }
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
function annalsReviewList(nonce, continuation) {
  return annalsUiCall_(nonce, function () {
    annalsRoot_();
    var folders = continuation ? DriveApp.continueFolderIterator(continuation) : annalsRoot_().getFolders(), items = [], checked = 0;
    while (folders.hasNext() && checked++ < 30) {
      var f = annalsPrivate_(folders.next()), id = f.getName();
      if (!/^[a-f0-9]{64}$/.test(id)) continue;
      var source = annalsRead_(f, 'source-private.json');
      if (!source) continue;
      items.push({ id: id, subject: source.source.subject, receivedAt: source.source.receivedAt,
        state: annalsFile_(f, 'approval-private.json') ? 'Approved for export' :
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
    var names = source.attachmentManifest.items.filter(function (a) { return a.accepted && annalsFile_(f, a.storageName); })
      .map(function (a) { return { name: a.storageName, mime: a.mime, size: a.size }; });
    return { id: id, subject: source.source.subject, text: source.source.excerpt, receivedAt: source.source.receivedAt,
      truncated: source.source.excerptTruncated, attachments: names, folderUrl: f.getUrl(),
      draft: annalsRead_(f, 'draft-private.json'), review: annalsRead_(f, 'review-private.json'),
      outcome: annalsRead_(f, 'ai-outcome-private.json'),
      attempted: !!annalsFile_(f, 'ai-attempt-private.json'), approved: !!annalsFile_(f, 'approval-private.json') };
  });
}
function annalsPrepareDraft(nonce, id, text, selectedNames, consent) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
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
  }); });
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
    annalsWriteOnce_(f, 'approval-private.json', { entry: entry, receipt: receipt,
      evidenceNote: evidenceNote, uncertaintiesReviewed: true, publicationState: 'approved_private_export_only' });
    return { approved: true, published: false };
  }); });
}
function annalsExportApproved(nonce, id) {
  return annalsUiCall_(nonce, function () {
    var f = annalsFolder_(id), approved = annalsRead_(f, 'approval-private.json');
    if (!approved) throw new Error('No approval');
    // Download remains private: reviewer identity and signature are not public data.
    return { entries: [approved.entry], receipts: [approved.receipt] };
  });
}
function annalsInstallIntakeSchedule() {
  annalsOwner_();
  if (annalsProps_().getProperty('ANNALS_PRODUCTION_INTAKE_ENABLED') !== 'true') throw new Error('Enable configured intake first');
  annalsRoot_();
  var existing = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'runAnnalsProductionIntake'; });
  if (existing.length > 1) throw new Error('Review duplicate intake triggers');
  if (!existing.length) ScriptApp.newTrigger('runAnnalsProductionIntake').timeBased().everyMinutes(15).create();
  return { scheduled: true, intervalMinutes: 15, automaticAi: false, automaticPublication: false };
}
function annalsStopProduction() {
  annalsOwner_();
  return annalsLocked_(function () {
    var p = annalsProps_();
    p.setProperty('ANNALS_PRODUCTION_INTAKE_ENABLED', 'false');
    p.setProperty('ANNALS_AI_ENABLED', 'false');
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'runAnnalsProductionIntake') ScriptApp.deleteTrigger(t);
    });
    return { intakeEnabled: false, aiEnabled: false };
  });
}

