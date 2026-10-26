/* OPTIONAL OWNER-ONLY EDITORIAL MODULE — SOURCE MIRROR.
 * The private owner-authenticated editor has separately installed this
 * module; its presence does not activate photography or authorise spending.
 * Public GitHub never receives consent, originals, keys, budgets or permits.
 *
 * Depends on the pre-existing private Production.gs, PhotoProduction.gs,
 * AnnalsProduction/AnnalsCocktailEditorial modules and the private owner-only
 * consent registry; introduces no new trigger, public route, scheduled API
 * call or paid request. A separate explicit owner-editor preflight checks model
 * metadata with a non-billed GET; it never exposes credential values.
 */
function annalsCocktailEditorialContext_(itemId,photoIndex){
  var folder=annalsFolder_(itemId),source=annalsRead_(folder,'source-private.json'),
    original=annalsRead_(folder,'approval-private.json'),
    correction=annalsRead_(folder,'correction-approval-private.json'),
    saved=correction&&correction.publicationState==='dispatch_accepted'?correction:original;
  if(!saved||saved.publicationState!=='dispatch_accepted'||!source||!source.source||
     source.senderAuthenticated!==true||source.imageConsentAtReceipt!==true||
     source.source.sourceTruncated||source.source.subjectTruncated||
     source.source.excerptTruncated||!saved.entry||saved.entry.category!=='cocktail'||
     !annalsPrivateReceiptValid_(saved.entry,saved.receipt)||
     saved.entry.id!=='annal-'+itemId.slice(0,24)||
     !saved.receipt.consents||saved.receipt.consents.photoPublication!==true||
     !Number.isInteger(photoIndex)||photoIndex<0||photoIndex>=3)
    throw Error('Existing signed cocktail source and original photographic consent required');
  var photos=saved.entry.photos||(saved.entry.photo?[saved.entry.photo]:[]),photo=photos[photoIndex];
  if(!photo||!/^[a-f0-9]{64}$/.test(photo.sha256||'')||
     !annalsImageConsentActive_(source.source.sender,source.source.receivedAt))
    throw Error('Exact signed screened photograph and current original rights required');
  // The normal original-photo path already verified exact screened public
  // source; no pending/withdrawn/replaced photo may mint an edit permit.
  if(annalsFile_(folder,'quarantine-private.json')||
     annalsFile_(folder,'removal-private.json')||
     annalsFile_(folder,'removal-dispatch-private.json'))
    throw Error('Withdrawn or quarantined photo cannot receive an editorial edit');
  var registry=annalsConsentRegistry_(),sender=String(source.source.sender||'').toLowerCase();
  var originalRights=typeof annalsPhotoEvidence_==='function'&&
    annalsPhotoEvidence_(source).originalRights===true;
  var permission=AnnalsCocktailEditorial.evaluate({
    member:registry.members&&registry.members[sender],registry:registry,
    now:new Date(),receivedAt:source.source.receivedAt,
    senderAuthenticated:true,imageConsentAtReceipt:true,
    currentOriginalImagePermission:true,
    sourceRecordComplete:!source.source.sourceTruncated&&!source.source.subjectTruncated&&!source.source.excerptTruncated,
    securityRecoveryVerified:annalsProps_().getProperty('ANNALS_EDITORIAL_SECURITY_RECOVERY_VERIFIED')==='true',
    signedPhotoVerified:true,originalRightsVerified:originalRights,
    cocktailCategoryVerified:true,safePhotoScreeningVerified:true,
    noUnconsentedPeopleOrPrivateDetails:saved.uncertaintiesReviewed===true
  });
  if(permission.eligible!==true)throw Error(permission.reason);
  return {folder:folder,entryId:saved.entry.id,sourceSha256:photo.sha256};
}
function annalsCocktailEditorialReference_(){
  var value=annalsProps_().getProperty('ANNALS_EDITORIAL_REFERENCE_FILE_ID');
  if(!value||!/^[A-Za-z0-9_-]{15,80}$/.test(value))
    throw Error('Exact owner-approved private photographic reference not configured');
  var file=annalsPrivate_(DriveApp.getFileById(value)),blob=file.getBlob(),bytes=blob.getBytes();
  if(file.getMimeType()!=='image/jpeg'||bytes.length<4000||bytes.length>300000)
    throw Error('Owner-approved photographic reference is not bounded JPEG');
  return {sha256:annalsHash_(bytes)};
}
/** Non-spending, owner-only diagnostic; never log source, member, credential,
 * reference ID, filename, signature or permit contents. */
function annalsCocktailEditorialPreflightInEditor(itemId,photoIndex){
  annalsOwner_();
  return annalsLocked_(function(){
    var r={kind:'cocktail-editorial-private-preflight-v1',
      checkedAt:new Date().toISOString(),eligible:false,
      recoveryRequired:true,referenceReady:false,
      providerLimitVerified:false,sourceAuthenticated:false,
      providerCalled:false,published:false};
    try{
      var p=annalsProps_();
      // A Boolean-only readback never enumerates Script Properties, serialises
      // property contents or returns key prefixes. No API endpoint is invoked.
      r.recoveryRequired=p.getProperty('ANNALS_EDITORIAL_SECURITY_RECOVERY_VERIFIED')!=='true';
      var key=p.getProperty('ANNALS_EDITORIAL_PERMIT_SIGNING_KEY')||'',
        publisher=p.getProperty('ANNALS_PUBLISH_SIGNING_KEY')||'';
      r.independentSigningKeyReady=key.length>=32&&key!==publisher;
      r.imageKeyConfigured=!!p.getProperty('ANNALS_EDITORIAL_IMAGE_API_KEY');
      var ref=annalsCocktailEditorialReference_();r.referenceReady=!!ref.sha256;
      r.providerLimitVerified=p.getProperty('ANNALS_EDITORIAL_PROJECT_HARD_LIMIT_VERIFIED')==='true';
      var context=annalsCocktailEditorialContext_(itemId,photoIndex);
      r.sourceAuthenticated=!!context.sourceSha256;
      r.eligible=!r.recoveryRequired&&r.providerLimitVerified&&
        r.independentSigningKeyReady&&r.imageKeyConfigured&&r.referenceReady;
    }catch(ignored){r.eligible=false}
    return r;
  });
}
/** Read-only, non-billed credential and model-visibility probe for the
 * existing owner-only Apps Script editor. The former Script Properties view
 * may expose raw secrets; this function NEVER returns, logs or stores them.
 * A successful model lookup does NOT prove image-edit entitlement, rights,
 * spending capacity, secure key rotation or permission to send a paid request.
 */
function annalsCocktailEditorialCredentialPreflightInEditor(){
  annalsOwner_();
  var properties=annalsProps_(),
    imageKey=properties.getProperty('ANNALS_EDITORIAL_IMAGE_API_KEY')||'',
    permitKey=properties.getProperty('ANNALS_EDITORIAL_PERMIT_SIGNING_KEY')||'',
    publisherKey=properties.getProperty('ANNALS_PUBLISH_SIGNING_KEY')||'',
    approvalKey=properties.getProperty('ANNALS_APPROVAL_KEY')||'',
    result={kind:'cocktail-editorial-credential-readonly-v1',
      imageCredentialPresent:typeof imageKey==='string'&&imageKey.length>0,
      permitSignerPresentAndDistinct:typeof permitKey==='string'&&
        permitKey.length>=32&&permitKey!==publisherKey&&permitKey!==approvalKey,
      recoveryFlagSet:properties.getProperty('ANNALS_EDITORIAL_SECURITY_RECOVERY_VERIFIED')==='true',
      projectHardLimitFlagSet:properties.getProperty('ANNALS_EDITORIAL_PROJECT_HARD_LIMIT_VERIFIED')==='true',
      modelLookupAccepted:false,modelLookupStatus:'not_attempted',
      paidRequestMade:false,propertiesChanged:false};
  // Do not even query model metadata with a possibly exposed credential
  // until the owner has separately recorded protected recovery and the
  // independent permit signer is present and distinct.
  if(!result.imageCredentialPresent||!result.permitSignerPresentAndDistinct||
     !result.recoveryFlagSet)return result;
  try{
    // Public provider model-metadata endpoint: GET, not image generation.
    // Never inspect/log response text, token headers or diagnostic errors.
    var response=UrlFetchApp.fetch('https://api.openai.com/v1/models/gpt-image-2.5-sunburst',{
      method:'get',headers:{Authorization:'Bearer '+imageKey},
      followRedirects:false,muteHttpExceptions:true});
    var status=response.getResponseCode();
    result.modelLookupAccepted=status===200;
    // Endpoint access is independently permissioned: a restricted key may
    // allow image-edit requests yet deny model-catalogue metadata reads.
    // Keep this bounded enum only; never read the provider body or headers.
    result.modelLookupStatus=status===200?'model_metadata_visible':
      status===401?'authentication_or_models_read_denied':
      status===403?'access_forbidden':
      status===404?'model_not_found_or_inaccessible':
      status===429?'rate_or_quota_limited':
      status>=500&&status<=599?'provider_unavailable':
      'other_http_failure';
  }catch(ignored){
    result.modelLookupStatus='transport_failure';
  }
  return result;
}

/** Owner-only source-specific editorial permission for the already screened
 * cocktail. The provider-enforced US$5 monthly project cap replaces the
 * retired per-photo reservation ledger. Never makes a paid request.
 * Keep the same source-specific private filename so older issuances cannot
 * silently be replayed after this source upgrade.
 */
function annalsCocktailEditorialPermitInEditor(itemId,photoIndex){
  annalsOwner_();
  return annalsLocked_(function(){
    var p=annalsProps_();
    if(p.getProperty('ANNALS_EDITORIAL_SECURITY_RECOVERY_VERIFIED')!=='true'||
       p.getProperty('ANNALS_EDITORIAL_IMAGE_ENABLED')!=='true'||
       p.getProperty('ANNALS_EDITORIAL_PROJECT_HARD_LIMIT_VERIFIED')!=='true')
      throw Error('Protected editorial service or provider cap unavailable');
    var key=p.getProperty('ANNALS_EDITORIAL_PERMIT_SIGNING_KEY')||'',
      publisher=p.getProperty('ANNALS_PUBLISH_SIGNING_KEY')||'',
      approval=p.getProperty('ANNALS_APPROVAL_KEY')||'';
    if(key.length<32||key===publisher||key===approval||
       !p.getProperty('ANNALS_EDITORIAL_IMAGE_API_KEY'))
      throw Error('Independent editorial signer or provider access unavailable');
    var context=annalsCocktailEditorialContext_(itemId,photoIndex),
      reference=annalsCocktailEditorialReference_(),
      recordName='cocktail-editorial-permit-'+context.sourceSha256+'-private.json';
    if(annalsFile_(context.folder,recordName))
      throw Error('Previous editorial source issuance exists; no automatic retry');
    // Only read historical budget reservations for replay compatibility.
    // No new ledger, reservation, balance or monetary approval is created.
    var historical=annalsRead_(annalsRoot_(),'cocktail-editorial-budget-private.json');
    if(historical && (!Array.isArray(historical.reservations) ||
        historical.reservations.some(function(r){
          return !r || typeof r.sourceSha256!=='string' ||
            r.sourceSha256===context.sourceSha256;
        }))) throw Error('Historical source attempt needs reconciliation');
    var unsigned=AnnalsCocktailEditorial.unsignedPermit({
      entryId:context.entryId,sourceSha256:context.sourceSha256,
      referenceSha256:reference.sha256,rightsEligible:true,
      sourceStillSigned:true,
      nonce:Utilities.getUuid().replace(/-/g,'').toLowerCase(),now:new Date()
    });
    var signature=annalsHex_(Utilities.computeHmacSha256Signature(
      AnnalsCocktailEditorial.serial(unsigned),key,Utilities.Charset.UTF_8));
    annalsWriteOnce_(context.folder,recordName,{
      permit:Object.assign({},unsigned,{signature:signature}),
      state:'issued_unspent',at:new Date().toISOString(),
      providerCalled:false,generatedImageQualified:false,publicRelease:false
    });
    return {issued:true,providerCalled:false,published:false};
  });
}

/** Source-only, one-shot producer for the supervised native image worker.
 * Current source, original-image rights and editorial transformation rights
 * are re-evaluated before a private job is reserved and sent. */
function annalsIssueCocktailPhotoJob_(itemId,photoIndex){
  var context=annalsCocktailEditorialContext_(itemId,photoIndex),
    source=annalsRead_(context.folder,'source-private.json'),
    saved=annalsRead_(context.folder,'approval-private.json'),
    entry=saved&&saved.entry;
  if(!entry||entry.category!=='cocktail'||entry.id!==context.entryId||
     !saved.receipt.consents||saved.receipt.consents.photoPublication!==true)
    return {state:'held',reason:'source_not_eligible'};
  var photos=entry.photos||(entry.photo?[entry.photo]:[]),photo=photos[photoIndex];
  if(!photo||photo.sha256!==context.sourceSha256)return {state:'held',reason:'source_changed'};
  var set=annalsPhotoSet_(itemId,source,false),image=set.filter(function(x){return x.sha256===photo.sha256})[0];
  if(!image||typeof image.base64!=='string')return {state:'held',reason:'screened_source_unavailable'};
  var props=annalsProps_(),recipient=String(props.getProperty('ANNALS_PHOTO_WORKER_EMAIL')||'').trim().toLowerCase();
  if(!/^[^@\s<>]+@[^@\s]+\.[^@\s]+$/.test(recipient))
    return {state:'held',reason:'worker_address_unconfigured'};
  var styleVersion='cocktail-cinematic-photoreal-v1',
    filename='cocktail-photo-job-'+context.sourceSha256+'-'+styleVersion+'-private.json';
  if(annalsFile_(context.folder,filename))return {state:'already_reserved'};
  var token=Utilities.getUuid().replace(/-/g,'').toLowerCase();
  var job=AnnalsCocktailEditorial.photoJob({
    entryId:context.entryId,sourceSha256:context.sourceSha256,
    photoIndex:photoIndex,jobToken:token,name:entry.title,
    description:entry.summary,
    ingredients:entry.recipe&&entry.recipe.drinkIngredients,
    keywords:source.visualKeywords||source.source&&source.source.visualKeywords||''
  });
  var now=new Date(),record={schema:'annals-photo-job-private-v1',job:job,
    sourceItemId:itemId,styleVersion:styleVersion,
    createdAt:now.toISOString(),expiresAt:new Date(now.getTime()+7*24*60*60*1000).toISOString(),
    state:'attempt_reserved',sendOutcome:'unknown_no_retry',resultMessageId:''};
  annalsWriteOnce_(context.folder,filename,record);
  var file=annalsFile_(context.folder,filename);
  try{
    var bytes=Utilities.base64Decode(image.base64);
    if(bytes.length<4000||bytes.length>5*1024*1024||annalsHash_(bytes)!==photo.sha256||
       !annalsJpegDerivativeSafe_(bytes))throw Error('Screened source image failed integrity checks');
    var attachment=Utilities.newBlob(bytes,'image/jpeg','annals-cocktail-source.jpg');
    GmailApp.sendEmail(recipient,'[ANNALS PHOTO JOB v1] '+token,JSON.stringify(job),{
      attachments:[attachment],name:'Stammtisch Annals'
    });
    record.state='sent_once';record.sendOutcome='sent';record.sentAt=new Date().toISOString();
    file.setContent(JSON.stringify(record));
    return {state:'sent_once'};
  }catch(ignored){
    record.state='send_failed_no_retry';record.sendOutcome='failed';
    record.failedAt=new Date().toISOString();
    file.setContent(JSON.stringify(record));
    return {state:'send_failed_no_retry'};
  }
}
