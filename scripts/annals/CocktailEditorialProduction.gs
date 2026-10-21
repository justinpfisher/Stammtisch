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
      independentBudgetReady:false,sourceAuthenticated:false,
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
      var ledger=annalsRead_(annalsRoot_(),'cocktail-editorial-budget-private.json');
      r.independentBudgetReady=!!AnnalsCocktailEditorial.validateLedger(ledger);
      var context=annalsCocktailEditorialContext_(itemId,photoIndex);
      r.sourceAuthenticated=!!context.sourceSha256;
      r.eligible=!r.recoveryRequired&&r.independentBudgetReady&&
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
    // allow /v1/images requests yet deny /v1/models metadata reads.
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

/** Owner-only private reservation; does NOT call OpenAI or publish a photo.
 * Install only AFTER independent post-exposure secret/signing recovery.
 * One lock covers read/plan/save of the separate private spending ledger.
 */
function annalsCocktailEditorialReserveInEditor(itemId,photoIndex){
  annalsOwner_();
  return annalsLocked_(function(){
    var p=annalsProps_();
    if(p.getProperty('ANNALS_EDITORIAL_SECURITY_RECOVERY_VERIFIED')!=='true'||
       p.getProperty('ANNALS_EDITORIAL_IMAGE_ENABLED')!=='true'||
       p.getProperty('ANNALS_EDITORIAL_PROJECT_HARD_LIMIT_VERIFIED')!=='true')
      throw Error('Protected editorial service remains disabled');
    var key=p.getProperty('ANNALS_EDITORIAL_PERMIT_SIGNING_KEY')||'',
      publisher=p.getProperty('ANNALS_PUBLISH_SIGNING_KEY')||'',
      approval=p.getProperty('ANNALS_APPROVAL_KEY')||'';
    if(key.length<32||key===publisher||key===approval||
       !p.getProperty('ANNALS_EDITORIAL_IMAGE_API_KEY'))
      throw Error('Separate recovered editorial credential is unavailable');
    var context=annalsCocktailEditorialContext_(itemId,photoIndex),
      reference=annalsCocktailEditorialReference_(),root=annalsRoot_(),
      budgetFile='cocktail-editorial-budget-private.json',
      history=annalsRead_(root,budgetFile);
    // No automatic ledger creation or deletion: an absent/corrupt file may
    // conceal a consumed/uncertain paid operation from earlier attempts.
    var proposed=AnnalsCocktailEditorial.planReservation({
      ledger:history,entryId:context.entryId,
      sourceSha256:context.sourceSha256,referenceSha256:reference.sha256,
      rightsEligible:true,sourceStillSigned:true,now:new Date()
    });
    var recordName='cocktail-editorial-permit-'+context.sourceSha256+'-private.json';
    if(annalsFile_(context.folder,recordName))
      throw Error('Prior editorial permit exists; no automatic retry');
    // Fail closed if the Drive save is uncertain: no provider request is made
    // in this function, so the owner can reconcile the ledger and journal.
    annalsSavePrivate_(root,budgetFile,proposed.ledger);
    var unsigned=AnnalsCocktailEditorial.unsignedPermit({
      ledger:proposed.ledger,entryId:context.entryId,
      sourceSha256:context.sourceSha256,referenceSha256:reference.sha256,
      rightsEligible:true,nonce:Utilities.getUuid().replace(/-/g,'').toLowerCase(),
      now:new Date(proposed.reservation.reservedAt)
    });
    var signature=annalsHex_(Utilities.computeHmacSha256Signature(
      AnnalsCocktailEditorial.serial(unsigned),key,Utilities.Charset.UTF_8));
    // Permit never appears in public GitHub or Apps Script execution logs.
    annalsWriteOnce_(context.folder,recordName,{permit:Object.assign({},unsigned,{signature:signature}),
      state:'reserved_unspent',at:new Date().toISOString(),providerCalled:false,
      generatedImageQualified:false,publicRelease:false});
    return {reserved:true,requestMade:false,published:false,
      reservationCents:proposed.reservation.reservationCents,
      period:proposed.reservation.period};
  });
}
