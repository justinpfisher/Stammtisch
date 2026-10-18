/* Private production automation. Owner-only Apps Script project. */
function annalsProps_() { return PropertiesService.getScriptProperties(); }
function annalsHex_(bytes) { return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
function annalsHash_(value) { return annalsHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)); }
function annalsOwner_() {
  return AnnalsProduction.owner(Session.getActiveUser().getEmail(), Session.getEffectiveUser().getEmail(),
    annalsProps_().getProperty('ANNALS_OWNER_EMAIL'));
}
function annalsServiceOwner_() {
  var owner = annalsProps_().getProperty('ANNALS_OWNER_EMAIL');
  var effective = Session.getEffectiveUser().getEmail();
  if (!owner || !effective || effective.toLowerCase() !== owner.toLowerCase())
    throw new Error('Wrong private service owner');
  return owner.toLowerCase();
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
  // Require one unambiguous Google result. The configured Porkbun forwarding
  // hop adds its own result; it is never used to establish sender authenticity.
  if (typeof message.getRawContent !== 'function') return false;
  var raw = String(message.getRawContent() || '').replace(/\r\n?/g, '\n'), boundary = raw.search(/\n\n/);
  if (boundary < 0) return false;
  var lines = raw.slice(0, boundary).replace(/\n?\n[ \t]+/g, ' ').split(/\n?\n/), results = [];
  lines.forEach(function (line) { if (/^authentication-results:/i.test(line)) results.push(line.replace(/^authentication-results:\s*/i, '')); });
  if (results.length === 2) {
    var googleReceiver = lines.filter(function (line) { return /^received:/i.test(line) && /\bby mx\.google\.com(?:[\s;(]|$)/i.test(line); })[0] || '';
    if (!/^mx\.google\.com(?:[\s;]|$)/i.test(results[0]) ||
        !/^fwd1\.porkbun\.com(?:[\s;]|$)/i.test(results[1]) ||
        !/^received:\s*from fwd1\.porkbun\.com(?:[\s(]|$)/i.test(googleReceiver)) return false;
  } else if (results.length !== 1) return false;
  var header = results[0].toLowerCase();
  var domain = String(sender.split('@')[1] || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!header || !/^mx\.google\.com(?:[\s;]|$)/.test(header) || !domain) return false;
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
  return !!permission && permission.status === 'active' &&
    ['future_source_grounded_text_publication','future_source_grounded_text_and_screened_image_publication'].indexOf(permission.scope) >= 0 &&
    !permission.revokedAt && Number.isFinite(activated) && Number.isFinite(received) && received >= activated;
}
function annalsImageConsentActive_(sender, receivedAt) {
  sender = String(sender || '').toLowerCase();
  if (!annalsStandingPublicationActive_(sender, receivedAt)) return false;
  var member = annalsConsentRegistry_().members[sender];
  var textGrant = member && member.autoPublication;
  if (member && member.imagePublication && member.imagePublication.status==='revoked')return false;
  if (textGrant && textGrant.scope === 'future_source_grounded_text_and_screened_image_publication' &&
      textGrant.status === 'active' && !textGrant.revokedAt) return true;
  // Existing text-only members can add image permission without renewing AI consent.
  var permission = member && member.imagePublication;
  var granted = Date.parse(permission && permission.consentedAt);
  var received = Date.parse(receivedAt);
  return !!permission && permission.status === 'active' &&
    permission.scope === 'future_safe_original_image_ai_and_publication' &&
    !permission.revokedAt && Number.isFinite(granted) && Number.isFinite(received) && received >= granted;
}
/** Map private member senders to the six existing, public Annals speaker images.
 * The exact email-to-portrait assignment never enters the public repo.
 */
function annalsReviewSpeakerIdentities(nonce) {
  return annalsUiCall_(nonce, function () {
    var p = annalsProps_(), allowed = AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || '');
    var mapping = null;
    try { mapping = AnnalsProduction.portraitMap(allowed,
      JSON.parse(p.getProperty('ANNALS_SPEAKER_IDENTITIES') || 'null')); }
    catch (ignored) {}
    return { configured: !!mapping, assignments: allowed.map(function (address) {
      return { address: address, portrait: mapping ? mapping[address] : '' };
    }), options: [{id:'fish',label:'Justin (Fish)'},{id:'marc',label:'Marc'},
      {id:'matt',label:'Matt'},{id:'ken',label:'Ken'},
      {id:'jamie',label:'Jamie'},{id:'jerome',label:'Jerome'}] };
  });
}
function annalsSaveSpeakerIdentities(nonce, assignments, confirmed) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    if (confirmed !== true || !Array.isArray(assignments) || assignments.length !== 6)
      throw new Error('Verify exactly six distinct private member speaker identities');
    var p = annalsProps_();
    if (p.getProperty('ANNALS_PRODUCTION_INTAKE_ENABLED') === 'true' ||
        p.getProperty('ANNALS_AI_ENABLED') === 'true' ||
        p.getProperty('ANNALS_AUTO_PUBLICATION_ENABLED') === 'true' ||
        p.getProperty('ANNALS_AUTO_MEDIA_ENABLED') === 'true')
      throw new Error('Stop Annals automation before changing speaker identities');
    var allowed = AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || ''), mapping = {};
    assignments.forEach(function (item) {
      if (!item || typeof item.address !== 'string' || typeof item.portrait !== 'string' ||
          Object.keys(item).some(function (key) {return ['address','portrait'].indexOf(key) < 0;}) ||
          Object.prototype.hasOwnProperty.call(mapping,item.address))
        throw new Error('Invalid or repeated speaker identity');
      mapping[item.address] = item.portrait;
    });
    var validated = AnnalsProduction.portraitMap(allowed,mapping);
    p.setProperty('ANNALS_SPEAKER_IDENTITIES',JSON.stringify(validated));
    return {configured:true,speakerCount:6,publicAddressesSaved:false};
  }); });
}
/** Speaker permissions are independent of the email contributor's grant.
 * The six email-to-art identities and standing quote rights remain private.
 * A permission must predate the submitted quotation and still be unrevoked.
 */
/** Use only a verified contributor's public Annals artwork, never email identity. */
function annalsContributorPortrait_(source) {
  if (!source || !source.senderAuthenticated || !source.source ||
      typeof source.source.sender !== 'string') return null;
  var sender = source.source.sender.toLowerCase(), received = source.source.receivedAt;
  if (!annalsStandingPublicationActive_(sender,received)) return null;
  var p = annalsProps_(), allowed = AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || '');
  var mapping;
  try { mapping = AnnalsProduction.portraitMap(allowed,
    JSON.parse(p.getProperty('ANNALS_SPEAKER_IDENTITIES') || 'null')); }
  catch (ignored) { return null; }
  var member = annalsConsentRegistry_().members[sender],
    grant = member && member.contributorPortraitPublication;
  var grantedAt = Date.parse(grant && grant.consentedAt), receivedAt = Date.parse(received);
  // A distinct owner-verified, separately revocable contributor portrait grant is necessary;
  // knowing the email address or having generic text consent is insufficient.
  if (!mapping[sender] || !member || member.portraitAttributionDisabled === true ||
      !grant || grant.status !== 'active' || grant.revokedAt ||
      grant.scope !== 'future_illustrated_contributor_identification' ||
      !Number.isFinite(grantedAt) || !Number.isFinite(receivedAt) ||
      grantedAt > receivedAt) return null;
  return mapping[sender];
}
function annalsQuoteSpeakerPermission_(source, draft) {
  if (!source || !source.senderAuthenticated || !source.source || !draft ||
      draft.category !== 'quotation') return null;
  var evidence = AnnalsAuto.quotationEvidence(source.source.subject || '',
    source.source.excerpt || '', draft.quoteVerbatim || '', draft.interpretation);
  if (!evidence) return null;
  var p = annalsProps_(), allowed = AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || '');
  var mapping;
  try { mapping = AnnalsProduction.portraitMap(allowed,
      JSON.parse(p.getProperty('ANNALS_SPEAKER_IDENTITIES') || 'null')); }
  catch (ignored) { return null; }
  var portrait = evidence.self ? mapping[String(source.source.sender || '').toLowerCase()] : evidence.speakerPortrait;
  if (!portrait || (!evidence.self && evidence.speakerPortrait !== portrait)) return null;
  var speakerAddress = allowed.filter(function (address) { return mapping[address] === portrait; })[0];
  if (!speakerAddress) return null;
  var member = annalsConsentRegistry_().members[speakerAddress], grant = member && member.quoteAttribution;
  var date = Date.parse(source.source.receivedAt), grantedAt = Date.parse(grant && grant.consentedAt);
  if (!member || member.portraitAttributionDisabled === true ||
      !annalsStandingPublicationActive_(speakerAddress, source.source.receivedAt) || !grant ||
      grant.status !== 'active' || grant.scope !== 'future_attributed_member_quotation_publication' ||
      grant.revokedAt || !Number.isFinite(date) || !Number.isFinite(grantedAt) ||
      date < grantedAt) return null;
  return { speakerPortrait: portrait };
}
/** Consent for illustrated credits on NON-quotation Annals entries, separate
 * from permissions to attribute quotes spoken by other people.
 */
function annalsRecordVerifiedContributorPortraitPermissions(nonce, confirmed, evidenceNote) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    if (confirmed !== true || typeof evidenceNote !== 'string' ||
        evidenceNote.trim().length < 18 || evidenceNote.length > 1000)
      throw new Error('Evidence of six explicit illustrated contributor permissions required');
    var p = annalsProps_();
    if (p.getProperty('ANNALS_PRODUCTION_INTAKE_ENABLED') === 'true' ||
        p.getProperty('ANNALS_AUTO_PUBLICATION_ENABLED') === 'true' ||
        p.getProperty('ANNALS_AI_ENABLED') === 'true' ||
        p.getProperty('ANNALS_AUTO_MEDIA_ENABLED') === 'true')
      throw new Error('Stop all Annals automation before recording illustration rights');
    var allowed = AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || '');
    if (allowed.length !== 6) throw new Error('Six exact allowed contributor addresses required');
    AnnalsProduction.portraitMap(allowed,
      JSON.parse(p.getProperty('ANNALS_SPEAKER_IDENTITIES') || 'null'));
    var root = annalsRoot_(), registry = annalsConsentRegistry_();
    if (annalsFile_(root,'verified-contributor-portraits-private.json'))
      throw new Error('Prior private contributor portrait registration exists; inspect before retrying');
    allowed.forEach(function (address) {
      var member = registry.members[address];
      if (!member || member.status !== 'active' || member.revokedAt ||
          !member.autoPublication || member.autoPublication.status !== 'active' ||
          member.autoPublication.revokedAt || member.portraitAttributionDisabled ||
          member.contributorPortraitPublication &&
            (member.contributorPortraitPublication.status === 'revoked' ||
             member.contributorPortraitPublication.revokedAt))
        throw new Error('Revoked or unverified member permission cannot be overridden');
    });
    var now = new Date().toISOString(), marker = {
      state:'attempt_reserved',at:now,memberCount:6,
      method:'owner_attested_existing_individual_contributor_portrait_permission',
      scope:'future_illustrated_contributor_identification',
      evidenceNote:evidenceNote.trim()
    };
    annalsWriteOnce_(root,'verified-contributor-portraits-private.json',marker);
    allowed.forEach(function (address) {
      registry.members[address].contributorPortraitPublication = {
        status:'active',scope:'future_illustrated_contributor_identification',
        consentedAt:now,source:'owner_attested_prior_direct_permission'
      };
    });
    annalsSavePrivate_(root,'consent-registry-private.json',registry);
    marker.state='consents_recorded';
    annalsFile_(root,'verified-contributor-portraits-private.json').setContent(JSON.stringify(marker));
    allowed.forEach(function (address) {
      try { GmailApp.sendEmail(address,'Stammtisch Annals — illustrated contributor credit',
        'The Club owner has recorded your earlier permission for the approved illustrated likeness to identify your eligible future Annals contributions without displaying your email address or visible name. This is separate from your quotation-speaker permission. To hide future portraits, email HIDE MY ANNALS PORTRAIT. Public GitHub history can retain earlier copies; contact the Club owner for corrections or withdrawal.'); }
      catch (ignored) { /* Never fabricate delivery evidence. */ }
    });
    return {recorded:true,memberCount:6,privateOnly:true,automationActivated:false};
  }); });
}
function annalsRecordVerifiedQuotePermissions(nonce, confirmed, evidenceNote) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    if (confirmed !== true || typeof evidenceNote !== 'string' ||
        evidenceNote.trim().length < 18 || evidenceNote.length > 1000)
      throw new Error('Confirm six members expressly permitted identified quotations by other contributors');
    var p = annalsProps_();
    if (p.getProperty('ANNALS_PRODUCTION_INTAKE_ENABLED') === 'true' ||
        p.getProperty('ANNALS_AUTO_PUBLICATION_ENABLED') === 'true' ||
        p.getProperty('ANNALS_AI_ENABLED') === 'true' ||
        p.getProperty('ANNALS_AUTO_MEDIA_ENABLED') === 'true')
      throw new Error('Disable Annals automation before recording speaker permissions');
    var allowed = AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || '');
    if (allowed.length !== 6) throw new Error('Exactly six private contributors are required');
    AnnalsProduction.portraitMap(allowed,
      JSON.parse(p.getProperty('ANNALS_SPEAKER_IDENTITIES') || 'null'));
    var root = annalsRoot_(), registry = annalsConsentRegistry_();
    if (annalsFile_(root, 'verified-quote-speaker-consents-private.json'))
      throw new Error('Quote permission attestation already recorded; inspect the private evidence');
    allowed.forEach(function (address) {
      var member = registry.members[address];
      if (!member || member.status !== 'active' || member.revokedAt ||
          !member.autoPublication || member.autoPublication.status !== 'active' ||
          member.autoPublication.revokedAt || member.portraitAttributionDisabled ||
          member.quoteAttribution && (member.quoteAttribution.status === 'revoked' || member.quoteAttribution.revokedAt))
        throw new Error('Revoked or missing individual consent cannot be reinstated by owner attestation');
    });
    var now = new Date().toISOString();
    var marker = { state:'attempt_reserved', at:now,
      evidenceNote:evidenceNote.trim(), speakerCount:6,
      scope:'future_attributed_member_quotation_publication',
      method:'owner_attested_existing_individual_quote_permission' };
    annalsWriteOnce_(root, 'verified-quote-speaker-consents-private.json', marker);
    allowed.forEach(function (address) {
      registry.members[address].quoteAttribution = {
        status:'active',scope:'future_attributed_member_quotation_publication',
        consentedAt:now,source:'owner_attested_existing_direct_quote_permission'
      };
    });
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    marker.state = 'speaker_permissions_recorded';
    annalsFile_(root, 'verified-quote-speaker-consents-private.json').setContent(JSON.stringify(marker));
    allowed.forEach(function (address) {
      try { GmailApp.sendEmail(address, 'Stammtisch Register of Remarks — speaker permission',
        'The Club owner has recorded your previously confirmed permission for your attributed quotations ' +
        'to be published when another approved member submits the exact wording. ' +
        'Your already-approved illustration may appear beside the quote. A separate contributor-portrait permission covers other entries. Public GitHub history may ' +
        'retain copies after corrections. To stop future attributed quote publication email ' +
        'REVOKE ANNALS QUOTE ATTRIBUTION. To opt out of the artwork separately, email HIDE MY ANNALS PORTRAIT. Contact the Club owner to request corrections or removal.'); }
      catch (ignored) { /* Never fabricate a delivered notice. */ }
    });
    return {recorded:true,speakerCount:6,evidenceStorage:'private_only',activationChanged:false};
  }); });
}
function annalsHandleConsentReply_(sender, body) {
  var root = annalsRoot_(), registry = annalsConsentRegistry_(), member = registry.members[sender.toLowerCase()];
  var text = String(body || '').split(/\n?\n/).map(function (line) { return line.trim(); }).filter(Boolean)[0] || '';
  if (member && member.photoSubjects && text === 'REVOKE ANNALS PHOTO DEPICTION') {
    member.photoSubjects.status='revoked';member.photoSubjects.revokedAt=new Date().toISOString();
    annalsSavePrivate_(root,'consent-registry-private.json',registry);
    GmailApp.sendEmail(sender,'Annals photographic depiction revoked','Future group photographs are held. Contact the owner for correction or withdrawal of existing entries.');
    return 'image_consent_revoked';
  }
  if (member && text === 'HIDE MY ANNALS PORTRAIT') {
    member.portraitAttributionDisabled = true;
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    GmailApp.sendEmail(sender, 'Annals portrait attribution disabled',
      'Future Annals entries and quotations will not display your illustrated likeness. Already published entries require correction or withdrawal.');
    return 'portrait_hidden';
  }
  if (member && text === 'SHOW MY ANNALS PORTRAIT' &&
      annalsStandingPublicationActive_(sender,new Date().toISOString()) &&
      ((member.quoteAttribution && member.quoteAttribution.status === 'active' &&
        !member.quoteAttribution.revokedAt) ||
       (member.contributorPortraitPublication &&
        member.contributorPortraitPublication.status === 'active' &&
        !member.contributorPortraitPublication.revokedAt))) {
    member.portraitAttributionDisabled = false;
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    GmailApp.sendEmail(sender, 'Annals portrait attribution enabled',
      'Your approved illustration can accompany future eligible Annals entries and quotations. To opt out, email HIDE MY ANNALS PORTRAIT.');
    return 'portrait_enabled';
  }
  if (member && text === 'REVOKE ANNALS QUOTE ATTRIBUTION' &&
      member.quoteAttribution && member.quoteAttribution.status === 'active') {
    member.quoteAttribution.status = 'revoked';
    member.quoteAttribution.revokedAt = new Date().toISOString();
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    GmailApp.sendEmail(sender, 'Register of Remarks — quotation permission revoked',
      'Future public quotations attributed to you are disabled. Existing public entries may remain in GitHub history; contact the Club owner for corrections or withdrawal.');
    return 'quote_attribution_revoked';
  }
  if (member && member.imagePublication && member.imagePublication.status === 'pending' &&
      text === 'I CONSENT TO PRIVATE AI IMAGE SCREENING AND PUBLICATION OF MY SAFE ORIGINAL IMAGES. CODE: ' +
        member.imagePublication.challenge) {
    member.imagePublication.status = 'active';
    member.imagePublication.scope = 'future_safe_original_image_ai_and_publication';
    member.imagePublication.consentedAt = new Date().toISOString();
    delete member.imagePublication.challenge;
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    GmailApp.sendEmail(sender, 'Annals image consent recorded',
      'Your optional standing permission for private AI image screening and automatic publication of safe, metadata-stripped derivatives is active. Images with people, private locations, third-party rights or uncertain details remain private. To revoke future image publication send the exact line: REVOKE ANNALS IMAGE PUBLICATION. Public history may persist after withdrawal.');
    return 'image_consent_activated';
  }
  if (member && member.imagePublication && member.imagePublication.status === 'active' &&
      text === 'REVOKE ANNALS IMAGE PUBLICATION') {
    member.imagePublication.status = 'revoked';
    member.imagePublication.revokedAt = new Date().toISOString();
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    GmailApp.sendEmail(sender, 'Annals image consent revoked',
      'Future automatic image screening and publication are disabled. Contact the owner to request withdrawal of already published material.');
    return 'image_consent_revoked';
  }
  if (member && member.autoPublication && member.autoPublication.status === 'pending' &&
      text === (member.autoPublication.scope === 'future_source_grounded_text_and_screened_image_publication'
        ? 'I CONSENT TO AUTOMATIC PUBLIC ANNALS TEXT AND SCREENED PHOTO PUBLICATION. CODE: '
        : 'I CONSENT TO AUTOMATIC PUBLIC ANNALS TEXT PUBLICATION. CODE: ') + member.autoPublication.challenge) {
    member.autoPublication.status = 'active';
    member.autoPublication.scope = member.autoPublication.scope === 'future_source_grounded_text_and_screened_image_publication'
      ? 'future_source_grounded_text_and_screened_image_publication' : 'future_source_grounded_text_publication';
    member.autoPublication.consentedAt = new Date().toISOString();
    delete member.autoPublication.challenge;
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    GmailApp.sendEmail(sender, 'Annals automatic publication consent recorded',
      'Your separate standing permission for eligible future text submissions is active. The public website and GitHub history are accessible to everyone and old copies may remain after withdrawal. Unsafe or uncertain material stays private. You can revoke future automatic publication by emailing the exact line: REVOKE ANNALS AUTOMATIC PUBLICATION. You may also revoke private AI processing separately.');
    return 'auto_consent_activated';
  }
  if (member && member.autoPublication && member.autoPublication.status === 'active' &&
      text === 'REVOKE ANNALS AUTOMATIC PUBLICATION') {
    member.autoPublication.status = 'revoked';
    member.autoPublication.revokedAt = new Date().toISOString();
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    GmailApp.sendEmail(sender, 'Annals automatic publication consent revoked',
      'Future automatic publication is disabled. Existing public entries and GitHub history are not erased. Contact the club owner to request a withdrawal.');
    return 'auto_consent_revoked';
  }
  if (member && member.status === 'pending' && text === 'I CONSENT TO PRIVATE AI DRAFTING FOR FUTURE TEXT SUBMISSIONS. CODE: ' + member.challenge) {
    member.status = 'active'; member.scope = 'future_text_ai_drafting'; member.consentedAt = new Date().toISOString(); delete member.challenge;
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    GmailApp.sendEmail(sender, 'Annals processing consent recorded', 'Your one-time consent is recorded for private AI drafting of future text submissions. You may revoke it at any time by replying exactly: REVOKE ANNALS AI PROCESSING. Public publication requires either your separate standing automatic-publication consent for narrowly eligible text or separate exact owner approval.');
    return 'consent_activated';
  }
  if (member && member.status === 'active' && text === 'REVOKE ANNALS AI PROCESSING') {
    member.status = 'revoked'; member.revokedAt = new Date().toISOString();
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    GmailApp.sendEmail(sender, 'Annals processing consent revoked', 'Future submissions will no longer be sent for AI drafting. Existing drafts remain private for owner review.');
    return 'consent_revoked';
  }
  return null;
}
function annalsAckOnce_(folder, sender, itemId, state) {
  if (annalsFile_(folder, 'acknowledgement-private.json')) return false;
  var record = { at: new Date().toISOString(), state: state, delivery: 'attempted_once' };
  annalsWriteOnce_(folder, 'acknowledgement-private.json', record);
  try {
    GmailApp.sendEmail(sender, 'Annals submission received',
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
    autoMediaEnabled: p.getProperty('ANNALS_AUTO_MEDIA_ENABLED') === 'true',
    standingPublicationRequiresContributorConsent: true,
    quoteSpeakerIdentitiesConfigured: (function () {
      try {return !!AnnalsProduction.portraitMap(
        AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || ''),
        JSON.parse(p.getProperty('ANNALS_SPEAKER_IDENTITIES') || 'null')); }
      catch (ignored) {return false;}
    })(),
    quoteSpeakerConsentsRecorded: (function () {
      try {var list=AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || ''),
        members=annalsConsentRegistry_().members;
        return list.length===6&&list.every(function (a) {
          var q=members[a]&&members[a].quoteAttribution;
          return q && q.status==='active'&&!q.revokedAt;
        });}catch(ignored){return false;}
    })(),
    contributorPortraitConsentsRecorded: (function () {
      try {var list=AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || ''),
        members=annalsConsentRegistry_().members;
        return list.length===6&&list.every(function (a) {
          var q=members[a]&&members[a].contributorPortraitPublication;
          return !!q&&q.status==='active'&&!q.revokedAt;
        });}catch(ignored){return false;}
    })(),
    sendsAcknowledgements: true };
  console.log(JSON.stringify(result)); return result;
}
function annalsStampProductionActivation() {
  annalsOwner_();
  var p = annalsProps_();
  if (p.getProperty('ANNALS_PRODUCTION_INTAKE_ENABLED') === 'true' || p.getProperty('ANNALS_AI_ENABLED') === 'true' || p.getProperty('ANNALS_AUTO_PUBLICATION_ENABLED') === 'true' || p.getProperty('ANNALS_AUTO_MEDIA_ENABLED') === 'true') throw new Error('Disable intake and AI before recording the activation boundary');
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
/** Resolve a sender to its existing allowlisted identity.
 * Gmail ignores dots in personal @gmail.com local parts. No other domain or
 * plus-address alias is normalized, and collisions fail closed.
 */
function annalsResolveAllowedSender_(sender, allowed) {
  sender = String(sender || '').trim().toLowerCase();
  if (!sender || !Array.isArray(allowed)) return null;
  var exact = allowed.filter(function (identity) {
    return String(identity || '').trim().toLowerCase() === sender;
  });
  if (exact.length === 1) return String(exact[0]).trim().toLowerCase();
  if (exact.length > 1) return null;
  var at = sender.lastIndexOf('@');
  if (at <= 0 || sender.slice(at + 1) !== 'gmail.com') return null;
  var local = sender.slice(0, at).replace(/\./g, '');
  var matches = [];
  allowed.forEach(function (identity) {
    identity = String(identity || '').trim().toLowerCase();
    var split = identity.lastIndexOf('@');
    if (split <= 0 || identity.slice(split + 1) !== 'gmail.com' ||
        identity.slice(0, split).replace(/\./g, '') !== local) return;
    if (matches.indexOf(identity) === -1) matches.push(identity);
  });
  return matches.length === 1 ? matches[0] : null;
}
function annalsStageProduction_(message, activation, allowed) {
  var authenticatedSender = AnnalsPilot.senderAddress(message.getFrom());
  var sender = annalsResolveAllowedSender_(authenticatedSender, allowed);
  if (!sender || message.getDate().getTime() < activation ||
      /^\[ANNALS SYNTHETIC PILOT\]/.test(message.getSubject())) return 'skipped';
  var id = annalsHash_(message.getId()), folder = annalsFolder_(id, true);
  if (annalsFile_(folder, 'quarantine-private.json') ||
      annalsFile_(folder, 'intake-staging-error-private.json')) return 'held';
  if (annalsRead_(folder, 'source-private.json')) return 'duplicates';
  var authenticated = annalsAuthentication_(message, authenticatedSender);
  var originalSubject=message.getSubject(), originalBody=message.getPlainBody();
  if (authenticated) {
    var consentResult = annalsHandleConsentReply_(sender, originalBody);
    if (consentResult) return consentResult;
    var firstLine = String(originalBody || '').trim().split(/\n?\n/)[0] || '';
    if (/^(?:I CONSENT TO |REVOKE ANNALS |HIDE MY ANNALS PORTRAIT|SHOW MY ANNALS PORTRAIT)/.test(firstLine)) return 'held'; // invalid/stale challenges are not submissions
  }
  var attachments = message.getAttachments({ includeInlineImages: true, includeAttachments: true });
  var source = AnnalsPilot.privateProposal({ sourceId: id, from: authenticated ? sender : authenticatedSender, subject: originalSubject,
    body: originalBody, receivedAt: message.getDate().toISOString(),
    attachments: attachments.map(function (a) { return { mime: a.getContentType(), size: a.getSize() }; }) });
  if (source.attachmentManifest.reason !== 'total_attachments_too_large') {
    source.attachmentManifest.items.forEach(function (a) {
      if (a.accepted && !annalsFile_(folder, a.storageName)) annalsPrivate_(folder.createFile(attachments[a.index - 1].copyBlob().setName(a.storageName)));
    });
  }
  source.senderAuthenticated = authenticated;
  source.aiConsentActive = source.senderAuthenticated && annalsConsentActive_(sender);
  source.autoConsentAtReceipt = source.senderAuthenticated && annalsStandingPublicationActive_(sender, message.getDate().toISOString());
  source.imageConsentAtReceipt = source.senderAuthenticated && annalsImageConsentActive_(sender, message.getDate().toISOString());
  var original={subject:originalSubject,body:originalBody,receivedAt:message.getDate().toISOString()};
  var captured=annalsRead_(folder,'original-email-private.json');
  if(captured){
    if(AnnalsProduction.serial(captured)!==AnnalsProduction.serial(original))throw new Error('Original evidence changed; private reconciliation required');
  }else annalsWriteOnce_(folder,'original-email-private.json',original);
  source.protectiveRoute = AnnalsAuto.protectedRoute(originalSubject, originalBody);
  if(authenticated&&Date.parse(source.source.receivedAt)>=Date.parse('2026-10-15T04:00:00Z')) {
    source.rulesAuthorityVersion=2;
    source.rulesActivationEligible=typeof annalsRulesReady_==='function'&&annalsRulesReady_()&&Date.parse(source.source.receivedAt)>=Date.parse(annalsProps_().getProperty('ANNALS_RULES_ACCEPT_FROM'));
  }
  annalsWriteOnce_(folder, 'source-private.json', source);
  if (!source.senderAuthenticated) return 'unverified';
  if (source.protectiveRoute === 'col_proposal') {
    if(source.rulesAuthorityVersion===2)annalsRuleNotice_(folder,sender,'ack','Your CoL rule request has been received. One authenticated member can introduce a prospective change. We will confirm its interpretation and implementation, or ask a focused clarification.');
    return 'held';
  }
  if (!source.aiConsentActive) { annalsAckOnce_(folder, sender, id, 'private_review_only'); return 'awaiting_consent'; }
  var hasSourceText = !!(String(source.source.subject || '').trim() || String(source.source.excerpt || '').trim());
  var textComplete = hasSourceText && source.source.sourceTruncated !== true &&
    source.source.subjectTruncated !== true && source.source.excerptTruncated !== true;
  if (source.requiresClarification || attachments.length || !hasSourceText || !textComplete) {
    var hasEligibleSinglePhoto = source.imageConsentAtReceipt &&
      attachments.length >= 1 && attachments.length <= (typeof annalsPhotosReady_==='function'&&annalsPhotosReady_(id)?3:1) && source.attachmentManifest.items.length >= 1 &&
      source.attachmentManifest.items[0].accepted &&
      ['image/jpeg','image/png','image/webp','image/heic','image/heif'].indexOf(source.attachmentManifest.items[0].mime) >= 0 &&
      source.attachmentManifest.items[0].size > 0 && source.attachmentManifest.items[0].size <= 8*1024*1024;
    var completeStandaloneText = textComplete &&
      annalsSafeTextForAutoAi_(annalsAiSourceText_(source)) &&
      AnnalsAuto.independentText(source.source.subject + '\n' + AnnalsAuto.cleanText(source.source.excerpt));
    if (!hasEligibleSinglePhoto && !completeStandaloneText) {
      annalsAckOnce_(folder, sender, id, 'held_for_private_review'); return 'held';
    }
    annalsAckOnce_(folder, sender, id, hasEligibleSinglePhoto ? 'awaiting_private_photo_screening' : 'consented_private_text_drafting');
    return 'staged';
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
/** A failed pre-source staging attempt must not be replayed automatically.
 * This one-shot, owner-only exception contains no message text or identity.
 * Existing complete sources and their publication state are never rewritten.
 */
function annalsRecordStagingException_(messageId) {
  try {
    var id=annalsHash_(messageId),folder=annalsFolder_(id,false);
    if (annalsFile_(folder,'source-private.json') ||
        annalsFile_(folder,'intake-staging-error-private.json')) return false;
    annalsWriteOnce_(folder,'intake-staging-error-private.json',{
      schemaVersion:1,state:'held_for_owner_review',at:new Date().toISOString()
    });
    try { GmailApp.sendEmail(annalsProps_().getProperty('ANNALS_OWNER_EMAIL'),
      'Stammtisch Annals — intake exception',
      'One inbox message could not finish private staging. Its original remains in the mailbox; no automatic replay was made. Review the owner-only folder: '+folder.getUrl()); }
    catch (ignored) {}
    return true;
  } catch (ignored) { return false; }
}
/** Bounded inbox traversal; no mail, labels or read/unread state is changed.
 * A saved thread/message position is resumed on the next run, then wraps.
 */
function runAnnalsProductionIntake() {
  var p = annalsProps_(), summary = { enabled: false, staged: 0, held: 0, duplicates: 0, skipped: 0, unverified: 0, awaiting_consent: 0, consent_activated: 0, consent_revoked: 0, auto_consent_activated: 0, auto_consent_revoked: 0, quote_attribution_revoked: 0, portrait_hidden: 0, portrait_enabled: 0, image_consent_activated: 0, image_consent_revoked: 0, staging_errors: 0, drafted: 0, verified: 0 };
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
      // Promptly inspect the newest conversations as well as the preserved
      // round-robin cursor. New mail shifts numeric Gmail offsets, so the
      // cursor alone can delay or skip submissions. Bounded 3 x 3 recent
      // messages plus the existing <=10-message cursor walk per 15-minute run.
      // Message-ID deduplication keeps overlap from doing work twice per run.
      var recent = GmailApp.getInboxThreads(0, 3), seenInRun = {}, recentRuleId = null;
      function processRecentRule() {
        if (!recentRuleId) return;
        try { annalsProcessRuleRequest_(recentRuleId); }
        catch (ignored) { /* Existing one-shot private records and notices govern exceptions. */ }
      }
      function processInboxMessage(message) {
        var messageId;
        try { messageId=message.getId(); } catch (ignored) { summary.staging_errors++; return; }
        if (typeof messageId!=='string' || !messageId) { summary.staging_errors++; return; }
        if (Object.prototype.hasOwnProperty.call(seenInRun,messageId)) return;
        seenInRun[messageId]=true;
        var outcome;
        try { outcome=annalsStageProduction_(message,activation,allowed); }
        catch (ignored) {
          summary.staging_errors++;
          annalsRecordStagingException_(messageId);
          return;
        }
        if (!Object.prototype.hasOwnProperty.call(summary,outcome) || outcome==='staging_errors') {
          summary.staging_errors++;
          annalsRecordStagingException_(messageId);
          return;
        }
        summary[outcome]++;
        if (outcome==='held' && !recentRuleId) {
          try {
            var sourceId=annalsHash_(messageId),staged=annalsRead_(annalsFolder_(sourceId),'source-private.json');
            if (staged && staged.senderAuthenticated===true &&
                staged.protectiveRoute==='col_proposal') recentRuleId=sourceId;
          } catch (ignored) { summary.staging_errors++; }
        }
      }
      for (var recentIndex = 0; recentIndex < recent.length; recentIndex++) {
        var recentMessages = recent[recentIndex].getMessages();
        for (var recentMessage = Math.max(0, recentMessages.length - 3);
             recentMessage < recentMessages.length; recentMessage++) {
          processInboxMessage(recentMessages[recentMessage]);
        }
      }
      var thread = cursor.threadId ? GmailApp.getThreadById(cursor.threadId) : GmailApp.getInboxThreads(cursor.offset, 1)[0];
      if (!thread) {
        p.deleteProperty('ANNALS_INBOX_CURSOR');
        summary.enabled = true;
        processRecentRule();
        summary.drafted = annalsResumeConsentedDrafts_(2);
        summary.verified = annalsVerifyAutomaticPublications_(3);
        console.log(JSON.stringify(summary));
        return summary;
      }
      summary.enabled = true;
      cursor.threadId = thread.getId();
      var messages = thread.getMessages(), end = Math.min(messages.length, cursor.message + 10);
      for (var i = cursor.message; i < end; i++) {
        processInboxMessage(messages[i]);
        cursor.message = i + 1;
        p.setProperty('ANNALS_INBOX_CURSOR', JSON.stringify(cursor));
      }
      if (end >= messages.length) p.setProperty('ANNALS_INBOX_CURSOR', JSON.stringify({ offset: cursor.offset + 1, message: 0, threadId: null }));
      processRecentRule();
      summary.drafted = annalsResumeConsentedDrafts_(2);
      summary.verified = annalsVerifyAutomaticPublications_(3);
      console.log(JSON.stringify(summary)); return summary;
    });
  } catch (e) { throw new Error('Private intake stopped; review account configuration privately'); }
}
function annalsResumeConsentedDrafts_(limit) {
  var p = annalsProps_(), cursor = p.getProperty('ANNALS_DRAFT_CURSOR');
  var folders = cursor ? DriveApp.continueFolderIterator(cursor) : annalsRoot_().getFolders(), done = 0, checked = 0;
  var priorityRule=null;
  try{var pendingRule=annalsRead_(annalsRoot_(),'col-release-pending-private.json');
    if(pendingRule&&pendingRule.kind==='v3'&&['verified_live','verified_cancelled'].indexOf(pendingRule.state)<0&&/^[a-f0-9]{64}$/.test(pendingRule.sourceId)){
      priorityRule=pendingRule.sourceId;annalsReconcileRuleRelease_(priorityRule);
    }
  }catch(ignored){/* Retain pending evidence; no phase replay or scan starvation. */}
  while (folders.hasNext() && checked++ < 12 && done < limit) {
    var folder = annalsPrivate_(folders.next()), id = folder.getName();
    if (!/^[a-f0-9]{64}$/.test(id)) continue;
    var source = annalsRead_(folder, 'source-private.json');
    if (!source || annalsFile_(folder, 'quarantine-private.json')) continue;
    if (AnnalsAuto.protectedRoute(source.source.subject,source.source.excerpt) !== 'annals') {
      if(source.rulesAuthorityVersion===2&&id!==priorityRule){try{annalsReconcileRuleRelease_(id);annalsScheduledRuleCheck_(id);}catch(ignored){}}
      if(source.rulesAuthorityVersion===2){try{annalsStageEditorialRewrite_(id);}catch(ignored){/* No duplicate dispatch or provider call. */}}
      try {if(source.rulesAuthorityVersion===2 ? annalsProcessRuleRequest_(id) : annalsPrepareRuleDraftCore_(id))done++;}catch(ignored){}
      continue;
    }
    if (annalsFile_(folder, 'draft-private.json')) {
      var dispatched = annalsAutoAttemptSafe_(folder, id);
      if (!dispatched && !annalsFile_(folder, 'draft-notice-private.json')) annalsNotifyDraftReady_(folder);
      continue;
    }
    if (annalsFile_(folder, 'ai-attempt-private.json') || source.senderAuthenticated !== true ||
        source.aiConsentActive !== true || !annalsConsentActive_(source.source.sender) ||
        (source.requiresClarification && !AnnalsAuto.independentText(source.source.subject + '\n' + AnnalsAuto.cleanText(source.source.excerpt)) && !source.imageConsentAtReceipt) ||
        source.source.sourceTruncated || source.source.subjectTruncated || source.source.excerptTruncated ||
        !annalsHasAiSource_(source) ||
        !annalsSafeTextForAutoAi_(annalsAiSourceText_(source))) continue;
    try { if (annalsProcessConsentedText_(id)) done++; }
    catch (e) {
      // An attempt marker permanently prevents a second provider charge.
      if (annalsFile_(folder, 'ai-attempt-private.json')) {
        try { GmailApp.sendEmail(annalsProps_().getProperty('ANNALS_OWNER_EMAIL'), 'Annals draft requires private review',
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
    GmailApp.sendEmail(address, 'Choose whether to allow private Annals AI drafting',
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
    member.autoPublication = { status: 'pending', scope: 'future_source_grounded_text_and_screened_image_publication',
      invitedAt: new Date().toISOString(), challenge: challenge };
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    GmailApp.sendEmail(address, 'One-time choice: automatic Annals text and safe photographs',
      'This is a separate, optional and revocable authorisation. If you agree, your original text and safe photographs that you own or are permitted to share can publish automatically on the PUBLIC Stammtisch website and in permanent PUBLIC GitHub history without per-entry review. A private AI service may analyse submitted images, and only a screened, metadata-stripped small image derivative can be public. The Club owner confirms that the six members have agreed to photos, but any guests or other identifiable people still need their own permission. Strong profanity may be visibly censored; attribution defaults to anonymous. If the content is unsafe, it stays private. You affirm that you hold the rights needed for the content you send. Withdrawal cannot erase previous GitHub history.\n\nTo opt in, reply with this exact sentence:\n\nI CONSENT TO AUTOMATIC PUBLIC ANNALS TEXT AND SCREENED PHOTO PUBLICATION. CODE: ' + challenge +
      '\n\nTo revoke, send: REVOKE ANNALS AUTOMATIC PUBLICATION. Your private AI-processing consent is separate.');
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
function annalsInviteImagePublicationConsent(nonce, email) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    var address = String(email || '').trim().toLowerCase();
    var allowed = AnnalsPilot.allowedSenders(annalsProps_().getProperty('ANNALS_ALLOWED_SENDERS') || '');
    if (allowed.indexOf(address) < 0 || !annalsConsentActive_(address) ||
        !annalsStandingPublicationActive_(address, new Date().toISOString()))
      throw new Error('Separate AI and text publication consent must be active first');
    var root = annalsRoot_(), registry = annalsConsentRegistry_(), member = registry.members[address];
    if (member.imagePublication && member.imagePublication.status === 'active')
      throw new Error('Image consent is already active');
    var challenge = Utilities.getUuid() + Utilities.getUuid();
    member.imagePublication = {status:'pending',scope:'future_safe_original_image_ai_and_publication',
      invitedAt:new Date().toISOString(),challenge:challenge};
    annalsSavePrivate_(root,'consent-registry-private.json',registry);
    GmailApp.sendEmail(address,'Optional: allow safe Annals photographs to publish automatically',
      'You can opt into private AI screening of your image attachments and automatic publication of a small metadata-stripped derivative when the image shows a non-identifying drink or object. You affirm that you own the images you submit or have actual permission from their photographer and anyone identifiable. This never authorises another private photo, identifiable guests, private interiors or personal information. Images that fail screening stay private. The public website and GitHub history may retain copies after withdrawal.\n\nTo opt in, reply exactly:\n\nI CONSENT TO PRIVATE AI IMAGE SCREENING AND PUBLICATION OF MY SAFE ORIGINAL IMAGES. CODE: ' +
      challenge + '\n\nTo stop future image publication, reply: REVOKE ANNALS IMAGE PUBLICATION.');
    return {invited:true};
  }); });
}
function annalsRevokeImagePublicationConsent(nonce,email) {
  return annalsUiCall_(nonce,function () { return annalsLocked_(function () {
    var address=String(email||'').trim().toLowerCase(),root=annalsRoot_(),registry=annalsConsentRegistry_(),
      member=registry.members[address];
    if (!member || !member.imagePublication || member.imagePublication.status !== 'active')
      throw new Error('No active image consent');
    member.imagePublication.status='revoked'; member.imagePublication.revokedAt=new Date().toISOString();
    annalsSavePrivate_(root,'consent-registry-private.json',registry);
    return {revoked:true};
  }); });
}
/** Owner-recorded evidence of ALREADY OBTAINED individual consents; never
 * misrepresent this as an authenticated member challenge response.
 * This is an optional one-time route when the owner actually verified direct,
 * affirmative, revocable consent outside the script (e.g. in person).
 */
function annalsRecordVerifiedExistingConsents(nonce, confirmed, evidenceNote) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    if (confirmed !== true || typeof evidenceNote !== 'string' ||
        evidenceNote.trim().length < 18 || evidenceNote.length > 1000)
      throw new Error('Owner must attest existing individual permissions with private evidence context');
    var p = annalsProps_();
    if (p.getProperty('ANNALS_PRODUCTION_INTAKE_ENABLED') === 'true' ||
        p.getProperty('ANNALS_AI_ENABLED') === 'true' ||
        p.getProperty('ANNALS_AUTO_PUBLICATION_ENABLED') === 'true' ||
        p.getProperty('ANNALS_AUTO_MEDIA_ENABLED') === 'true')
      throw new Error('Stop all Annals automation before initial consent registration');
    var allowed = AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || '');
    if (allowed.length !== 6) throw new Error('Exactly six private member addresses are required');
    var root = annalsRoot_(), previous = annalsFile_(root, 'verified-existing-consents-private.json');
    if (previous) throw new Error('Existing consent registration was already attempted; inspect private evidence');
    var registry = annalsConsentRegistry_(), time = new Date().toISOString();
    // Refuse to revive anyone who expressly revoked previous permission.
    allowed.forEach(function (address) {
      var member = registry.members[address] || {};
      if (member.status === 'revoked' || member.revokedAt ||
          member.autoPublication && (member.autoPublication.status === 'revoked' || member.autoPublication.revokedAt) ||
          member.imagePublication && (member.imagePublication.status === 'revoked' || member.imagePublication.revokedAt))
        throw new Error('A revoked contributor must opt in directly again');
    });
    // The signed-in dedicated owner controls a private attestation, not the
    // contributors' mailbox identities. Keep source/verification notes private.
    var marker = { state: 'attempt_reserved', verifiedAt: time,
      method: 'owner_attested_previous_individual_permissions', memberCount: 6,
      scope: 'private_ai_drafting_and_public_text_and_screened_image_publication',
      privateEvidenceNote: evidenceNote.trim() };
    annalsWriteOnce_(root, 'verified-existing-consents-private.json', marker);
    allowed.forEach(function (address) {
      var member = registry.members[address] || {};
      if (member.status !== 'active' || member.scope !== 'future_text_ai_drafting') {
        member.status = 'active';
        member.scope = 'future_text_ai_drafting';
        member.consentedAt = time;
        member.source = 'owner_attested_prior_direct_permission';
        delete member.challenge;
      }
      if (!member.autoPublication || member.autoPublication.status !== 'active' ||
          member.autoPublication.scope !== 'future_source_grounded_text_and_screened_image_publication') {
        member.autoPublication = { status: 'active',
          scope: 'future_source_grounded_text_and_screened_image_publication',
          consentedAt: time, source: 'owner_attested_prior_direct_permission' };
      }
      registry.members[address] = member;
    });
    annalsSavePrivate_(root, 'consent-registry-private.json', registry);
    marker.state = 'consent_attested_and_recorded';
    annalsFile_(root, 'verified-existing-consents-private.json').setContent(JSON.stringify(marker));
    // One-time informational notice makes revocation practical without
    // demanding each consenting member repeat their existing agreement.
    allowed.forEach(function (address) {
      var notice = 'Annals standing consent — confirmation';
      var body = 'The Club owner has recorded your previously given permission for private AI processing ' +
        'and automatic public Annals text and independently screened, small, metadata-stripped image derivatives. ' +
        'Public GitHub history may retain published material even after withdrawal. To revoke future automatic ' +
        'publication, email REVOKE ANNALS AUTOMATIC PUBLICATION. To stop future private AI processing, email ' +
        'REVOKE ANNALS AI PROCESSING. You can also contact the owner about corrections or removal.';
      try { GmailApp.sendEmail(address, notice, body); }
      catch (ignored) { /* No duplicate mail or permission invention on failure. */ }
    });
    return {recorded:true, memberCount:6, evidenceStorage:'private_only', activationChanged:false};
  }); });
}

function annalsReviewConsentStatus(nonce) {
  return annalsUiCall_(nonce, function () {
    var members = annalsConsentRegistry_().members;
    return Object.keys(members).map(function (address) { return { address: address, status: members[address].status, consentedAt: members[address].consentedAt || null, revokedAt: members[address].revokedAt || null, autoStatus: (members[address].autoPublication || {}).status || 'not_invited', autoConsentedAt: (members[address].autoPublication || {}).consentedAt || null, quoteAttributionStatus: (members[address].quoteAttribution || {}).status || 'not_recorded', contributorPortraitStatus: (members[address].contributorPortraitPublication || {}).status || 'not_recorded', portraitHidden: members[address].portraitAttributionDisabled === true, imageStatus: members[address].autoPublication && members[address].autoPublication.scope === 'future_source_grounded_text_and_screened_image_publication' && members[address].autoPublication.status === 'active' ? 'active' : (members[address].imagePublication || {}).status || 'not_invited', imageConsentedAt: (members[address].imagePublication || {}).consentedAt || (members[address].autoPublication || {}).consentedAt || null, imageSeparatelyRevocable: (members[address].imagePublication || {}).status === 'active' }; });
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
    while (folders.hasNext() && checked++ < 3) {
      var f = annalsPrivate_(folders.next()), id = f.getName();
      if (!/^[a-f0-9]{64}$/.test(id)) continue;
      var source = annalsRead_(f, 'source-private.json');
      if (!source) continue;
      var approval = annalsRead_(f, 'approval-private.json'), correction = annalsRead_(f, 'correction-approval-private.json'), removal = annalsRead_(f, 'removal-private.json');
      items.push({ id: id, subject: source.source.subject, receivedAt: source.source.receivedAt,
        state: removal ? 'Removal: ' + removal.state : correction ? 'Correction: ' + correction.publicationState :
          annalsReviewStatus_(f, source, approval) });
    }
    return { items: items, continuation: folders.hasNext() ? folders.getContinuationToken() : null };
  });
}
function annalsReviewStatus_(folder, source, approval) {
  if (annalsFile_(folder, 'quarantine-private.json')) return 'Quarantined - owner-identified test';
  if (AnnalsAuto.protectedRoute(source.source.subject,source.source.excerpt) !== 'annals') {
    var request=annalsRead_(folder,'col-rule-request-private.json');
    if(request&&typeof request.state==='string'){
      if(request.state==='active')return 'CoL amendment — verified operative';
      if(request.state==='awaiting_implementation')return 'CoL amendment — authorised; implementation pending';
      if(request.state==='awaiting_clarification')return 'CoL amendment — clarification needed';
      if(request.state==='discussion')return 'CoL discussion — not adopted';
      return 'CoL amendment — '+request.state.replace(/_/g,' ');
    }
    if(source.source.sourceTruncated||source.source.subjectTruncated||source.source.excerptTruncated)return 'CoL original retained — length held';
    return source.senderAuthenticated===true?'CoL submission — interpretation pending':'CoL submission — sender authentication unverified';
  }
  if (annalsFile_(folder, 'auto-live-verification-private.json')) return 'Verified live';
  if (approval && approval.publicationState === 'dispatch_accepted') return 'Dispatched — awaiting live verification';
  if (approval && (annalsFile_(folder, 'publication-dispatch-private.json') || approval.publicationState !== 'approved_private_pending_publish'))
    return 'Failed — recovery decision required';
  var reassessment = annalsRead_(folder,'auto-reassessment-private.json'), reassessmentAttempt = annalsRead_(folder,'reassessment-attempt-private.json');
  if (reassessment && reassessment.state === 'held') return 'Held after reassessment — ' + String(reassessment.reason || 'policy_review_required').slice(0,100);
  if (reassessmentAttempt && reassessmentAttempt.state !== 'attempt_reserved') return 'Failed — recovery decision required';
  if (reassessmentAttempt) return 'Failed — recovery attempt needs owner review';
  var decision = annalsRead_(folder, 'auto-decision-private.json');
  if (decision && decision.state === 'held') return 'Held — ' + String(decision.reason || 'policy_review_required').slice(0,100);
  if (approval || decision && decision.state === 'eligible') return 'Eligible for publication';
  if (annalsFile_(folder, 'ai-attempt-private.json') && !annalsFile_(folder, 'draft-private.json'))
    return 'Failed — recovery decision required';
  if (annalsFile_(folder, 'draft-private.json')) return 'Drafted privately';
  return source.senderAuthenticated === true ? 'Received and authenticated' : 'Received — sender not authenticated';
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
    var approval = annalsRead_(f, 'approval-private.json'), decision = annalsRead_(f, 'auto-decision-private.json');
    var reassessment = annalsRead_(f,'reassessment-attempt-private.json');
    return { id: id, subject: source.source.subject, text: source.source.excerpt, receivedAt: source.source.receivedAt,
      protectiveRoute: AnnalsAuto.protectedRoute(source.source.subject,source.source.excerpt),
      ruleProposal: annalsRead_(f,'col-proposal-private.json'),
      ruleRequest: annalsRead_(f,'col-rule-request-private.json'),
      // Boolean only: never return a signing value or signed record. Preserve
      // the live v30 rotation-button entitlement when installing later source.
      signedRotationEvidenceAvailable: !!(originalApproval&&originalApproval.entry&&
        originalApproval.receipt&&typeof originalApproval.receipt.signature==='string'&&originalApproval.receipt.signature&&
        originalApproval.publication&&typeof originalApproval.publication.signature==='string'&&originalApproval.publication.signature),
      historicOldestContinuationAvailable: typeof annalsHistoricOldestContinuationReady_==='function'&&
        annalsHistoricOldestContinuationReady_(f,source),
      historicOldestContinuationReady: typeof annalsHistoricOldestContinuationReady_==='function'&&
        annalsHistoricOldestContinuationReady_(f,source)&&typeof annalsRuleOldestReady_==='function'&&annalsRuleOldestReady_(id),
      rulesReady: typeof annalsRulesReady_==='function'&&annalsRulesReady_(),
      historyReview: annalsRead_(f,'history-review-private.json'),
      truncated: source.source.sourceTruncated || source.source.subjectTruncated || source.source.excerptTruncated,
      status: annalsReviewStatus_(f, source, approval),
      quarantined: !!annalsFile_(f, 'quarantine-private.json'),
      holdReason: reassessment && reassessment.state === 'held' ? reassessment.reason :
        decision && decision.state === 'held' ? decision.reason : '',
      reassessmentAvailable: !!(decision && decision.state === 'held' && !reassessment &&
        !annalsFile_(f,'approval-private.json') && !annalsFile_(f,'publication-dispatch-private.json') &&
        annalsFile_(f,'ai-attempt-private.json') && (annalsRead_(f,'draft-private.json') || {}).category === 'quotation'),
      attachments: names, folderUrl: f.getUrl(),
      draft: annalsRead_(f, 'draft-private.json'), review: annalsRead_(f, 'review-private.json'),
      photoDerivative: annalsRead_(f, 'photo-derivative-private.json') ? annalsPhotoDerivative_(f) : null,
      outcome: annalsRead_(f, 'ai-outcome-private.json'), correctionReview: annalsRead_(f, 'correction-review-private.json'),
      correctionApproval: correction, removal: annalsRead_(f, 'removal-private.json'),
      publishedEntry: (published || {}).entry || null,
      publishedEntryHash: (published || {}).entry ? annalsHash_(AnnalsProduction.serial(published.entry)) : null,
      speakerPortrait: (annalsQuoteSpeakerPermission_(source, annalsRead_(f,'draft-private.json')) || {}).speakerPortrait || '',
      contributorPortrait: annalsContributorPortrait_(source) || '',
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
/** Produce a small metadata-free thumbnail privately. Original media is never
 * sent to GitHub or used as the public derivative. Holds when Drive has no
 * suitable JPEG thumbnail, the image is too large, or consent is missing.
 */
function annalsAutoThumbnail_(id, source) {
  // Once the guarded-release module is installed, the legacy Drive-thumbnail
  // publication fallback is permanently retired. This must not become
  // reachable again merely because the guarded JPEG or AI deadline expires.
  // Current photographs use only the full decode/re-encode gallery path.
  if(typeof annalsGuardedPhotosReady_==='function')return null;
  if (!source || !source.source || !source.imageConsentAtReceipt ||
      annalsProps_().getProperty('ANNALS_AUTO_MEDIA_ENABLED') !== 'true' ||
      !annalsImageConsentActive_(source.source.sender, source.source.receivedAt)) return null;
  var items = source.attachmentManifest && source.attachmentManifest.items;
  if (!Array.isArray(items)) return null;
  var selected = items.filter(function (item) {
    return item.accepted && ['image/jpeg','image/png','image/webp','image/heic','image/heif'].indexOf(item.mime) >= 0 &&
      item.size > 0 && item.size <= 8 * 1024 * 1024;
  });
  if (selected.length !== 1 || items.length !== 1) return null; // no multi-photo inference
  var folder = annalsFolder_(id), photo = annalsFile_(folder, selected[0].storageName);
  if (!photo || photo.getSize() > 8 * 1024 * 1024) return null;
  var old = annalsRead_(folder,'photo-derivative-private.json');
  if (old && old.source === 'automated_drive_thumbnail') return annalsPhotoDerivative_(folder);
  if (old) return null; // never replace an owner's manually reviewed derivative
  var thumb = photo.getThumbnail();
  if (!thumb) return null;
  var sanitised = AnnalsMedia.sanitize(thumb.getBytes());
  var hash = annalsHash_(sanitised.bytes);
  var metadata = { sha256:hash,size:sanitised.bytes.length,width:sanitised.width,
    height:sanitised.height,source:'automated_drive_thumbnail',savedAt:new Date().toISOString() };
  var img = annalsPrivate_(folder.createFile(
    Utilities.newBlob(sanitised.bytes,'image/jpeg','photo-derivative-private.jpg')));
  if (!img) throw new Error('Private thumbnail storage unavailable');
  annalsWriteOnce_(folder,'photo-derivative-private.json',metadata);
  return { sha256:hash,size:sanitised.bytes.length,
    base64:Utilities.base64Encode(sanitised.bytes) };
}
function annalsPrepareDraft(nonce, id, text, selectedNames, consent) {
  return annalsUiCall_(nonce, function () { return annalsPrepareDraftCore_(id, text, selectedNames, consent); });
}
function annalsPrepareDraftCore_(id, text, selectedNames, consent, intakeLockHeld, derivedImages) {
  var process = function () {
    if (consent !== true) throw new Error('Processing consent required');
    var p = annalsProps_(), f = annalsFolder_(id);
    if (annalsFile_(f, 'quarantine-private.json')) throw new Error('Quarantined test cannot be drafted');
    if (p.getProperty('ANNALS_AI_ENABLED') !== 'true' || !p.getProperty('ANNALS_OPENAI_API_KEY')) throw new Error('AI configuration incomplete');
    if (intakeLockHeld === true && !annalsPublisherDispatchReady_()) throw new Error('Publisher credential unavailable for unattended AI processing');
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
    if (derivedImages !== undefined) {
      if (selectedNames.length || !Array.isArray(derivedImages) || derivedImages.length > 3)
        throw new Error('Invalid automated image selection');
      images = derivedImages;
    }
    annalsOrdinarySourceGate_(source);
    var request = AnnalsProduction.request(text, images);
    var month = Utilities.formatDate(new Date(), 'America/Toronto', 'yyyy-MM');
    var ledger = AnnalsProduction.reserve(JSON.parse(p.getProperty('ANNALS_BUDGET_LEDGER') || 'null'), month);
    p.setProperty('ANNALS_BUDGET_LEDGER', JSON.stringify(ledger)); // before any network request
    annalsWriteOnce_(f, 'ai-attempt-private.json', { state: 'attempt_reserved', reservedCents: 10,
      at: new Date().toISOString(), owner: intakeLockHeld === true ? annalsServiceOwner_() : annalsOwner_(), model: AnnalsProduction.MODEL,
      processingConsent: true, submittedText: text, selectedNames: selectedNames, imageInputCount: images.length });
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
    // Retain one bounded response only in owner-only Drive before validation.
    // Never log it or send it to GitHub. This does not permit a second AI call.
    var responseText;
    try {
      responseText = response.getContentText();
      if (typeof responseText !== 'string' || responseText.length > 100000) {
        annalsRecordAttemptOutcome_(f, 'provider_response_too_large');
        throw new Error('Response evidence exceeds private bounds');
      }
      annalsWriteOnce_(f, 'ai-response-private.json', {
        receivedAt: new Date().toISOString(), httpStatus: status,
        model: AnnalsProduction.MODEL, responseText: responseText
      });
    } catch (e) {
      annalsRecordAttemptOutcome_(f, 'response_evidence_unavailable');
      throw new Error('AI attempt held; no automatic retry');
    }
    var candidate;
    try { candidate = AnnalsProduction.response(JSON.parse(responseText), images.length > 0); }
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
  var folder = annalsFolder_(id);
  if (annalsFile_(folder, 'quarantine-private.json')) return false;
  var source = annalsRead_(folder, 'source-private.json');
  if (!source || source.senderAuthenticated !== true || source.aiConsentActive !== true || !annalsConsentActive_(source.source.sender) ||
      (source.requiresClarification && !AnnalsAuto.independentText(source.source.subject + '\n' + AnnalsAuto.cleanText(source.source.excerpt)) && !source.imageConsentAtReceipt) ||
      source.source.sourceTruncated || source.source.subjectTruncated || source.source.excerptTruncated ||
      !annalsHasAiSource_(source) ||
      !annalsSafeTextForAutoAi_(annalsAiSourceText_(source)) ||
      annalsProps_().getProperty('ANNALS_AI_ENABLED') !== 'true') return false;
  var fullText = [source.source.subject || '', source.source.excerpt || ''].filter(function (v) { return v.trim(); }).join('\n');
  var derived = null;
  if (source.imageConsentAtReceipt && annalsProps_().getProperty('ANNALS_AUTO_MEDIA_ENABLED') === 'true') {
    try { derived = annalsAutoThumbnail_(id, source); }
    catch (ignored) { /* private media stays held; safe text may proceed */ }
  }
  // Image-dependent emails must not consume their only paid AI attempt while
  // Drive is still preparing a thumbnail; defer until a safe one exists.
  var needsImage = !!(source.attachmentManifest && source.attachmentManifest.items.length &&
    (!fullText.trim() || !AnnalsAuto.independentText(fullText)));
  if (needsImage && !derived && !(typeof annalsPhotosReady_==='function' && annalsPhotosReady_(id))) return false;
  var set = typeof annalsPhotosReady_==='function' && annalsPhotosReady_(id) ? annalsPhotoSet_(id,source,true) : [];
  var images = derived ? [{mime:'image/jpeg',base64:derived.base64}] : [];
  if(set.length)images=set.map(function(p){return {mime:'image/jpeg',base64:p.base64};});
  if(needsImage&&!derived&&!set.length)return false;
  annalsPrepareDraftCore_(id, annalsAiSourceText_(source), [], true, true, images); // caller already holds intake lock
  var dispatched = annalsAutoAttemptSafe_(annalsFolder_(id), id);
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
    GmailApp.sendEmail(p.getProperty('ANNALS_OWNER_EMAIL'), 'Private Annals draft ready',
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
function annalsAiSourceText_(source) {
  if (!source || !source.source) return '';
  return 'EMAIL SUBJECT (original field):\n' + String(source.source.subject || '') +
    '\n\nEMAIL BODY (original field):\n' + String(source.source.excerpt || '');
}
function annalsHasAiSource_(source) {
  if (!source || !source.source) return false;
  if (String(source.source.subject || '').trim() || String(source.source.excerpt || '').trim()) return true;
  return source.imageConsentAtReceipt === true && source.attachmentManifest &&
    Array.isArray(source.attachmentManifest.items) && source.attachmentManifest.items.length > 0;
}
function annalsSaveReview(nonce, id, rawEntry) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    var f = annalsFolder_(id);
    if (!annalsRead_(f, 'source-private.json') || annalsFile_(f, 'approval-private.json')) throw new Error('Item cannot be edited here');
    annalsOrdinarySourceGate_(annalsRead_(f,'source-private.json'));
    var entry = AnnalsProduction.publicEntry(rawEntry);
    if (entry.contributorPortrait && entry.contributorPortrait !==
        annalsContributorPortrait_(annalsRead_(annalsFolder_(id),'source-private.json')))
      throw new Error('Contributor illustration requires authenticated member permission');
    if (entry.speakerPortrait) {
      var source = annalsRead_(f,'source-private.json'), draft = annalsRead_(f,'draft-private.json');
      var speaker = annalsQuoteSpeakerPermission_(source,draft);
      if (!speaker || speaker.speakerPortrait !== entry.speakerPortrait)
        throw new Error('Speaker identity or individual quotation permission is not verified');
    }
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
    annalsOrdinarySourceGate_(annalsRead_(f,'source-private.json'));
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
  if (receipt.reviewedBy === 'standing-consent-image-automation-v1') proof.mode = entry.photos ? 'standing-consent-photos-v2' : AnnalsMediaPolicy.MODE;
  if (receipt.reviewedBy === 'standing-consent-quote-automation-v1') proof.mode = AnnalsAuto.QUOTE_MODE;
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
/** A renewed restricted publisher credential may advance its own verified expiry
 * without a private code release. Missing configuration preserves the last
 * independently observed expiry; malformed values fail closed. */
function annalsPublisherExpiry_() {
  var expiresAt = annalsProps_().getProperty('ANNALS_GITHUB_TOKEN_EXPIRES_AT') || '2026-11-09T00:00:00Z';
  var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(expiresAt);
  if (!match) return NaN;
  var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  var leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  var maxDay = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (!maxDay || day < 1 || day > maxDay || Number(match[4]) > 23 ||
      Number(match[5]) > 59 || Number(match[6]) > 59) return NaN;
  var stamp = Date.parse(expiresAt);
  return Number.isFinite(stamp) ? stamp : NaN;
}
function annalsPublisherDispatchReady_() {
  return Date.now() < annalsPublisherExpiry_();
}
function annalsDispatchEvent_(folder, eventType, clientPayload, markerName) {
  var p = annalsProps_(), token = p.getProperty('ANNALS_GITHUB_TOKEN'), repo = p.getProperty('ANNALS_GITHUB_REPOSITORY');
  if (!annalsPublisherDispatchReady_()) return false;
  if (!token || (p.getProperty('ANNALS_PUBLISH_SIGNING_KEY') || '').length < 32 ||
      p.getProperty('ANNALS_PUBLISH_SIGNING_KEY') === p.getProperty('ANNALS_APPROVAL_KEY') ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '') ||
      ['annals-approved-entry','annals-auto-entry','annals-correct-entry','annals-remove-entry','annals-history-revision','annals-col-rule-release','annals-col-rule-status','annals-col-candidate-v3','annals-col-activation-v3','annals-col-confirm-v3','annals-col-cancel-v3','annals-col-seal-v3'].indexOf(eventType) < 0 || annalsFile_(folder, markerName)) return false;
  if(['annals-col-rule-release','annals-col-rule-status'].indexOf(eventType)>=0&&!annalsRulesReady_())return false;
  if(/^annals-col-(?:candidate|activation|confirm|cancel|seal)-v3$/.test(eventType)&&
    (typeof annalsRuleV3DispatchReady_!=='function'||!annalsRuleV3DispatchReady_(folder,eventType,clientPayload)))return false;
  if (eventType === 'annals-history-revision' && (p.getProperty('ANNALS_HISTORY_PUBLICATION_ENABLED') !== 'true' || !Number.isFinite(Date.parse(p.getProperty('ANNALS_SIGNING_REMEDIATED_AT'))))) return false;
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
  if (annalsFile_(folder, 'quarantine-private.json')) throw new Error('Quarantined test cannot be published');
  annalsOrdinarySourceGate_(annalsRead_(folder,'source-private.json'));
  if (eventType !== 'annals-correct-entry' && !entry.photos && ['club_history','monthly_gathering','artefact'].indexOf(entry.category) >= 0) throw new Error('Use the distinct Living History workflow');
  if (!approval) return false;
  var payload = { entry: entry, approval: approval };
  if (entry.photos) {
    if(!annalsPhotosReady_(folder.getName()))return false;
    if(annalsFile_(folder,markerName))return false;
    if(annalsProps_().getProperty('ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED')==='true'){
      payload.imageBlobs=annalsPhotoBlobRefs_(folder,entry,approval,eventType);
      if(!payload.imageBlobs)return false;
    }else{
      var set=annalsPhotoSet_(folder.getName(),annalsRead_(folder,'source-private.json'),false);
      payload.images=entry.photos.map(function(p){var d=set.find(function(x){return x.sha256===p.sha256;});if(!d)throw new Error('Missing screened derivative');return {sha256:p.sha256,base64:d.base64};});
    }
  }
  if (entry.photo) {
    var derivative = annalsPhotoDerivative_(folder);
    if (!derivative || derivative.sha256 !== entry.photo.sha256 || derivative.size > 32768) return false;
    payload.imageBase64 = derivative.base64;
  }
  if(entry.photos&&(!annalsPhotosReady_(folder.getName())||payload.imageBlobs&&annalsProps_().getProperty('ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED')!=='true'||!annalsStandingGalleryCorrectionAllowed_(annalsRead_(folder,'source-private.json'),entry,folder)))return false;
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
    var corrected = Object.assign({},rawEntry);
    if(original.entry.photos){
      if(!annalsStandingGalleryCorrectionAllowed_(annalsRead_(folder,'source-private.json'),original.entry,folder) || corrected.photo ||
        corrected.photos && !AnnalsPhotos.sameAssets(corrected.photos,original.entry.photos))throw new Error('Gallery rights or replacement require private clarification');
      corrected.photos=corrected.photos||original.entry.photos;corrected.submittedAt=original.entry.submittedAt;corrected.eventPeriod=rawEntry.eventPeriod===undefined?original.entry.eventPeriod:rawEntry.eventPeriod;
      if(original.entry.correction)corrected.correction=original.entry.correction;else delete corrected.correction;
    }
    var entry = AnnalsProduction.publicEntry(corrected);
    if (entry.contributorPortrait && entry.contributorPortrait !==
        annalsContributorPortrait_(annalsRead_(annalsFolder_(id),'source-private.json')))
      throw new Error('Contributor illustration requires authenticated member permission');
    if (entry.speakerPortrait) {
      var source = annalsRead_(folder,'source-private.json'), draft = annalsRead_(folder,'draft-private.json');
      var speaker = annalsQuoteSpeakerPermission_(source,draft);
      if (!speaker || speaker.speakerPortrait !== entry.speakerPortrait)
        throw new Error('Corrected quotation speaker permission unverified');
    }
    if (entry.id !== original.entry.id || AnnalsProduction.serial(entry) === AnnalsProduction.serial(original.entry)) throw new Error('Correction must change this exact entry');
    if(original.entry.photos)entry.correction={at:new Date().toISOString(),note:'Text corrected after private source review.'};
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
    if(original.entry.photos && !annalsStandingGalleryCorrectionAllowed_(annalsRead_(folder,'source-private.json'),original.entry,folder))throw new Error('Gallery permission is no longer active');
    if(original.entry.photos)consents=Object.assign({},consents,{photoPublication:true});
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
/** A malformed single draft must never stop the rest of the private intake.
 * Never retry any attempted dispatch or provider request after uncertainty.
 */
function annalsAutoAttemptSafe_(folder, id) {
  try { return annalsAutoPublishCandidate_(id); }
  catch (ignored) {
    try {
      if (!annalsFile_(folder, 'auto-decision-private.json') && !annalsFile_(folder, 'approval-private.json')) {
        annalsWriteOnce_(folder, 'auto-decision-private.json', {
          state: 'held', reason: 'internal_validation_error', at: new Date().toISOString()
        });
      }
    } catch (ignoredAgain) {}
    return false;
  }
}
/** No member submission is an instruction to publish. This is a fail-closed
 * server-side decision, guarded by private consent evidence and an exact
 * deterministic source-grounding check. Only eligible text is signed.
 */
function annalsAutoPublishCandidate_(id, allowHeldRecovery) {
  var p = annalsProps_();
  if (p.getProperty('ANNALS_AUTO_PUBLICATION_ENABLED') !== 'true') return false;
  if (p.getProperty('ANNALS_GITHUB_REPOSITORY') !== 'justinpfisher/Stammtisch' ||
      !p.getProperty('ANNALS_GITHUB_TOKEN') ||
      (p.getProperty('ANNALS_PUBLISH_SIGNING_KEY') || '').length < 32 ||
      (p.getProperty('ANNALS_APPROVAL_KEY') || '').length < 32 ||
      p.getProperty('ANNALS_PUBLISH_SIGNING_KEY') === p.getProperty('ANNALS_APPROVAL_KEY') ||
      AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || '').length !== 6) return false;
  var folder = annalsFolder_(id);
  if (annalsFile_(folder, 'quarantine-private.json')) return false;
  var previous = annalsRead_(folder, 'approval-private.json');
  if (previous) return [AnnalsAuto.MODE,AnnalsAuto.QUOTE_MODE,AnnalsMediaPolicy.MODE,'standing-consent-photos-v2'].indexOf(previous.approvalMode) >= 0 && previous.publicationState === 'dispatch_accepted';
  var source = annalsRead_(folder, 'source-private.json'), draft = annalsRead_(folder, 'draft-private.json');
  var priorDecision = annalsRead_(folder, 'auto-decision-private.json');
  var recoveryAttempt = annalsRead_(folder, 'reassessment-attempt-private.json');
  var heldRecovery = allowHeldRecovery === true && priorDecision &&
    priorDecision.state === 'held' && recoveryAttempt && recoveryAttempt.state === 'attempt_reserved' &&
    recoveryAttempt.owner === annalsOwner_() && recoveryAttempt.aiCall === false && recoveryAttempt.dispatchWasAbsent === true &&
    source && draft && recoveryAttempt.sourceDigest === annalsHash_(AnnalsProduction.serial(source.source)) &&
    recoveryAttempt.draftDigest === annalsHash_(AnnalsProduction.serial(draft)) &&
    !annalsRead_(folder, 'auto-reassessment-private.json');
  if (priorDecision && !heldRecovery) return false; // no silent retries
  if (!priorDecision && recoveryAttempt) return false;
  if (!source || !draft || !source.source || !source.senderAuthenticated || !source.aiConsentActive ||
      !source.autoConsentAtReceipt || !annalsStandingPublicationActive_(source.source.sender, source.source.receivedAt) ||
    source.source.sourceTruncated || source.source.subjectTruncated || source.source.excerptTruncated ||
      Date.parse(source.source.receivedAt) < Date.parse(p.getProperty('ANNALS_ACTIVATED_AT'))) return false;
  var speakerPermission = draft.category === 'quotation' ?
    annalsQuoteSpeakerPermission_(source,draft) : null;
  var originalDecision = AnnalsAuto.propose(source, draft, id, speakerPermission), derivative = null;
  if (p.getProperty('ANNALS_AUTO_MEDIA_ENABLED') === 'true' && source.imageConsentAtReceipt &&
      annalsImageConsentActive_(source.source.sender, source.source.receivedAt)) {
    try { derivative = typeof annalsGuardedPhotosReady_==='function'&&annalsGuardedPhotosReady_()?null:annalsPhotoDerivative_(folder); }
    catch (ignored) { derivative = null; }
    var metadata = annalsRead_(folder,'photo-derivative-private.json');
    if (!metadata || metadata.source !== 'automated_drive_thumbnail') derivative = null;
  }
  var decision = AnnalsMediaPolicy.enrich(source,draft,id,originalDecision,derivative);
  if(typeof annalsPhotosReady_==='function' && annalsPhotosReady_(id))decision=annalsPhotoDecision_(source,draft,id,decision,annalsPhotoSet_(id,source,false));
  if (!decision.eligible) {
    annalsWriteOnce_(folder, heldRecovery ? 'auto-reassessment-private.json' : 'auto-decision-private.json',
      { state: 'held', reason: decision.reason, at: new Date().toISOString() });
    return false;
  }
  if (decision.entry.category !== 'quotation') {
    var contributorPortrait = annalsContributorPortrait_(source);
    if (contributorPortrait) decision.entry.contributorPortrait = contributorPortrait;
  }
  var entry = AnnalsProduction.publicEntry(decision.entry);
  var hash = annalsHash_(AnnalsProduction.serial(entry));
  var receipt = { entryId: entry.id, approvedAt: new Date().toISOString(),
    reviewedBy: (decision.mode === AnnalsMediaPolicy.MODE || decision.mode === 'standing-consent-photos-v2') ? 'standing-consent-image-automation-v1' :
      decision.mode === AnnalsAuto.QUOTE_MODE ? 'standing-consent-quote-automation-v1' :
      'standing-consent-automation-v1',
    consents: AnnalsProduction.consents(entry, {
      publication: true, quotePublication: entry.category === 'quotation', recipeVerified: entry.category === 'cocktail',
      namedAttribution: !!(entry.speakerPortrait || entry.contributorPortrait), photoPublication: !!(entry.photo || entry.photos)
    }), contentSha256: hash };
  receipt.signature = annalsHex_(Utilities.computeHmacSha256Signature(
    AnnalsProduction.serial({ entry: entry, receipt: receipt }), p.getProperty('ANNALS_APPROVAL_KEY'), Utilities.Charset.UTF_8));
  var publication = annalsPublicApproval_(entry, receipt, p.getProperty('ANNALS_PUBLISH_SIGNING_KEY'));
  if (!publication || publication.mode !== decision.mode) return false;
  // Both consent records and the accuracy/eligibility reason stay private.
  annalsWriteOnce_(folder, heldRecovery ? 'auto-reassessment-private.json' : 'auto-decision-private.json', {
    state: 'eligible', policy: decision.mode,
    sourceDigest: annalsHash_(String(source.source.subject || '') + '\n' + String(source.source.excerpt || '')),
    contentSha256: hash, consentCheckedAt: new Date().toISOString()
  });
  var saved = { entry: entry, receipt: receipt, publication: publication, approvalMode: decision.mode,
    evidenceNote: 'Contributor authenticated; separate standing consents active at receipt and signing; deterministic source-grounded policy accepted.',
    uncertaintiesReviewed: true, publicationState: 'approved_private_pending_publish' };
  annalsWriteOnce_(folder, 'approval-private.json', saved);
  var accepted = annalsDispatchApproved_(folder, entry, publication, 'annals-auto-entry', 'publication-dispatch-private.json');
  saved.publicationState = accepted ? 'dispatch_accepted' : 'dispatch_not_configured_or_held';
  annalsFile_(folder, 'approval-private.json').setContent(JSON.stringify(saved));
  return accepted;
}
/** Owner-confirmed, one-shot deterministic recheck of an existing held quote draft.
 * This never calls AI and never retries an item with any approval or dispatch record.
 */
function annalsReassessHeldQuote(nonce, id, confirmed) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    var owner = annalsOwner_();
    if (confirmed !== true || !/^[a-f0-9]{64}$/.test(id || '')) throw new Error('Explicit one-time owner confirmation required');
    var folder = annalsFolder_(id);
    if (annalsFile_(folder, 'quarantine-private.json')) throw new Error('Quarantined test cannot be reassessed');
    var source = annalsRead_(folder,'source-private.json'),
      draft = annalsRead_(folder,'draft-private.json'), held = annalsRead_(folder,'auto-decision-private.json');
    var p = annalsProps_(), sender = source && source.source && String(source.source.sender || '').toLowerCase(),
      allowed = AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS') || '');
    if (!source || source.sourceId !== id || source.senderAuthenticated !== true || source.aiConsentActive !== true ||
        source.autoConsentAtReceipt !== true || !draft || draft.category !== 'quotation' ||
        !draft.interpretation || draft.interpretation.intent !== 'direct_quote' ||
        !held || held.state !== 'held' || !annalsFile_(folder,'ai-attempt-private.json') ||
        annalsFile_(folder,'approval-private.json') || annalsFile_(folder,'publication-dispatch-private.json') ||
        annalsFile_(folder,'reassessment-attempt-private.json') || annalsFile_(folder,'auto-reassessment-private.json') ||
        allowed.length !== 6 || allowed.indexOf(sender) < 0 ||
        source.source.sourceTruncated || source.source.subjectTruncated || source.source.excerptTruncated ||
        Date.parse(source.source.receivedAt) < Date.parse(p.getProperty('ANNALS_ACTIVATED_AT')) ||
        !annalsConsentActive_(sender) || !annalsStandingPublicationActive_(sender,source.source.receivedAt))
      throw new Error('This item is not eligible for one-time quote reassessment');
    var attempt = { state:'attempt_reserved', at:new Date().toISOString(), owner:owner,
      sourceDigest:annalsHash_(AnnalsProduction.serial(source.source)),
      draftDigest:annalsHash_(AnnalsProduction.serial(draft)), aiCall:false, dispatchWasAbsent:true };
    annalsWriteOnce_(folder,'reassessment-attempt-private.json',attempt);
    var accepted = annalsAutoPublishCandidate_(id,true), approval = annalsRead_(folder,'approval-private.json');
    var reassessment = annalsRead_(folder,'auto-reassessment-private.json');
    var state = approval ? (approval.publicationState === 'dispatch_accepted' ? 'dispatch_accepted' : 'failed_recovery_decision_required') :
      reassessment && reassessment.reason || (reassessment ? 'held_by_deterministic_policy' : 'reassessment_stopped_before_decision');
    annalsFile_(folder,'reassessment-attempt-private.json').setContent(JSON.stringify(Object.assign({},attempt,
      {state:state,finishedAt:new Date().toISOString(),dispatchAccepted:accepted === true})));
    return { status:state, aiCall:false, dispatchAccepted:accepted === true };
  }); });
}
/** Read-only reconciliation. HTTP acceptance is NOT proof of publication.
 * Verify both published archive identity/digest and live Pages markup.
 * Check at most a few pending entries per intake cycle. Never re-dispatch.
 */
function annalsVerifyAutomaticPublications_(limit) {
  if (annalsProps_().getProperty('ANNALS_AUTO_PUBLICATION_ENABLED') !== 'true') return 0;
  var p = annalsProps_(), token = p.getProperty('ANNALS_VERIFY_CURSOR');
  var folders = token ? DriveApp.continueFolderIterator(token) : annalsRoot_().getFolders();
  var checked = 0, verified = 0;
  while (folders.hasNext() && checked++ < 12 && verified < limit) {
    var folder = annalsPrivate_(folders.next()), id = folder.getName();
    if (!/^[a-f0-9]{64}$/.test(id)) continue;
    var pendingCorrection=annalsRead_(folder,'correction-approval-private.json');
    if(pendingCorrection&&pendingCorrection.entry&&pendingCorrection.entry.photos&&pendingCorrection.publicationState==='dispatch_accepted'){
      if(typeof annalsVerifyGalleryCorrection_==='function'&&annalsVerifyGalleryCorrection_(folder,id))verified++;
      continue;
    }
    if(annalsFile_(folder,'auto-live-verification-private.json'))continue;
    var saved = annalsRead_(folder, 'approval-private.json');
    if (!saved || [AnnalsAuto.MODE,AnnalsAuto.QUOTE_MODE,AnnalsMediaPolicy.MODE,'standing-consent-photos-v2'].indexOf(saved.approvalMode) < 0 || saved.publicationState !== 'dispatch_accepted') continue;
    // A queued/failed Pages run must not remain invisible indefinitely.
    // Private reminder only; never re-dispatch an uncertain publication.
    var approvedAt = Date.parse(saved.receipt && saved.receipt.approvedAt);
    if (Number.isFinite(approvedAt) && Date.now() - approvedAt > 86400000 &&
        !annalsFile_(folder, 'auto-publication-delay-private.json')) {
      annalsWriteOnce_(folder, 'auto-publication-delay-private.json',
        { state: 'unverified_after_24h', at: new Date().toISOString() });
      try { GmailApp.sendEmail(p.getProperty('ANNALS_OWNER_EMAIL'), 'Annals publication still unverified',
        'A signed automatic submission remains unverified after 24 hours. Check the existing Annals GitHub Actions and Pages runs. Do not resend blindly.\n\n' +
        p.getProperty('ANNALS_REVIEW_URL') + '?item=' + encodeURIComponent(id)); }
      catch (ignored) {}
    }
    try {
      var query = '?checked=' + encodeURIComponent(id.slice(0, 16)) + '-' + String(Date.now());
      var archiveResponse = UrlFetchApp.fetch('https://raw.githubusercontent.com/justinpfisher/Stammtisch/main/data/annals-approved.json' + query,
        { method: 'get', muteHttpExceptions: true, followRedirects: false, validateHttpsCertificates: true });
      if (archiveResponse.getResponseCode() !== 200) continue;
      var rawArchive = archiveResponse.getContentText();
      if (rawArchive.length > 1000000) continue;
      var archive = JSON.parse(rawArchive);
      if (!archive || !Array.isArray(archive.entries) || !Array.isArray(archive.approvals)) continue;
      var entry = archive.entries.find(function (item) { return item.id === saved.entry.id; });
      var signature = archive.approvals.find(function (item) { return item.entryId === saved.entry.id; });
      if (!entry || !signature || signature.mode !== saved.approvalMode ||
          annalsHash_(AnnalsProduction.serial(entry)) !== saved.receipt.contentSha256 ||
          signature.signature !== saved.publication.signature) continue;
      var pageResponse = UrlFetchApp.fetch('https://stammtischbrewery.com/annals.html' + query,
        { method: 'get', muteHttpExceptions: true, followRedirects: false, validateHttpsCertificates: true });
      if (pageResponse.getResponseCode() !== 200 || pageResponse.getContentText().indexOf('id="' + saved.entry.id + '"') < 0) continue;
      if(entry.photos&&!annalsVerifyPhotoAssets_(entry,archive,query))continue;
      annalsWriteOnce_(folder, 'auto-live-verification-private.json', {
        state: 'verified_live', contentSha256: saved.receipt.contentSha256, verifiedAt: new Date().toISOString() });
      verified++;
      // One delivery attempt only: never repeat mail on uncertain outcomes.
      var source = annalsRead_(folder, 'source-private.json');
      if (source && source.source && source.source.sender && !annalsFile_(folder, 'published-email-private.json')) {
        annalsWriteOnce_(folder, 'published-email-private.json', { state: 'attempted_once', at: new Date().toISOString() });
        try { GmailApp.sendEmail(source.source.sender, 'Your Stammtisch Annals entry is published',
          'Your approved-by-standing-consent text now appears on the public website:\nhttps://stammtischbrewery.com/annals.html#' +
          saved.entry.id + '\n\nFor a correction or withdrawal, contact the club owner. Old copies in public GitHub history may remain.'); }
        catch (ignored) { /* no duplicate mail */ }
      }
    } catch (ignored) { /* incomplete Pages rollout or read failure: retry verification, never publication */ }
  }
  if (folders.hasNext()) p.setProperty('ANNALS_VERIFY_CURSOR', folders.getContinuationToken());
  else p.deleteProperty('ANNALS_VERIFY_CURSOR');
  return verified;
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
    p.setProperty('ANNALS_AUTO_MEDIA_ENABLED', 'false');
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'runAnnalsProductionIntake') ScriptApp.deleteTrigger(t);
    });
    return { intakeEnabled: false, aiEnabled: false };
  });
}

/** Verify a published text test's exact signed withdrawal before quarantine.
 * Read-only checks never retry publication/removal or a provider request.
 */
function annalsVerifyWithdrawnTest_(folder, id) {
  try {
    var original = annalsRead_(folder, 'approval-private.json'),
      correction = annalsRead_(folder, 'correction-approval-private.json'),
      publication = annalsRead_(folder, 'publication-dispatch-private.json'),
      removal = annalsRead_(folder, 'removal-private.json'),
      dispatch = annalsRead_(folder, 'removal-dispatch-private.json'),
      live = annalsRead_(folder, 'auto-live-verification-private.json');
    var current = correction && correction.publicationState === 'dispatch_accepted' ? correction : original;
    var entryId = 'annal-' + id.slice(0, 24);
    if (!original || original.publicationState !== 'dispatch_accepted' ||
        correction && correction.publicationState !== 'dispatch_accepted' ||
        !current || !current.entry || current.entry.id !== entryId || current.entry.photo ||
        !current.receipt || current.receipt.entryId !== entryId ||
        !annalsPrivateReceiptValid_(current.entry, current.receipt) ||
        !publication || publication.state !== 'accepted' ||
        !removal || removal.state !== 'dispatch_accepted' || !removal.entry ||
        !dispatch || dispatch.state !== 'accepted' || !live || live.state !== 'verified_live') return null;
    var digest = annalsHash_(AnnalsProduction.serial(current.entry));
    var approvedAt = Date.parse(current.receipt.approvedAt), verifiedAt = Date.parse(live.verifiedAt),
      removedAt = Date.parse(removal.approvedAt);
    if (live.contentSha256 !== digest || annalsHash_(AnnalsProduction.serial(removal.entry)) !== digest ||
        !Number.isFinite(approvedAt) || !Number.isFinite(verifiedAt) || !Number.isFinite(removedAt) ||
        approvedAt > verifiedAt || verifiedAt > removedAt || removedAt > Date.now()) return null;
    var expectedProof = annalsPublicRemoval_(current.entry, removal.approvedAt,
      annalsProps_().getProperty('ANNALS_PUBLISH_SIGNING_KEY') || '');
    if (!expectedProof || AnnalsProduction.serial(removal.proof) !== AnnalsProduction.serial(expectedProof)) return null;
    var query = '?checked=withdrawn-' + encodeURIComponent(id.slice(0, 16)) + '-' + String(Date.now());
    var options = { method:'get', muteHttpExceptions:true, followRedirects:false, validateHttpsCertificates:true };
    var archiveResponse = UrlFetchApp.fetch('https://raw.githubusercontent.com/justinpfisher/Stammtisch/main/data/annals-approved.json' + query, options);
    if (archiveResponse.getResponseCode() !== 200) return null;
    var rawArchive = archiveResponse.getContentText();
    if (!rawArchive || rawArchive.length > 1000000) return null;
    var archive = JSON.parse(rawArchive);
    if (!archive || archive.schemaVersion !== 1 || !Array.isArray(archive.entries) ||
        !Array.isArray(archive.approvals) || archive.entries.length !== archive.approvals.length ||
        archive.entries.some(function (e) { return !e || typeof e.id !== 'string' || !/^[a-z0-9][a-z0-9-]{5,63}$/.test(e.id) || e.id === entryId; }) ||
        archive.approvals.some(function (a) { return !a || typeof a.entryId !== 'string' || a.entryId === entryId; })) return null;
    var ids = archive.entries.map(function (e) { return e.id; }).sort(),
      approvalIds = archive.approvals.map(function (a) { return a.entryId; }).sort();
    if (ids.some(function (value, index) { return index && value === ids[index - 1]; }) ||
        AnnalsProduction.serial(ids) !== AnnalsProduction.serial(approvalIds)) return null;
    var pageResponse = UrlFetchApp.fetch('https://stammtischbrewery.com/annals.html' + query, options);
    if (pageResponse.getResponseCode() !== 200) return null;
    var html = pageResponse.getContentText();
    if (!html || html.length > 1000000 || html.indexOf('The Annals of Stammtisch') < 0 ||
        html.indexOf('class="annal-editorial-notice"') < 0 || html.indexOf('</html>') < 0 ||
        html.indexOf('id="' + entryId + '"') >= 0) return null;
    var renderedIds = [], pattern = /<article\b[^>]*\bid="([^"]+)"/g, match;
    while ((match = pattern.exec(html))) renderedIds.push(match[1]);
    renderedIds.sort();
    if (AnnalsProduction.serial(renderedIds) !== AnnalsProduction.serial(ids)) return null;
    return { state:'verified_removed', entryId:entryId, contentSha256:digest,
      priorLiveVerifiedAt:live.verifiedAt, signedWithdrawalAt:removal.approvedAt,
      verifiedAt:new Date().toISOString(), archiveSha256:annalsHash_(rawArchive), pageSha256:annalsHash_(html) };
  } catch (ignored) { return null; }
}

/** A private, write-once exclusion. Gmail and all prior source/audit files remain intact.
 * May cover an existing staged item or a message hash not encountered by intake yet.
 * No automatic release exists; it never grants consent or retries a dispatch.
 */
function annalsQuarantineSubmission_(id, reason, confirmed) {
  var owner = annalsOwner_();
  if (confirmed !== true || !/^[a-f0-9]{64}$/.test(id || '') ||
      typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 1000)
    throw new Error('Exact submission hash and explicit test quarantine reason required');
  var folder = annalsFolder_(id, true);
  if (annalsFile_(folder, 'quarantine-private.json')) return { quarantined: true, alreadyRecorded: true };
  if (annalsFile_(folder, 'approval-private.json') || annalsFile_(folder, 'publication-dispatch-private.json')) {
    var withdrawal = annalsVerifyWithdrawnTest_(folder, id);
    if (!withdrawal) throw new Error('Verified prior publication, signed withdrawal and current archive/Pages absence required');
    annalsWriteOnce_(folder, 'withdrawal-live-verification-private.json', withdrawal);
  }
  annalsWriteOnce_(folder, 'quarantine-private.json', {
    state: 'quarantined_test', at: new Date().toISOString(), owner: owner, reason: reason.trim()
  });
  return { quarantined: true, alreadyRecorded: false };
}
function annalsQuarantineSubmission(nonce, id, reason, confirmed) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    return annalsQuarantineSubmission_(id, reason, confirmed);
  }); });
}


/** One-shot private repair of the irrelevant none/true image flag on a text-only
 * captured response. No provider request or publication dispatch is made here.
 * Original response, failure, attempt and budget evidence remain unchanged.
 */
function annalsRecoverCapturedTextDraft(nonce, id, confirmed) {
  return annalsUiCall_(nonce, function () { return annalsLocked_(function () {
    if (confirmed !== true) throw new Error('Explicit captured-response review required');
    var folder = annalsFolder_(id), source = annalsRead_(folder, 'source-private.json'),
      attempt = annalsRead_(folder, 'ai-attempt-private.json'), outcome = annalsRead_(folder, 'ai-outcome-private.json'),
      evidence = annalsRead_(folder, 'ai-response-private.json');
    if (!source || source.sourceId !== id || source.senderAuthenticated !== true || source.aiConsentActive !== true ||
        source.autoConsentAtReceipt !== true || !source.attachmentManifest || !Array.isArray(source.attachmentManifest.items) || source.attachmentManifest.items.length ||
        source.source.sourceTruncated || source.source.subjectTruncated || source.source.excerptTruncated ||
        !annalsConsentActive_(source.source.sender) || !annalsStandingPublicationActive_(source.source.sender, source.source.receivedAt) ||
        !Number.isFinite(Date.parse(source.source.receivedAt)) ||
        !Number.isFinite(Date.parse(annalsProps_().getProperty('ANNALS_ACTIVATED_AT'))) ||
        Date.parse(source.source.receivedAt) < Date.parse(annalsProps_().getProperty('ANNALS_ACTIVATED_AT')) ||
        !attempt || attempt.model !== AnnalsProduction.MODEL || attempt.processingConsent !== true ||
        !Array.isArray(attempt.selectedNames) || attempt.selectedNames.length ||
        attempt.imageInputCount !== undefined && attempt.imageInputCount !== 0 ||
        attempt.submittedText !== annalsAiSourceText_(source) || !outcome || outcome.reason !== 'invalid_response' ||
        !evidence || evidence.httpStatus !== 200 || evidence.model !== AnnalsProduction.MODEL ||
        typeof evidence.responseText !== 'string' || evidence.responseText.length > 100000 ||
        annalsFile_(folder, 'quarantine-private.json') || annalsFile_(folder, 'draft-private.json') ||
        annalsFile_(folder, 'approval-private.json') || annalsFile_(folder, 'publication-dispatch-private.json') ||
        annalsFile_(folder, 'auto-decision-private.json') || annalsFile_(folder, 'captured-response-recovery-private.json'))
      throw new Error('Captured response is not eligible for private text-only repair');
    var response = JSON.parse(evidence.responseText), output = response.output;
    if (response.status !== 'completed' || !Array.isArray(output) || output.length !== 1 ||
        output[0].type !== 'message' || !Array.isArray(output[0].content) || output[0].content.length !== 1 ||
        output[0].content[0].type !== 'output_text') throw new Error('Exact completed response required');
    var raw = JSON.parse(output[0].content[0].text);
    if (!raw.imageSafety || raw.imageSafety.kind !== 'none' || raw.imageSafety.safeToPublish !== true)
      throw new Error('Only the diagnosed text-only no-image flag can be repaired');
    var candidate = AnnalsProduction.response(response, false);
    var permission = candidate.category === 'quotation' ? annalsQuoteSpeakerPermission_(source, candidate) : null;
    if (!AnnalsAuto.propose(source, candidate, id, permission).eligible)
      throw new Error('Exact source-grounding and current consent checks must pass before repair');
    var record = { state: 'repair_reserved', at: new Date().toISOString(), owner: annalsOwner_(),
      sourceDigest: annalsHash_(AnnalsProduction.serial(source.source)), responseDigest: annalsHash_(evidence.responseText),
      providerCalled: false, publishesAnything: false, repair: 'text_only_none_image_flag_false' };
    annalsWriteOnce_(folder, 'captured-response-recovery-private.json', record);
    annalsWriteOnce_(folder, 'draft-private.json', candidate);
    record.state = 'private_draft_recovered';
    annalsFile_(folder, 'captured-response-recovery-private.json').setContent(JSON.stringify(record));
    return { drafted: true, providerCalled: false, publishesAnything: false };
  }); });
}
