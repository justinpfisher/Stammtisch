/* Owner-authorised guarded release, 18 October 2026. No acceptance is implied.
 * Uses existing authority, storage, budget, activation boundary and trigger.
 * Editor entry points require the actual owner; no remote configuration API.
 */
function annalsGuardedControls_(){
  var p=annalsProps_(),root=annalsRoot_();
  annalsRuleAcceptanceSecurity_();
  var allowed=AnnalsPilot.allowedSenders(p.getProperty('ANNALS_ALLOWED_SENDERS')||''),members=annalsConsentRegistry_().members;
  if(allowed.length!==6||!annalsSpeakerIdentities_())throw Error('Existing six-member identity required');
  allowed.forEach(function(a){if(!annalsConsentActive_(a)||!members[a].autoPublication||members[a].autoPublication.status!=='active'||members[a].autoPublication.revokedAt)throw Error('Preserve current member permissions');});
  var ledger=JSON.parse(p.getProperty('ANNALS_BUDGET_LEDGER')||'null');
  if(!ledger||ledger.schemaVersion!==1||!Number.isSafeInteger(ledger.reservedCents)||ledger.reservedCents<0||ledger.reservedCents>500)throw Error('Existing budget control unavailable');
  if(!annalsPublisherDispatchReady_())throw Error('Publisher credential expiry control unavailable');
  if(p.getProperty('ANNALS_PRODUCTION_INTAKE_ENABLED')!=='true'||p.getProperty('ANNALS_AI_ENABLED')!=='true'||
    p.getProperty('ANNALS_GITHUB_REPOSITORY')!=='justinpfisher/Stammtisch'||!p.getProperty('ANNALS_GITHUB_TOKEN')||
    !p.getProperty('ANNALS_OPENAI_API_KEY')||!Number.isFinite(Date.parse(p.getProperty('ANNALS_ACTIVATED_AT')))||
    (p.getProperty('ANNALS_APPROVAL_KEY')||'').length<32||(p.getProperty('ANNALS_PUBLISH_SIGNING_KEY')||'').length<32||
    p.getProperty('ANNALS_APPROVAL_KEY')===p.getProperty('ANNALS_PUBLISH_SIGNING_KEY'))throw Error('Existing production configuration required');
  var triggers=ScriptApp.getProjectTriggers();
  if(triggers.length!==1||triggers[0].getHandlerFunction()!=='runAnnalsProductionIntake')throw Error('Preserve the single intake trigger');
  ['history-pending-private.json','col-release-pending-private.json'].forEach(function(name){var r=annalsRead_(root,name);if(r&&['verified_live','verified_cancelled'].indexOf(r.state)<0)throw Error('Pending release requires reconciliation');});
  return {allowlistCount:6,currentTextPermissions:6,singleTrigger:true,signingRecordVerified:true,budgetReservedCents:ledger.reservedCents,
    aiStop:null,dispatchStop:new Date(annalsPublisherExpiry_()).toISOString(),historicalWithdrawalGapPreserved:true};
}
function annalsGuardedAuditNextInEditor(){
  annalsOwner_();return annalsLocked_(function(){
    var controls=annalsGuardedControls_(),root=annalsRoot_(),p=annalsProps_(),name='guarded-launch-audit-private.json';
    var audit=annalsRead_(root,name);
    if(!audit){audit={kind:'guarded-production-reconciliation-v1',startedAt:new Date().toISOString(),checked:0,quarantined:0,withdrawn:0,blocked:0,complete:false};}
    if(audit.complete){console.log(JSON.stringify(audit));return audit;}
    var archive=UrlFetchApp.fetch('https://stammtischbrewery.com/data/annals-approved.json',{muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
    var page=UrlFetchApp.fetch('https://stammtischbrewery.com/annals.html',{muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
    if(archive.getResponseCode()!==200||page.getResponseCode()!==200)throw Error('Fresh public reconciliation unavailable');
    var current=JSON.parse(archive.getContentText());
    // The established initial empty archive is an explicit bounded release
    // condition, never a reason to remove a subsequently genuine publication.
    if(!Array.isArray(current.entries)||current.entries.length||/<article\b[^>]*\bid="annal-/.test(page.getContentText()))throw Error('Nonempty archive requires exact independent reconciliation');
    var folders=audit.cursor?DriveApp.continueFolderIterator(audit.cursor):root.getFolders(),checked=0;
    while(folders.hasNext()&&checked++<8){var f=annalsPrivate_(folders.next());if(!/^[a-f0-9]{64}$/.test(f.getName()))continue;
      audit.checked++;
      var files=f.getFiles(),names={};while(files.hasNext()){var file=files.next();names[file.getName()]=true;}
      if(names['approval-private.json']){
        var a=annalsRead_(f,'approval-private.json'),d=annalsRead_(f,'publication-dispatch-private.json'),r=annalsRead_(f,'removal-dispatch-private.json');
        if(a&&d&&d.state==='accepted'&&r&&r.state==='accepted')audit.withdrawn++;else audit.blocked++;
      }else if(names['publication-dispatch-private.json']||names['photo-upload-private.json']||names['correction-photo-upload-private.json']||names['correction-dispatch-private.json']||names['removal-dispatch-private.json'])audit.blocked++;
      if(names['quarantine-private.json'])audit.quarantined++;
    }
    if(folders.hasNext())audit.cursor=folders.getContinuationToken();else{delete audit.cursor;audit.complete=true;audit.completedAt=new Date().toISOString();audit.controls=controls;}
    annalsSavePrivate_(root,name,audit);
    var result=Object.assign({},audit);delete result.cursor;console.log(JSON.stringify(result));return result;
  });
}
function annalsGuardedEnableTextInEditor(){
  annalsOwner_();return annalsLocked_(function(){
    var controls=annalsGuardedControls_(),root=annalsRoot_(),p=annalsProps_(),audit=annalsRead_(root,'guarded-launch-audit-private.json');
    if(!audit||!audit.complete||audit.blocked||!Number.isFinite(Date.parse(audit.completedAt))||Date.parse(audit.completedAt)>Date.now()||Date.now()-Date.parse(audit.completedAt)>900000)throw Error('Fresh complete reconciliation required');
    var name='guarded-text-launch-private.json',record=annalsRead_(root,name);
    if(!record){record={kind:'owner-risk-accepted-guarded-text-launch-v1',at:new Date().toISOString(),authority:'Issue 24 owner release direction 2026-10-17 and direct 2026-10-18 instruction',genuineNewAcceptance:false,priorTextPublishWithdrawalEvidenceRetained:true,controls:controls};annalsWriteOnce_(root,name,record);}
    p.setProperty('ANNALS_AUTO_PUBLICATION_ENABLED','true');
    return annalsGuardedLaunchReadbackCore_();
  });
}
function annalsGuardedLaunchReadbackCore_(){
  var p=annalsProps_(),r={};['ANNALS_PRODUCTION_INTAKE_ENABLED','ANNALS_AI_ENABLED','ANNALS_AUTO_PUBLICATION_ENABLED','ANNALS_AUTO_MEDIA_ENABLED','ANNALS_PHOTOS_V2_ENABLED','ANNALS_PHOTOS_HOSTED_ACCEPTED','ANNALS_PHOTOS_GUARDED_JPEG_ENABLED','ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED','ANNALS_HISTORY_PUBLICATION_ENABLED'].forEach(function(k){r[k]=p.getProperty(k)==='true';});
  var historyKey=p.getProperty('ANNALS_HISTORY_SIGNING_KEY')||'';r.distinctHistorySigningAuthorityPresent=historyKey.length>=32&&historyKey!==p.getProperty('ANNALS_APPROVAL_KEY')&&historyKey!==p.getProperty('ANNALS_PUBLISH_SIGNING_KEY');
  r.controls=annalsGuardedControls_();console.log(JSON.stringify(r));return r;
}
function annalsGuardedLaunchReadbackInEditor(){annalsOwner_();return annalsLocked_(annalsGuardedLaunchReadbackCore_);}
/** Read-only, bounded production configuration snapshot. This does NOT run
 * the heavyweight signing/source-reconciliation gates, read private Drive,
 * call a provider or examine journals. It cannot certify a publication.
 * Use when the comprehensive owner diagnostic exceeds Apps Script limits.
 */
function annalsQuickProductionReadbackInEditor(){
  annalsOwner_();
  var p=annalsProps_().getProperties(),flags={};
  ['ANNALS_PRODUCTION_INTAKE_ENABLED','ANNALS_AI_ENABLED','ANNALS_AUTO_PUBLICATION_ENABLED',
    'ANNALS_AUTO_MEDIA_ENABLED','ANNALS_PHOTOS_V2_ENABLED','ANNALS_PHOTOS_GUARDED_JPEG_ENABLED',
    'ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED','ANNALS_PHOTOS_HOSTED_ACCEPTED',
    'ANNALS_HISTORY_PUBLICATION_ENABLED'].forEach(function(k){flags[k]=p[k]==='true';});
  var budget=null;
  try{budget=JSON.parse(p.ANNALS_BUDGET_LEDGER||'null');}catch(ignored){}
  var approved=p.ANNALS_APPROVAL_KEY||'',publisher=p.ANNALS_PUBLISH_SIGNING_KEY||'',
    history=p.ANNALS_HISTORY_SIGNING_KEY||'';
  var cutoff=annalsPublisherExpiry_(),triggers=null;
  try{triggers=ScriptApp.getProjectTriggers();}catch(ignored){}
  var report={
    kind:'owner-fast-configuration-readback-v1',observedAt:new Date().toISOString(),
    flags:flags,allowedSenderCount:AnnalsPilot.allowedSenders(p.ANNALS_ALLOWED_SENDERS||'').length,
    intakeTriggerCount:triggers?triggers.length:null,
    soleTriggerIsIntake:!!(triggers&&triggers.length===1&&
      triggers[0].getHandlerFunction()==='runAnnalsProductionIntake'),
    // Apps Script does not expose a time trigger's actual interval here.
    // This is the one-shot installation marker, NOT observed execution.
    intakeFiveMinuteMarkerPresent:p.ANNALS_INTAKE_CADENCE_MINUTES==='5',
    intakeIntervalObservedByThisCheck:false,
    budgetMonth:budget&&/^\d{4}-\d{2}$/.test(budget.month||'')?budget.month:null,
    budgetReservedCents:budget&&budget.schemaVersion===1&&
      Number.isSafeInteger(budget.reservedCents)&&budget.reservedCents>=0&&budget.reservedCents<=500?
      budget.reservedCents:null,
    approvalSigningMaterialPresent:approved.length>=32,
    publisherSigningMaterialPresent:publisher.length>=32,
    historySigningMaterialPresent:history.length>=32,
    signingMaterialsSeparate:approved.length>=32&&publisher.length>=32&&history.length>=32&&
      approved!==publisher&&approved!==history&&publisher!==history,
    publisherCredentialPresent:!!p.ANNALS_GITHUB_TOKEN,
    // A configured Script Property differs from the code's fallback cutoff.
    // Neither can by itself prove GitHub's actual credential expiry.
    publisherExpirySource:p.ANNALS_GITHUB_TOKEN_EXPIRES_AT?'installed_script_property':'source_fallback',
    publisherTokenExpiryVerifiedByProvider:false,
    publisherCutoff:Number.isFinite(cutoff)?new Date(cutoff).toISOString():null,
    publisherCutoffInFuture:Number.isFinite(cutoff)&&cutoff>Date.now(),
    providerAuthenticationVerifiedByThisCheck:false,
    signedJournalOrConsentVerificationPerformed:false,
    publicationVerifiedByThisCheck:false
  };
  console.log(JSON.stringify(report));
  return report;
}


// This marker describes risk-accepted production, never genuine photo acceptance.
function annalsGuardedPhotosReady_(){
  var p=annalsProps_();return p.getProperty('ANNALS_PHOTOS_GUARDED_JPEG_ENABLED')==='true'&&
    p.getProperty('ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED')==='true';
}
/** Historical function name retained to support the existing private
 * deployment identity and partial module updates. The guarded release now
 * accepts still JPEG, PNG, WebP and HEIC/HEIF source types, but the only
 * publishable derivative is a decoded, oriented, metadata-free signed JPEG.
 * A non-JPEG is held if the private qualified conversion module is absent. */
function publishGuardedJpegOnly_(source){
  if(!annalsGuardedPhotosReady_())return true;
  var items=source&&source.attachmentManifest&&source.attachmentManifest.items;
  return Array.isArray(items)&&items.length>0&&items.length<=3&&items.every(function(x){
    if(!x||x.accepted!==true||!Number.isSafeInteger(x.size)||x.size<=0||x.size>8*1024*1024)return false;
    if(x.mime==='image/jpeg')return true;
    return ['image/png','image/webp','image/heic','image/heif'].includes(x.mime)&&
      typeof annalsStillPhotoSource_==='function'&&typeof AnnalsPhotoDerivative!=='undefined'&&
      typeof AnnalsJpegCodec!=='undefined';
  });
}
function annalsGuardedEnableJpegInEditor(){
  annalsOwner_();return annalsLocked_(function(){
    annalsGuardedControls_();var p=annalsProps_(),root=annalsRoot_();
    if(p.getProperty('ANNALS_AUTO_PUBLICATION_ENABLED')!=='true')throw Error('Restore text first');
    var fixture=annalsRead_(root,'photo-codec-fixture-v1-private.json');
    if(!fixture||fixture.state!=='passed_fixture_only')throw Error('Private codec runtime fixture required; genuine-photo acceptance remains unverified');
    var name='guarded-jpeg-launch-private.json';
    if(!annalsRead_(root,name))annalsWriteOnce_(root,name,{kind:'owner-risk-accepted-guarded-jpeg-launch-v1',at:new Date().toISOString(),genuinePhotoAccepted:false,formats:['image/jpeg'],authority:'Issue 24 and direct 18 October 2026 guarded release instruction',physicalDeviceAccepted:false});
    p.setProperty('ANNALS_PHOTOS_GUARDED_JPEG_ENABLED','true');
    p.setProperty('ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED','true');
    p.setProperty('ANNALS_PHOTOS_V2_ENABLED','true');
    p.setProperty('ANNALS_AUTO_MEDIA_ENABLED','true');
    return annalsGuardedLaunchReadbackCore_();
  });
}
