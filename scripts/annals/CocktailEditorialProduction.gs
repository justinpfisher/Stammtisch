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
  // Cocktail art may edit only a screened drink/object photograph. An ordinary
  // group photo stays on the authentic-photo route and is never transformed
  // into a drink rendition. People in the original are not a hold; private
  // details and unrelated rights problems remain screened.
  var draft=annalsRead_(folder,'draft-private.json'),set=annalsRead_(folder,'photos-v2-private.json'),
    screenIndex=Array.isArray(set)?set.findIndex(function(p){return p.sha256===photo.sha256;}):-1,
    screen=draft&&Array.isArray(draft.imageReviews)&&draft.imageReviews[screenIndex];
  if(screenIndex<0||!screen||screen.kind!=='drink_or_object'||screen.safeToPublish!==true||
     screen.privateDetails!==false||screen.thirdPartyMaterial!==false)
    throw Error('Exact screened cocktail object and private-detail check required');
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
    cocktailCategoryVerified:true,safePhotoScreeningVerified:true
  });
  if(permission.eligible!==true)throw Error(permission.reason);
  return {folder:folder,entry:saved.entry,entryId:saved.entry.id,sourceSha256:photo.sha256};
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
/* Gmail may fold long plain-text lines inside JSON string values. Keep the
 * worker payload lossless by sending UTF-8 JSON as a Base64URL envelope.
 * Worker contract: verify this exact header, remove ASCII whitespace from the
 * remaining Base64URL payload, decode UTF-8, then JSON.parse and retain all
 * existing token/entry/source-hash checks. */
function annalsPhotoJobMessageBody_(job){
  if(!job||job.schema!=='annals-photo-job-v1')throw Error('Photo job contract required');
  var json=JSON.stringify(job);
  if(typeof json!=='string')throw Error('Photo job JSON unavailable');
  var bytes=Utilities.newBlob(json,'text/plain','annals-photo-job.json').getBytes();
  return '[ANNALS PHOTO JOB JSON V1]\n'+Utilities.base64EncodeWebSafe(bytes);
}

function annalsIssueCocktailPhotoJob_(itemId,photoIndex){
  if(annalsProps_().getProperty('ANNALS_PHOTO_WORKFLOW_ENABLED')!=='true')
    return {state:'held',reason:'native_photo_workflow_disabled'};
  var context=annalsCocktailEditorialContext_(itemId,photoIndex),
    source=annalsRead_(context.folder,'source-private.json'),
    saved=annalsRead_(context.folder,'approval-private.json'),
    entry=saved&&saved.entry;
  var live=annalsRead_(context.folder,'auto-live-verification-private.json');
  if(!live||live.state!=='verified_live'||live.contentSha256!==saved.receipt.contentSha256)
    return {state:'held',reason:'source_not_live_reconciled'};
  if(!entry||entry.category!=='cocktail'||entry.id!==context.entryId||!Array.isArray(entry.photos)||
     !saved.receipt.consents||saved.receipt.consents.photoPublication!==true)
    return {state:'held',reason:'source_not_eligible'};
  var photos=entry.photos,photo=photos[photoIndex];
  if(!photo||photo.sha256!==context.sourceSha256)return {state:'held',reason:'source_changed'};
  var existingEditorial=annalsEditorialSourceAlreadyQualified_('assets/annals/'+photo.sha256+'.jpg');
  if(existingEditorial!==false)return {state:existingEditorial===true?'already_editorialized':'held',
    reason:existingEditorial===true?'':'editorial_manifest_unavailable'};
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
  var indexName='cocktail-photo-job-token-'+token+'-private.json',
    rootIndex={schema:'annals-photo-job-index-v1',sourceItemId:itemId,
      jobFilename:filename,jobToken:token,entryId:context.entryId,
      sourceSha256:context.sourceSha256,expiresAt:record.expiresAt,
      state:'attempt_reserved'};
  annalsWriteOnce_(annalsRoot_(),indexName,rootIndex);
  annalsWriteOnce_(context.folder,filename,record);
  var file=annalsFile_(context.folder,filename),root=annalsRoot_();
  var sendAttempted=false;
  try{
    var bytes=Utilities.base64Decode(image.base64);
    if(bytes.length<4000||bytes.length>5*1024*1024||annalsHash_(bytes)!==photo.sha256||
       !annalsJpegDerivativeSafe_(bytes))throw Error('Screened source image failed integrity checks');
    var attachment=Utilities.newBlob(bytes,'image/jpeg','annals-cocktail-source.jpg');
    sendAttempted=true;
    GmailApp.sendEmail(recipient,'[ANNALS PHOTO JOB v1] '+token,annalsPhotoJobMessageBody_(job),{
      attachments:[attachment],name:'Stammtisch Annals'
    });
    record.state='sent_once';record.sendOutcome='sent';record.sentAt=new Date().toISOString();
    file.setContent(JSON.stringify(record));
    rootIndex.state='sent_once';rootIndex.sentAt=record.sentAt;
    annalsSavePrivate_(root,indexName,rootIndex);
    return {state:'sent_once'};
  }catch(ignored){
    record.state=sendAttempted?'unknown_no_retry':'held_no_send';
    record.sendOutcome=sendAttempted?'unknown_no_retry':'not_attempted';
    record.failedAt=new Date().toISOString();
    file.setContent(JSON.stringify(record));
    rootIndex.state=record.state;rootIndex.failedAt=record.failedAt;
    annalsSavePrivate_(root,indexName,rootIndex);
    annalsNotifyCocktailPhotoOwner_(context.folder,itemId,token,'photo_result_held');
    return {state:record.state};
  }
}

/** Consume one authenticated worker result privately, then hand a fully
 * verified qualified result to the existing signed publisher when enabled. */
function annalsHandleCocktailPhotoResult_(message){
  var subject='';
  try{subject=String(message.getSubject()||'');}catch(ignored){return null;}
  if(!/\[ANNALS PHOTO RESULT\s+V1\]/i.test(subject))return null;
  var match=/^\[ANNALS PHOTO RESULT V1\] ([a-f0-9]{32})$/i.exec(subject);
  if(!match)return 'photo_result_held';
  var token=match[1].toLowerCase(),props=annalsProps_(),
    worker=String(props.getProperty('ANNALS_PHOTO_WORKER_EMAIL')||'').trim().toLowerCase(),
    sender='';
  try{sender=AnnalsPilot.senderAddress(message.getFrom()).toLowerCase();}catch(ignored){}
  // Exact, authenticated sender is checked before body or attachment access.
  if(!worker||sender!==worker||!annalsPhotoResultIsOwnerSent_(message,worker))
    return 'photo_result_held';
  var result;
  try{
    var body=String(message.getPlainBody()||'').trim();
    if(!body||body.length>2048)return 'photo_result_held';
    result=JSON.parse(body);
  }catch(ignored){return 'photo_result_held';}
  var root=annalsRoot_(),now=new Date(),
    canaryIndex=annalsRead_(root,'cocktail-photo-canary-token-'+token+'-private.json');
  if(canaryIndex)return annalsHandleCocktailPhotoCanaryResult_(
    message,sender,token,result,canaryIndex,root,now);
  var indexName='cocktail-photo-job-token-'+token+'-private.json',
    index=annalsRead_(root,indexName);
  if(!index||index.schema!=='annals-photo-job-index-v1'||index.jobToken!==token||
     index.state!=='sent_once'||Date.parse(index.expiresAt)<=now.getTime())
    return 'photo_result_held';
  var folder=annalsFolder_(index.sourceItemId),jobRecord=annalsRead_(folder,index.jobFilename),
    job=jobRecord&&jobRecord.job,consumeName='cocktail-photo-consume-'+token+'-private.json',
    attemptName='cocktail-photo-attempt-'+token+'-private.json',
    attemptRecord=annalsRead_(folder,attemptName),
    resultName='cocktail-photo-result-'+token+'-private.json',
    imageName='cocktail-photo-result-'+token+'-private.jpg';
  if(!jobRecord||jobRecord.state!=='sent_once'||!job||job.jobToken!==token||
     jobRecord.sourceItemId!==index.sourceItemId||jobRecord.expiresAt!==index.expiresAt||
     !attemptRecord||attemptRecord.schema!=='annals-photo-attempt-v1'||
     ['claim_accepted','generation_started'].indexOf(attemptRecord.state)<0||
     result.attemptId!==attemptRecord.attemptId||
     attemptRecord.entryId!==job.entryId||attemptRecord.sourceSha256!==job.sourceSha256||
     annalsFile_(folder,consumeName)||annalsFile_(folder,resultName)||annalsFile_(folder,imageName))
    return 'photo_result_held';
  var outcome;
  try{outcome=AnnalsCocktailEditorial.validatePhotoResult(result,job,true,now,attemptRecord.attemptId);}
  catch(ignored){return 'photo_result_held';}
  if(outcome.qualified&&(attemptRecord.state!=='generation_started'||
     result.generatedAt!==attemptRecord.generatedAt))return 'photo_result_held';
  if(outcome.qualified){
    var sentAt=Date.parse(jobRecord.sentAt),generatedAt=Date.parse(result.generatedAt),reviewedAt=Date.parse(result.reviewedAt);
    if(!Number.isFinite(sentAt)||generatedAt<sentAt-30000||reviewedAt<generatedAt||
       reviewedAt>now.getTime()+30000)return 'photo_result_held';
  }
  var attachments;
  try{attachments=message.getAttachments({includeInlineImages:false,includeAttachments:true});}
  catch(ignored){return 'photo_result_held';}
  if(!Array.isArray(attachments))return 'photo_result_held';
  var bytes=null,width=0,height=0,imageSha='';
  if(outcome.qualified){
    if(attachments.length!==1)return 'photo_result_held';
    try{
      var blob=attachments[0],mime=String(blob.getContentType()||'').toLowerCase();
      if(mime!=='image/jpeg')return 'photo_result_held';
      bytes=blob.getBytes();
      if(!bytes||bytes.length<4000||bytes.length>5*1024*1024||
         !annalsJpegDerivativeSafe_(bytes))return 'photo_result_held';
      var clean=AnnalsMedia.sanitizeEditorial(bytes,AnnalsJpegCodec);
      if(!clean||!clean.bytes||annalsHash_(clean.bytes)!==annalsHash_(bytes)||
         clean.width<480||clean.height<480||clean.width>2560||clean.height>2560)
        return 'photo_result_held';
      width=clean.width;height=clean.height;imageSha=annalsHash_(bytes);
      if(imageSha===job.sourceSha256)return 'photo_result_held';
    }catch(ignored){return 'photo_result_held';}
  }else if(attachments.length!==0){
    return 'photo_result_held';
  }
  // Re-evaluate the exact source, public live marker, original consent and
  // current member/owner transformation rights before consuming this reply.
  var context;
  try{
    context=annalsCocktailEditorialContext_(index.sourceItemId,job.photoIndex);
    var live=annalsRead_(folder,'auto-live-verification-private.json'),
      saved=annalsRead_(folder,'approval-private.json');
    if(context.entryId!==job.entryId||context.sourceSha256!==job.sourceSha256||
       !live||live.state!=='verified_live'||!saved||!saved.receipt||
       live.contentSha256!==saved.receipt.contentSha256||
       index.entryId!==job.entryId||index.sourceSha256!==job.sourceSha256)
      return annalsPhotoResultTerminalHold_(root,indexName,index,folder,jobRecord,consumeName,
        resultName,token,'source_changed_or_revoked',now);
  }catch(ignored){
    return annalsPhotoResultTerminalHold_(root,indexName,index,folder,jobRecord,consumeName,
      resultName,token,'source_changed_or_revoked',now);
  }
  annalsWriteOnce_(folder,consumeName,{schema:'annals-photo-consume-v1',
    jobToken:token,state:'result_attempt_reserved',at:now.toISOString()});
  if(!outcome.qualified){
    annalsWriteOnce_(folder,resultName,{schema:'annals-photo-stored-result-v1',
      jobToken:token,entryId:job.entryId,sourceSha256:job.sourceSha256,
      attemptId:attemptRecord.attemptId,state:'worker_held',reasonCode:outcome.reason,receivedAt:now.toISOString()});
    jobRecord.state='worker_held';jobRecord.consumedAt=now.toISOString();
    index.state='worker_held';index.consumedAt=now.toISOString();
    annalsSavePrivate_(folder,index.jobFilename,jobRecord);
    annalsSavePrivate_(root,indexName,index);
    annalsSavePrivate_(folder,consumeName,{schema:'annals-photo-consume-v1',
      jobToken:token,state:'worker_held',at:now.toISOString()});
    attemptRecord.state='result_received';attemptRecord.resultMessageId=String(message.getId()||'');
    attemptRecord.resultReceivedAt=now.toISOString();attemptRecord.reasonCode=outcome.reason;
    annalsSavePrivate_(folder,attemptName,attemptRecord);
    annalsNotifyCocktailPhotoOwner_(folder,index.sourceItemId,token,'photo_result_held');
    return 'photo_result_held';
  }
  try{
    var outBlob=Utilities.newBlob(bytes,'image/jpeg',imageName),
      file=annalsPrivate_(folder.createFile(outBlob));
    if(file.getName()!==imageName)file.setName(imageName);
    annalsWriteOnce_(folder,resultName,{schema:'annals-photo-stored-result-v1',
      jobToken:token,entryId:job.entryId,sourceSha256:job.sourceSha256,
      photoIndex:job.photoIndex,attemptId:attemptRecord.attemptId,state:'qualified_held_for_publisher',
      imageFilename:imageName,imageSha256:imageSha,width:width,height:height,
      alt:outcome.alt,qa:result.qa,receivedAt:now.toISOString(),
      generatedAt:outcome.generatedAt,reviewedAt:outcome.reviewedAt,
      generationProvider:outcome.generationProvider,generationModel:outcome.generationModel});
    jobRecord.state='result_received_private';jobRecord.consumedAt=now.toISOString();
    index.state='result_received_private';index.consumedAt=now.toISOString();
    annalsSavePrivate_(folder,index.jobFilename,jobRecord);
    annalsSavePrivate_(root,indexName,index);
    annalsSavePrivate_(folder,consumeName,{schema:'annals-photo-consume-v1',
      jobToken:token,state:'result_received_private',at:now.toISOString()});
    attemptRecord.state='result_received';attemptRecord.resultMessageId=String(message.getId()||'');
    attemptRecord.resultReceivedAt=now.toISOString();attemptRecord.editedSha256=imageSha;
    annalsSavePrivate_(folder,attemptName,attemptRecord);
    var published=annalsPublishCocktailEditorialResult_(index.sourceItemId,token);
    if(!published&&annalsProps_().getProperty('ANNALS_PHOTO_WORKFLOW_ENABLED')==='true')
      annalsNotifyCocktailPhotoOwner_(folder,index.sourceItemId,token,'photo_result_held');
    return published?'photo_publisher_dispatch_accepted':'photo_result_stored_private';
  }catch(ignored){
    // The durable consume marker prevents uncertain Drive writes from replay.
    // Surface uncertain private writes once, without exposing provider details.
    annalsNotifyCocktailPhotoOwner_(folder,index.sourceItemId,token,'photo_result_held');
    return 'photo_result_held';
  }
}
function annalsPhotoAttemptWithLock_(fn){
  var lock=LockService.getScriptLock();
  if(typeof lock.hasLock==='function'&&lock.hasLock())return fn();
  if(!lock.tryLock(1000))return 'photo_attempt_held';
  try{return fn();}finally{lock.releaseLock();}
}
function annalsHandleCocktailPhotoAttemptClaim_(message){
  return annalsPhotoAttemptWithLock_(function(){return annalsHandleCocktailPhotoAttemptClaimLocked_(message);});
}
function annalsHandleCocktailPhotoAttemptClaimLocked_(message){
  var subject='';
  try{subject=String(message.getSubject()||'');}catch(ignored){return null;}
  if(!/^\[ANNALS PHOTO ATTEMPT V1\] /.test(subject))return null;
  var match=/^\[ANNALS PHOTO ATTEMPT V1\] ([a-f0-9]{32}) ([a-f0-9]{32})$/.exec(subject);
  if(!match)return 'photo_attempt_held';
  var token=match[1],attemptId=match[2],props=annalsProps_(),
    worker=String(props.getProperty('ANNALS_PHOTO_WORKER_EMAIL')||'').trim().toLowerCase(),sender='';
  try{sender=AnnalsPilot.senderAddress(message.getFrom()).toLowerCase();}catch(ignored){}
  if(props.getProperty('ANNALS_PHOTO_WORKFLOW_ENABLED')!=='true'||!worker||
     sender!==worker||!annalsPhotoResultIsOwnerSent_(message,worker))return 'photo_attempt_held';
  var request;
  try{
    if(message.getAttachments({includeInlineImages:false,includeAttachments:true}).length!==0)return 'photo_attempt_held';
    var body=String(message.getPlainBody()||'').trim();if(!body||body.length>1024)return 'photo_attempt_held';
    request=JSON.parse(body);
  }catch(ignored){return 'photo_attempt_held';}
  if(!request||Object.keys(request).sort().join(',')!=='attemptId,entryId,jobToken,schema,sourceSha256'||
     request.schema!=='annals-photo-attempt-claim-v1'||request.jobToken!==token||
     request.attemptId!==attemptId||!/^annal-[a-f0-9]{24}$/.test(request.entryId||'')||
     !/^[a-f0-9]{64}$/.test(request.sourceSha256||''))return 'photo_attempt_held';
  var root=annalsRoot_(),indexName='cocktail-photo-job-token-'+token+'-private.json',
    index=annalsRead_(root,indexName),now=new Date();
  if(annalsFile_(root,'cocktail-photo-canary-token-'+token+'-private.json')||
     !index||index.schema!=='annals-photo-job-index-v1'||index.jobToken!==token||
     index.state!=='sent_once'||Date.parse(index.expiresAt)<=now.getTime()||
     index.entryId!==request.entryId||index.sourceSha256!==request.sourceSha256)
    return 'photo_attempt_held';
  var folder=annalsFolder_(index.sourceItemId),jobRecord=annalsRead_(folder,index.jobFilename),
    attemptName='cocktail-photo-attempt-'+token+'-private.json';
  if(!jobRecord||jobRecord.state!=='sent_once'||!jobRecord.job||jobRecord.job.jobToken!==token||
     jobRecord.job.entryId!==request.entryId||jobRecord.job.sourceSha256!==request.sourceSha256||
     jobRecord.sourceItemId!==index.sourceItemId||jobRecord.expiresAt!==index.expiresAt||
     annalsFile_(folder,attemptName)||annalsFile_(folder,'cocktail-photo-consume-'+token+'-private.json')||
     annalsFile_(folder,'cocktail-photo-result-'+token+'-private.json'))return 'photo_attempt_held';
  try{
    var context=annalsCocktailEditorialContext_(index.sourceItemId,jobRecord.job.photoIndex),
      live=annalsRead_(folder,'auto-live-verification-private.json'),
      saved=annalsRead_(folder,'approval-private.json');
    if(context.entryId!==request.entryId||context.sourceSha256!==request.sourceSha256||
       !live||live.state!=='verified_live'||!saved||!saved.receipt||
       live.contentSha256!==saved.receipt.contentSha256)return 'photo_attempt_held';
  }catch(ignored){return 'photo_attempt_held';}
  var record={schema:'annals-photo-attempt-v1',state:'claim_accepted',jobToken:token,
    attemptId:attemptId,entryId:request.entryId,sourceSha256:request.sourceSha256,
    expiresAt:index.expiresAt,claimMessageId:String(message.getId()),claimedAt:now.toISOString()};
  var file=annalsPrivate_(folder.createFile(Utilities.newBlob(
    JSON.stringify(record),'application/json',attemptName)));
  if(!file)return 'photo_attempt_held';
  record.ackState='attempted_once';record.ackAttemptedAt=new Date().toISOString();
  annalsSavePrivate_(folder,attemptName,record);
  try{
    GmailApp.sendEmail(worker,'[ANNALS PHOTO ATTEMPT ACK V1] '+token+' '+attemptId,
      JSON.stringify({schema:'annals-photo-attempt-ack-v1',state:'accepted',jobToken:token,
        attemptId:attemptId,entryId:request.entryId,sourceSha256:request.sourceSha256,
        expiresAt:index.expiresAt}),{name:'Stammtisch Annals'});
    record.ackState='sent_once';record.ackSentAt=new Date().toISOString();
    annalsSavePrivate_(folder,attemptName,record);
    return 'photo_attempt_accepted';
  }catch(ignored){
    record.ackState='unknown_no_retry';record.ackUncertainAt=new Date().toISOString();
    annalsSavePrivate_(folder,attemptName,record);
    return 'photo_attempt_ack_uncertain';
  }
}

function annalsHandleCocktailPhotoAttemptStarted_(message){
  return annalsPhotoAttemptWithLock_(function(){return annalsHandleCocktailPhotoAttemptStartedLocked_(message);});
}
function annalsHandleCocktailPhotoAttemptStartedLocked_(message){
  var subject='';
  try{subject=String(message.getSubject()||'');}catch(ignored){return null;}
  if(!/^\[ANNALS PHOTO STARTED V1\] /.test(subject))return null;
  var match=/^\[ANNALS PHOTO STARTED V1\] ([a-f0-9]{32}) ([a-f0-9]{32})$/.exec(subject);
  if(!match)return 'photo_attempt_held';
  var token=match[1],attemptId=match[2],props=annalsProps_(),
    worker=String(props.getProperty('ANNALS_PHOTO_WORKER_EMAIL')||'').trim().toLowerCase(),sender='';
  try{sender=AnnalsPilot.senderAddress(message.getFrom()).toLowerCase();}catch(ignored){}
  if(props.getProperty('ANNALS_PHOTO_WORKFLOW_ENABLED')!=='true'||!worker||
     sender!==worker||!annalsPhotoResultIsOwnerSent_(message,worker))return 'photo_attempt_held';
  var started;
  try{
    if(message.getAttachments({includeInlineImages:false,includeAttachments:true}).length!==0)return 'photo_attempt_held';
    var body=String(message.getPlainBody()||'').trim();if(!body||body.length>1024)return 'photo_attempt_held';
    started=JSON.parse(body);
  }catch(ignored){return 'photo_attempt_held';}
  if(!started||Object.keys(started).sort().join(',')!=='attemptId,entryId,generatedAt,jobToken,schema,sourceSha256'||
     started.schema!=='annals-photo-attempt-start-v1'||started.jobToken!==token||
     started.attemptId!==attemptId||!/^annal-[a-f0-9]{24}$/.test(started.entryId||'')||
     !/^[a-f0-9]{64}$/.test(started.sourceSha256||'')||!Number.isFinite(Date.parse(started.generatedAt)))
    return 'photo_attempt_held';
  var root=annalsRoot_(),index=annalsRead_(root,'cocktail-photo-job-token-'+token+'-private.json'),
    sentAt=index&&Date.parse(index.sentAt||''),now=Date.now();
  if(!index||index.state!=='sent_once'||index.entryId!==started.entryId||index.sourceSha256!==started.sourceSha256||
     Date.parse(index.expiresAt)<=now||!Number.isFinite(sentAt)||
     Date.parse(started.generatedAt)<sentAt-30000||Date.parse(started.generatedAt)>now+30000)
    return 'photo_attempt_held';
  var folder=annalsFolder_(index.sourceItemId),jobRecord=annalsRead_(folder,index.jobFilename),
    attemptName='cocktail-photo-attempt-'+token+'-private.json',attempt=annalsRead_(folder,attemptName);
  if(!jobRecord||jobRecord.state!=='sent_once'||!jobRecord.job||jobRecord.job.jobToken!==token||
     jobRecord.job.entryId!==started.entryId||jobRecord.job.sourceSha256!==started.sourceSha256||
     jobRecord.expiresAt!==index.expiresAt)return 'photo_attempt_held';
  if(!attempt||attempt.schema!=='annals-photo-attempt-v1'||attempt.state!=='claim_accepted'||
     attempt.jobToken!==token||attempt.attemptId!==attemptId||attempt.entryId!==started.entryId||
     attempt.sourceSha256!==started.sourceSha256)return 'photo_attempt_held';
  try{
    var context=annalsCocktailEditorialContext_(index.sourceItemId,jobRecord.job.photoIndex),
      live=annalsRead_(folder,'auto-live-verification-private.json'),
      saved=annalsRead_(folder,'approval-private.json');
    if(context.entryId!==started.entryId||context.sourceSha256!==started.sourceSha256||
       !live||live.state!=='verified_live'||!saved||!saved.receipt||
       live.contentSha256!==saved.receipt.contentSha256)return 'photo_attempt_held';
  }catch(ignored){return 'photo_attempt_held';}
  attempt.state='generation_started';attempt.generatedAt=started.generatedAt;
  attempt.startMessageId=String(message.getId());attempt.startedRecordedAt=new Date().toISOString();
  annalsSavePrivate_(folder,attemptName,attempt);
  return 'photo_attempt_started';
}

function annalsPhotoResultIsOwnerSent_(message,worker){
  try{
    var owner=String(Session.getEffectiveUser().getEmail()||'').trim().toLowerCase(),
      messageId=String(message.getId()||'');
    if(!owner||owner!==worker||!messageId||typeof Gmail==='undefined'||
       !Gmail.Users||!Gmail.Users.Messages)return false;
    var metadata=Gmail.Users.Messages.get('me',messageId,{format:'metadata'});
    if(!metadata||String(metadata.id||'')!==messageId||!Array.isArray(metadata.labelIds))return false;
    return metadata.labelIds.indexOf('SENT')>=0;
  }catch(ignored){return false;}
}

function annalsEditorialSourceAlreadyQualified_(sourcePath){
  try{
    var url='https://raw.githubusercontent.com/justinpfisher/Stammtisch/main/data/annals-editorial-photos.json?source-check='+Date.now(),
      response=UrlFetchApp.fetch(url,{method:'get',muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
    if(response.getResponseCode()!==200)return null;
    var text=response.getContentText();if(text.length>1000000)return null;
    var manifest=JSON.parse(text);
    if(!manifest||manifest.schemaVersion!==1||!Array.isArray(manifest.images)||manifest.images.length>1000)return null;
    return manifest.images.some(function(row){return row&&row.source===sourcePath;});
  }catch(ignored){return null;}
}
/** Publish only a private, one-use, freshly requalified result through the
 * existing HMAC-protected repository-dispatch publisher. */
function annalsPublishCocktailEditorialResult_(itemId,token){
  var folder=annalsFolder_(itemId),resultName='cocktail-photo-result-'+token+'-private.json',
    root=annalsRoot_(),indexName='cocktail-photo-job-token-'+token+'-private.json',
    index=annalsRead_(root,indexName),result=annalsRead_(folder,resultName),
    consume=annalsRead_(folder,'cocktail-photo-consume-'+token+'-private.json'),
    props=annalsProps_(),now=new Date();
  if(props.getProperty('ANNALS_PHOTO_WORKFLOW_ENABLED')!=='true'||
     !index||index.jobToken!==token||index.state!=='result_received_private'||
     !result||result.state!=='qualified_held_for_publisher'||
     !consume||consume.state!=='result_received_private'||
     props.getProperty('ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED')!=='true'||
     props.getProperty('ANNALS_GITHUB_REPOSITORY')!=='justinpfisher/Stammtisch'||
     !props.getProperty('ANNALS_GITHUB_TOKEN')||
     !annalsPublisherDispatchReady_()||annalsFile_(folder,'quarantine-private.json')||
     annalsFile_(folder,'removal-private.json')||
     annalsFile_(folder,'editorial-photo-dispatch-'+token+'-private.json'))return false;
  var record=annalsRead_(folder,index.jobFilename),job=record&&record.job;
  if(!record||record.state!=='result_received_private'||!job||job.jobToken!==token||
     record.expiresAt!==index.expiresAt||Date.parse(record.expiresAt)<=now.getTime()||
     job.entryId!==result.entryId||job.sourceSha256!==result.sourceSha256||
     job.sourceSha256!==index.sourceSha256||job.entryId!==index.entryId||
     !/^[a-f0-9]{64}$/.test(result.imageSha256||''))return false;
  var context;
  try{context=annalsCocktailEditorialContext_(itemId,job.photoIndex);}catch(ignored){return false;}
  var saved=annalsRead_(folder,'approval-private.json'),
    live=annalsRead_(folder,'auto-live-verification-private.json'),
    source=annalsRead_(folder,'source-private.json');
  if(!saved||!saved.entry||!saved.receipt||!annalsPrivateReceiptValid_(saved.entry,saved.receipt)||
     AnnalsProduction.serial(saved.entry)!==AnnalsProduction.serial(context.entry)||
     !live||live.state!=='verified_live'||live.contentSha256!==saved.receipt.contentSha256||
     context.entryId!==job.entryId||context.sourceSha256!==job.sourceSha256||
     !saved.receipt.consents||saved.receipt.consents.photoPublication!==true||
     !source||annalsFile_(folder,'removal-private.json')||annalsFile_(folder,'quarantine-private.json'))return false;
  var imageName='cocktail-photo-result-'+token+'-private.jpg',imageFile=annalsFile_(folder,imageName);
  if(!imageFile)return false;
  var bytes;
  try{
    bytes=imageFile.getBlob().getBytes();
    if(bytes.length<4000||bytes.length>5*1024*1024||annalsHash_(bytes)!==result.imageSha256)return false;
    var clean=AnnalsMedia.sanitizeEditorial(bytes,AnnalsJpegCodec);
    if(annalsHash_(clean.bytes)!==result.imageSha256||clean.width!==result.width||clean.height!==result.height)return false;
  }catch(ignored){return false;}
  var photos=saved.entry.photos||(saved.entry.photo?[saved.entry.photo]:[]),
    sentAt=Date.parse(record.sentAt),generatedAt=Date.parse(result.generatedAt),reviewedAt=Date.parse(result.reviewedAt),
    photo=Array.isArray(photos)&&job.photoIndex<photos.length?photos[job.photoIndex]:null;
  if(!Number.isFinite(sentAt)||!Number.isFinite(generatedAt)||!Number.isFinite(reviewedAt)||
     generatedAt<sentAt-30000||reviewedAt<generatedAt||reviewedAt>now.getTime()+30000)return false;
  if(!photo||photo.sha256!==job.sourceSha256||result.imageSha256===photo.sha256)return false;
  var sourcePath='assets/annals/'+photo.sha256+'.jpg',
    assetPath=sourcePath.slice(0,-4)+'-editorial-v2.jpg',
    exists=annalsEditorialSourceAlreadyQualified_(sourcePath);
  if(exists!==false)return false;
  var row={source:sourcePath,sourceSha256:photo.sha256,asset:assetPath,
    editorialSha256:result.imageSha256,width:result.width,height:result.height,alt:result.alt,
    artDirection:'moody-atmospheric-v2',status:'qualified',
    rightsQualified:true,safetyQualified:true,visualQualified:true,
    generationProvider:result.generationProvider,generationModel:result.generationModel,
    generationOperation:'image-edit',reviewMethod:'ai-visual-assessment',
    generatedAt:result.generatedAt,reviewedAt:result.reviewedAt};
  var uploadName='cocktail-photo-editorial-blob-'+token+'-private.json';
  if(annalsFile_(folder,uploadName))return false;
  var upload={state:'attempt_reserved',at:now.toISOString(),sourceSha256:job.sourceSha256,
    editorialSha256:result.imageSha256};
  annalsWriteOnce_(folder,uploadName,upload);
  var gitHeader=Utilities.newBlob('blob '+bytes.length+'\u0000').getBytes(),
    gitSha=annalsHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1,gitHeader.concat(Array.from(bytes))));
  var response;
  try{
    response=UrlFetchApp.fetch('https://api.github.com/repos/justinpfisher/Stammtisch/git/blobs',{
      method:'post',contentType:'application/json',
      headers:{Authorization:'Bearer '+props.getProperty('ANNALS_GITHUB_TOKEN'),
        Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
      payload:JSON.stringify({content:Utilities.base64Encode(bytes),encoding:'base64'}),
      muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
    if(response.getResponseCode()!==201||response.getContentText().length>4096||
       JSON.parse(response.getContentText()).sha!==gitSha){
      upload.state='rejected_no_retry';upload.completedAt=new Date().toISOString();
      annalsFile_(folder,uploadName).setContent(JSON.stringify(upload));return false;
    }
  }catch(ignored){
    upload.state='unknown_no_retry';upload.completedAt=new Date().toISOString();
    annalsFile_(folder,uploadName).setContent(JSON.stringify(upload));return false;
  }
  upload.state='uploaded';upload.gitSha=gitSha;upload.size=bytes.length;
  upload.completedAt=new Date().toISOString();annalsFile_(folder,uploadName).setContent(JSON.stringify(upload));
  // Network upload is not the rights check. Re-read current consent/source and
  // the live marker immediately before signing and dispatching the event.
  try{
    var finalContext=annalsCocktailEditorialContext_(itemId,job.photoIndex),
      finalSaved=annalsRead_(folder,'approval-private.json'),
      finalLive=annalsRead_(folder,'auto-live-verification-private.json');
    if(!annalsPhotosReady_(itemId)||finalContext.entryId!==job.entryId||
       finalContext.sourceSha256!==job.sourceSha256||!finalSaved||!finalSaved.receipt||
       finalSaved.receipt.contentSha256!==saved.receipt.contentSha256||
       !finalLive||finalLive.state!=='verified_live'||
       finalLive.contentSha256!==finalSaved.receipt.contentSha256||
       annalsEditorialSourceAlreadyQualified_(sourcePath)!==false)return false;
  }catch(ignored){return false;}
  var issuedAt=new Date().toISOString(),blob={gitSha:gitSha,size:bytes.length},
    unsigned={operation:'editorial-photo-v1',photo:row,blob:blob,issuedAt:issuedAt},
    key=props.getProperty('ANNALS_PUBLISH_SIGNING_KEY')||'';
  if(key.length<32||key===props.getProperty('ANNALS_APPROVAL_KEY'))return false;
  var signature=annalsHex_(Utilities.computeHmacSha256Signature(
    AnnalsProduction.serial(unsigned),key,Utilities.Charset.UTF_8));
  result.editorialRow=row;result.eventIssuedAt=issuedAt;
  result.state='publisher_attempt_reserved';annalsSavePrivate_(folder,resultName,result);
  var payload={photo:row,blob:blob,issuedAt:issuedAt,signature:signature},
    accepted=annalsDispatchEvent_(folder,'annals-editorial-photo-v1',payload,
      'editorial-photo-dispatch-'+token+'-private.json');
  var dispatch=annalsRead_(folder,'editorial-photo-dispatch-'+token+'-private.json');
  result.state=accepted?'publisher_dispatch_accepted_unverified':
    dispatch?'publisher_dispatch_unknown_no_retry':'qualified_held_for_publisher';
  result.dispatchAt=dispatch&&dispatch.completedAt||new Date().toISOString();
  annalsSavePrivate_(folder,resultName,result);
  if(accepted){
    record.state='editorial_dispatch_accepted_unverified';record.editorialDispatchAt=result.dispatchAt;
    index.state='editorial_dispatch_accepted_unverified';index.editorialDispatchAt=result.dispatchAt;
    annalsSavePrivate_(folder,index.jobFilename,record);annalsSavePrivate_(root,indexName,index);
  }
  return accepted;
}
function annalsVerifyCocktailEditorialResult_(folder,itemId,token){
  var resultName='cocktail-photo-result-'+token+'-private.json',
    result=annalsRead_(folder,resultName),dispatch=annalsRead_(folder,'editorial-photo-dispatch-'+token+'-private.json'),
    markerName='cocktail-photo-live-'+token+'-private.json';
  if(!result||result.state!=='publisher_dispatch_accepted_unverified'||
     !dispatch||dispatch.state!=='accepted'||annalsFile_(folder,markerName)||
     !result.editorialRow||!result.imageSha256)return false;
  var root=annalsRoot_(),indexName='cocktail-photo-job-token-'+token+'-private.json',
    index=annalsRead_(root,indexName),record=index&&annalsRead_(folder,index.jobFilename),
    job=record&&record.job,now=new Date();
  if(!index||index.state!=='editorial_dispatch_accepted_unverified'||!record||
     record.state!=='editorial_dispatch_accepted_unverified'||!job||
     job.entryId!==result.entryId||job.sourceSha256!==result.sourceSha256)return false;
  var context,saved,live;
  try{
    context=annalsCocktailEditorialContext_(itemId,job.photoIndex);
    saved=annalsRead_(folder,'approval-private.json');
    live=annalsRead_(folder,'auto-live-verification-private.json');
  }catch(ignored){return false;}
  if(context.entryId!==job.entryId||context.sourceSha256!==job.sourceSha256||
     !saved||!saved.receipt||!live||live.state!=='verified_live'||
     live.contentSha256!==saved.receipt.contentSha256||
     !saved.receipt.consents||saved.receipt.consents.photoPublication!==true)return false;
  var query='?editorial-verified='+encodeURIComponent(token),
    response;
  try{
    response=UrlFetchApp.fetch('https://stammtischbrewery.com/data/annals-editorial-photos.json'+query,
      {method:'get',muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
    if(response.getResponseCode()!==200)return false;
    var body=response.getContentText();if(body.length>1000000)return false;
    var manifest=JSON.parse(body);
    if(!manifest||manifest.schemaVersion!==1||!Array.isArray(manifest.images)||
       AnnalsProduction.serial(manifest.images.filter(function(row){return row.source===result.editorialRow.source;})[0]||{})!==
       AnnalsProduction.serial(result.editorialRow))return false;
    var photoUrl='https://stammtischbrewery.com/'+result.editorialRow.asset+query;
    response=UrlFetchApp.fetch(photoUrl,{method:'get',muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
    if(response.getResponseCode()!==200)return false;
    var bytes=response.getBlob().getBytes();
    if(bytes.length>5*1024*1024||annalsHash_(bytes)!==result.imageSha256||
       annalsHash_(bytes)!==result.editorialRow.editorialSha256)return false;
    var clean=AnnalsMedia.sanitizeEditorial(bytes,AnnalsJpegCodec);
    if(clean.width!==result.width||clean.height!==result.height||
       clean.width!==result.editorialRow.width||clean.height!==result.editorialRow.height||
       annalsHash_(clean.bytes)!==result.imageSha256)return false;
    var sourceResponse=UrlFetchApp.fetch('https://stammtischbrewery.com/'+result.editorialRow.source+query,
      {method:'get',muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
    if(sourceResponse.getResponseCode()!==200)return false;
    var original=sourceResponse.getBlob().getBytes();
    if(annalsHash_(original)!==job.sourceSha256)return false;
    annalsWriteOnce_(folder,markerName,{schema:'annals-photo-live-v1',jobToken:token,
      state:'verified_live',sourceSha256:job.sourceSha256,
      editorialSha256:result.imageSha256,verifiedAt:now.toISOString()});
    result.state='editorial_live_verified';result.verifiedAt=now.toISOString();
    annalsSavePrivate_(folder,resultName,result);
    record.state='editorial_live_verified';record.verifiedAt=now.toISOString();
    index.state='editorial_live_verified';index.verifiedAt=now.toISOString();
    annalsSavePrivate_(folder,index.jobFilename,record);annalsSavePrivate_(root,indexName,index);
    return true;
  }catch(ignored){return false;}
}
function annalsVerifyCocktailEditorialResults_(limit){
  var root=annalsRoot_(),props=annalsProps_(),key='ANNALS_EDITORIAL_VERIFY_CURSOR',
    cursor=null,folders,activeFolder=null,activeItemId='',files=null;
  try{
    cursor=JSON.parse(props.getProperty(key)||'null');
    if(cursor&&(!cursor.folderToken||typeof cursor.folderToken!=='string'||
       cursor.folderToken.length>10000||
       (cursor.fileToken!==null&&cursor.fileToken!==undefined&&
        (typeof cursor.fileToken!=='string'||cursor.fileToken.length>10000))||
       (cursor.itemId&&!/^[a-f0-9]{64}$/.test(cursor.itemId))||
       (cursor.folderId&&typeof cursor.folderId!=='string')))
      cursor=null;
  }catch(ignored){cursor=null;}
  try{
    folders=cursor&&cursor.folderToken?DriveApp.continueFolderIterator(cursor.folderToken):root.getFolders();
    if(cursor&&cursor.fileToken){
      activeFolder=annalsPrivate_(DriveApp.getFolderById(cursor.folderId));
      activeItemId=activeFolder.getName();
      if(activeItemId!==cursor.itemId||!/^[a-f0-9]{64}$/.test(activeItemId))throw Error('Stale editorial cursor');
      files=DriveApp.continueFileIterator(cursor.fileToken);
    }
  }catch(ignored){
    cursor=null;activeFolder=null;activeItemId='';files=null;folders=root.getFolders();
  }
  var checked=0,scanned=0,verified=0,target=Math.max(1,limit||1);
  while(verified<target&&checked<12&&scanned<40){
    if(!files){
      if(!folders.hasNext())break;
      activeFolder=annalsPrivate_(folders.next());activeItemId=activeFolder.getName();
      checked++;
      if(!/^[a-f0-9]{64}$/.test(activeItemId)){activeFolder=null;continue;}
      files=activeFolder.getFiles();
    }
    while(files.hasNext()&&scanned<40&&verified<target){
      var file=files.next(),match=/^cocktail-photo-result-([a-f0-9]{32})-private\.json$/.exec(file.getName());
      scanned++;
      if(match){
        var pending=annalsRead_(activeFolder,'cocktail-photo-result-'+match[1]+'-private.json');
        if(pending&&pending.state==='publisher_dispatch_accepted_unverified'&&
           Number.isFinite(Date.parse(pending.dispatchAt||''))&&
           Date.now()-Date.parse(pending.dispatchAt)>24*60*60*1000&&
           !annalsFile_(activeFolder,'cocktail-photo-live-'+match[1]+'-private.json'))
          annalsNotifyCocktailPhotoOwner_(activeFolder,activeItemId,match[1],'publisher_dispatch_unverified');
        if(annalsVerifyCocktailEditorialResult_(activeFolder,activeItemId,match[1]))verified++;
      }
    }
    if(files.hasNext()){
      props.setProperty(key,JSON.stringify({folderToken:folders.getContinuationToken(),
        fileToken:files.getContinuationToken(),folderId:activeFolder.getId(),itemId:activeItemId}));
      return verified;
    }
    files=null;activeFolder=null;activeItemId='';
  }
  if(files&&files.hasNext()&&activeFolder){
    props.setProperty(key,JSON.stringify({folderToken:folders.getContinuationToken(),
      fileToken:files.getContinuationToken(),folderId:activeFolder.getId(),itemId:activeItemId}));
  }else if(folders.hasNext()){
    props.setProperty(key,JSON.stringify({folderToken:folders.getContinuationToken(),
      fileToken:null,folderId:null,itemId:null}));
  }else props.deleteProperty(key);
  return verified;
}

function annalsNotifyCocktailPhotoOwner_(folder,itemId,token,kind){
  if(!/^[a-f0-9]{64}$/.test(itemId||'')||!/^[a-f0-9]{32}$/.test(token||'')||
     !['photo_result_held','publisher_dispatch_unverified'].includes(kind))return false;
  var marker='cocktail-photo-owner-notice-'+token+'-private.json';
  if(annalsFile_(folder,marker))return false;
  var props=annalsProps_(),owner=String(props.getProperty('ANNALS_OWNER_EMAIL')||'').trim(),
    review=String(props.getProperty('ANNALS_REVIEW_URL')||'');
  if(!owner||!/^https:\/\/script\.google\.com\/macros\/s\//.test(review))return false;
  annalsWriteOnce_(folder,marker,{schema:'annals-photo-owner-notice-v1',
    jobToken:token,state:'attempted_once',kind:kind,at:new Date().toISOString()});
  try{
    GmailApp.sendEmail(owner,'Stammtisch Annals — cocktail photo needs review',
      'A private cocktail photo job is held or its publication could not be confirmed. No automatic retry was made. Review the owner-only item: '+
      review+'?item='+encodeURIComponent(itemId));
  }catch(ignored){}
  return true;
}
function annalsPhotoResultTerminalHold_(root,indexName,index,folder,jobRecord,
    consumeName,resultName,token,reason,now){
  if(annalsFile_(folder,consumeName))return 'photo_result_held';
  annalsWriteOnce_(folder,consumeName,{schema:'annals-photo-consume-v1',
    jobToken:token,state:'result_attempt_reserved',at:now.toISOString()});
  annalsWriteOnce_(folder,resultName,{schema:'annals-photo-stored-result-v1',
    jobToken:token,entryId:jobRecord.job.entryId,
    sourceSha256:jobRecord.job.sourceSha256,state:'held',reasonCode:reason,
    receivedAt:now.toISOString()});
  jobRecord.state='held';jobRecord.consumedAt=now.toISOString();
  index.state='held';index.consumedAt=now.toISOString();
  annalsSavePrivate_(folder,index.jobFilename,jobRecord);
  annalsSavePrivate_(root,indexName,index);
  annalsSavePrivate_(folder,consumeName,{schema:'annals-photo-consume-v1',
    jobToken:token,state:'held',at:now.toISOString()});
  annalsNotifyCocktailPhotoOwner_(folder,index.sourceItemId,token,'photo_result_held');
  return 'photo_result_held';
}

/* One owner-started fictional email canary. It uses a synthetic JPEG and an
 * isolated private folder; result handling stores privately and never calls
 * the editorial publisher. Prepare and send are separate so the parent can
 * install the exact-subject wake-up before the single email is sent. */
function annalsPreparePrivatePhotoCanaryInEditor(workerEmail){
  annalsOwner_();
  return annalsLocked_(function(){
  var configuredWorker=String(annalsProps_().getProperty('ANNALS_PHOTO_WORKER_EMAIL')||'').trim().toLowerCase();
  workerEmail=String(workerEmail||'').trim().toLowerCase();
  if(!configuredWorker||workerEmail!==configuredWorker||!/^\S+@\S+\.\S+$/.test(workerEmail))
    throw Error('Approved worker must match existing private configuration');
  annalsServiceOwner_();
  if(typeof AnnalsJpegCodec==='undefined'||typeof AnnalsCocktailEditorial==='undefined')
    throw Error('Photo canary modules unavailable');
  var itemId=annalsHash_(Utilities.getUuid()),folder=annalsFolder_(itemId,true),
    width=640,height=640,pixels=new Uint8Array(width*height*4);
  function pixel(x,y,c){if(x<0||y<0||x>=width||y>=height)return;var p=(y*width+x)*4;
    pixels[p]=c[0];pixels[p+1]=c[1];pixels[p+2]=c[2];pixels[p+3]=255;}
  function polygon(points,c){var minX=width,minY=height,maxX=0,maxY=0;
    points.forEach(function(q){minX=Math.min(minX,q[0]);maxX=Math.max(maxX,q[0]);minY=Math.min(minY,q[1]);maxY=Math.max(maxY,q[1]);});
    for(var y=minY;y<=maxY;y++)for(var x=minX;x<=maxX;x++){var inside=false;
      for(var i=0,j=points.length-1;i<points.length;j=i++){
        var a=points[i],b=points[j];if(((a[1]>y)!==(b[1]>y))&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
      }if(inside)pixel(x,y,c);
    }
  }
  function line(x0,y0,x1,y1,c,thickness){var dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy;
    while(true){for(var oy=-thickness;oy<=thickness;oy++)for(var ox=-thickness;ox<=thickness;ox++)
      if(ox*ox+oy*oy<=thickness*thickness)pixel(x0+ox,y0+oy,c);
      if(x0===x1&&y0===y1)break;var e2=2*err;if(e2>=dy){err+=dy;x0+=sx;}if(e2<=dx){err+=dx;y0+=sy;}
    }
  }
  function circle(cx,cy,r,c){for(var y=-r;y<=r;y++)for(var x=-r;x<=r;x++)if(x*x+y*y<=r*r)pixel(cx+x,cy+y,c);}
  for(var y=0;y<height;y++)for(var x=0;x<width;x++)pixel(x,y,[224-Math.floor(y/12),238-Math.floor(y/18),230-Math.floor(y/20)]);
  /* Draw a clearly fictional coupe cocktail, stem, foot, citrus garnish and straw. */
  polygon([[190,190],[450,190],[420,330],[370,390],[270,390],[220,330]],[205,225,221]);
  polygon([[211,250],[429,250],[414,319],[365,374],[275,374],[226,319]],[206,132,48]);
  line(190,190,450,190,[83,105,101],5);line(190,190,220,330,[83,105,101],5);
  line(450,190,420,330,[83,105,101],5);line(220,330,270,390,[83,105,101],5);
  line(420,330,370,390,[83,105,101],5);line(270,390,370,390,[83,105,101],5);
  line(320,392,320,520,[83,105,101],6);
  polygon([[235,535],[405,535],[385,555],[255,555]],[83,105,101]);
  polygon([[250,535],[390,535],[378,545],[262,545]],[205,225,221]);
  line(350,145,390,264,[157,66,49],6);line(353,148,389,255,[242,183,122],2);
  circle(445,190,30,[231,153,58]);circle(445,190,22,[245,205,111]);circle(445,190,15,[119,153,91]);
  circle(445,190,5,[245,205,111]);
  var bytes=AnnalsJpegCodec.encode({data:pixels,width:width,height:height},82).data;
  pixels=null;
  if(bytes.length<4000||bytes.length>5*1024*1024||!annalsJpegDerivativeSafe_(bytes))
    throw Error('Synthetic source JPEG failed bounded validation');
  var sourceSha256=annalsHash_(bytes),token=Utilities.getUuid().replace(/-/g,'').toLowerCase(),
    entryId='annal-'+itemId.slice(0,24),now=new Date(),expiresAt=new Date(now.getTime()+7*24*60*60*1000).toISOString();
  var job=AnnalsCocktailEditorial.photoJob({entryId:entryId,sourceSha256:sourceSha256,
    photoIndex:0,jobToken:token,name:'Synthetic qualification drink',
    description:'Fictional image-routing check; not a real drink or person.',
    ingredients:['imaginary citrus','fictional sparkling water'],keywords:'synthetic canary'});
  var fileName='cocktail-photo-canary-job-'+token+'-private.json',
    indexName='cocktail-photo-canary-token-'+token+'-private.json',
    index={schema:'annals-photo-canary-index-v1',jobToken:token,sourceItemId:itemId,
      jobFilename:fileName,entryId:entryId,sourceSha256:sourceSha256,
      createdAt:now.toISOString(),expiresAt:expiresAt,state:'prepared'};
  annalsPrivate_(folder.createFile(Utilities.newBlob(bytes,'image/jpeg','synthetic-source.jpg')));
  annalsWriteOnce_(folder,fileName,{schema:'annals-photo-canary-job-v1',job:job,
    sourceItemId:itemId,sourceFilename:'synthetic-source.jpg',sourceSha256:sourceSha256,
    createdAt:now.toISOString(),expiresAt:expiresAt,state:'prepared'});
  annalsWriteOnce_(annalsRoot_(),indexName,index);
  return {state:'prepared_no_mail',subject:'[ANNALS PHOTO JOB v1] '+token,
    token:token,workerMatchesConfiguration:true,
    expiresAt:expiresAt,sourceIsSynthetic:true,mailSent:false,published:false};
  });
}

/* One explicit invocation only, after the parent confirms its exact-subject
 * event is ready. The durable reservation precedes GmailApp; uncertainty is
 * terminal and never retried. */
function annalsSendPrivatePhotoCanaryInEditor(token,workerEmail){
  annalsOwner_();
  return annalsLocked_(function(){
  annalsServiceOwner_();
  workerEmail=String(workerEmail||'').trim().toLowerCase();
  if(!/^[a-f0-9]{32}$/.test(String(token||''))||
     workerEmail!==String(annalsProps_().getProperty('ANNALS_PHOTO_WORKER_EMAIL')||'').trim().toLowerCase()||
     !/^\S+@\S+\.\S+$/.test(workerEmail))throw Error('Authorized canary binding required');
  var root=annalsRoot_(),indexName='cocktail-photo-canary-token-'+token+'-private.json',
    index=annalsRead_(root,indexName),now=new Date();
  if(!index||index.schema!=='annals-photo-canary-index-v1'||index.state!=='prepared'||
     index.jobToken!==token||Date.parse(index.expiresAt)<=now.getTime())
    throw Error('Unexpired, unused synthetic canary required');
  var folder=annalsFolder_(index.sourceItemId),record=annalsRead_(folder,index.jobFilename);
  if(!record||record.schema!=='annals-photo-canary-job-v1'||record.state!=='prepared'||
     record.job.jobToken!==token||record.job.sourceSha256!==index.sourceSha256)
    throw Error('Synthetic canary record mismatch');
  var source=annalsFile_(folder,record.sourceFilename),bytes=source&&source.getBlob().getBytes();
  if(!bytes||annalsHash_(bytes)!==record.sourceSha256||!annalsJpegDerivativeSafe_(bytes))
    throw Error('Synthetic source changed');
  index.state='send_attempt_reserved';index.sendAttemptAt=now.toISOString();
  record.state='send_attempt_reserved';record.sendAttemptAt=now.toISOString();
  annalsSavePrivate_(root,indexName,index);annalsSavePrivate_(folder,index.jobFilename,record);
  try{
    GmailApp.sendEmail(workerEmail,'[ANNALS PHOTO JOB v1] '+token,
      annalsPhotoJobMessageBody_(record.job),{attachments:[Utilities.newBlob(bytes,'image/jpeg','synthetic-source.jpg')],
        name:'Stammtisch Annals'});
    index.state='sent_once';record.state='sent_once';
    index.sentAt=new Date().toISOString();record.sentAt=index.sentAt;
    annalsSavePrivate_(root,indexName,index);annalsSavePrivate_(folder,index.jobFilename,record);
    return {state:'sent_once',subject:'[ANNALS PHOTO JOB v1] '+token,published:false};
  }catch(ignored){
    index.state='unknown_no_retry';record.state='unknown_no_retry';
    index.failedAt=new Date().toISOString();record.failedAt=index.failedAt;
    annalsSavePrivate_(root,indexName,index);annalsSavePrivate_(folder,index.jobFilename,record);
    return {state:'unknown_no_retry',published:false};
  }
  });
}

function annalsHandleCocktailPhotoCanaryResult_(message,sender,token,result,index,root,now){
  var indexName='cocktail-photo-canary-token-'+token+'-private.json';
  if(index.schema!=='annals-photo-canary-index-v1'||index.jobToken!==token||
     index.state!=='sent_once'||Date.parse(index.expiresAt)<=now.getTime())return 'photo_result_held';
  var folder=annalsFolder_(index.sourceItemId),record=annalsRead_(folder,index.jobFilename),
    consumeName='cocktail-photo-canary-consume-'+token+'-private.json',
    resultName='cocktail-photo-canary-result-'+token+'-private.json',
    imageName='cocktail-photo-canary-result-'+token+'-private.jpg';
  if(!record||record.schema!=='annals-photo-canary-job-v1'||record.state!=='sent_once'||
     record.job.jobToken!==token||record.job.entryId!==index.entryId||
     record.job.sourceSha256!==index.sourceSha256||record.expiresAt!==index.expiresAt||
     annalsFile_(folder,consumeName)||annalsFile_(folder,resultName)||annalsFile_(folder,imageName))
    return 'photo_result_held';
  var sourceFile=annalsFile_(folder,record.sourceFilename),sourceBytes;
  try{sourceBytes=sourceFile&&sourceFile.getBlob().getBytes();}catch(ignored){sourceBytes=null;}
  if(!sourceBytes||annalsHash_(sourceBytes)!==record.sourceSha256||
     record.sourceSha256!==record.job.sourceSha256)return 'photo_result_held';
  var outcome;
  try{outcome=AnnalsCocktailEditorial.validatePhotoResult(result,record.job,true,now);}
  catch(ignored){return 'photo_result_held';}
  if(outcome.qualified){
    var sentAt=Date.parse(record.sentAt),generatedAt=Date.parse(result.generatedAt),reviewedAt=Date.parse(result.reviewedAt);
    if(!Number.isFinite(sentAt)||generatedAt<sentAt-30000||reviewedAt<generatedAt||reviewedAt>now.getTime()+30000)
      return 'photo_result_held';
  }
  var attachments;
  try{attachments=message.getAttachments({includeInlineImages:false,includeAttachments:true});}
  catch(ignored){return 'photo_result_held';}
  var heldReason=outcome.qualified?'':(outcome.reason||'visual_qa_failed'),bytes=null,width=0,height=0,imageSha='';
  if(outcome.qualified&&Array.isArray(attachments)&&attachments.length===1){
    try{
      var blob=attachments[0];bytes=blob.getBytes();
      if(String(blob.getContentType()).toLowerCase()!=='image/jpeg'||bytes.length<4000||
         bytes.length>5*1024*1024||!annalsJpegDerivativeSafe_(bytes))bytes=null;
      var clean=bytes&&AnnalsMedia.sanitizeEditorial(bytes,AnnalsJpegCodec);
      if(!clean||!clean.bytes||annalsHash_(clean.bytes)!==annalsHash_(bytes)||
         clean.width<480||clean.height<480||clean.width>2560||clean.height>2560||
         annalsHash_(bytes)===record.job.sourceSha256)bytes=null;
      else{width=clean.width;height=clean.height;imageSha=annalsHash_(bytes);}
    }catch(ignored){bytes=null;}
    if(!bytes)heldReason='visual_qa_failed';
  }else if(outcome.qualified)heldReason='attachment_unavailable';
  if(!outcome.qualified&&(!Array.isArray(attachments)||attachments.length!==0))return 'photo_result_held';
  /* Consume before any file write. Even an uncertain Drive write cannot replay. */
  annalsWriteOnce_(folder,consumeName,{schema:'annals-photo-canary-consume-v1',jobToken:token,
    state:'result_attempt_reserved',at:now.toISOString()});
  var qualified=outcome.qualified&&!!bytes;
  if(qualified){
    annalsPrivate_(folder.createFile(Utilities.newBlob(bytes,'image/jpeg',imageName)));
    annalsWriteOnce_(folder,resultName,{schema:'annals-photo-canary-result-v1',jobToken:token,
      entryId:record.job.entryId,sourceSha256:record.job.sourceSha256,state:'qualified_private_only',
      imageFilename:imageName,imageSha256:imageSha,width:width,height:height,alt:outcome.alt,
      receivedAt:now.toISOString(),generatedAt:outcome.generatedAt,reviewedAt:outcome.reviewedAt});
  }else{
    annalsWriteOnce_(folder,resultName,{schema:'annals-photo-canary-result-v1',jobToken:token,
      entryId:record.job.entryId,sourceSha256:record.job.sourceSha256,state:'held_private_only',
      reasonCode:heldReason||outcome.reason||'visual_qa_failed',receivedAt:now.toISOString()});
  }
  record.state=qualified?'result_received_private_canary':'held_private_canary';
  record.consumedAt=now.toISOString();index.state=record.state;index.consumedAt=now.toISOString();
  annalsSavePrivate_(folder,index.jobFilename,record);annalsSavePrivate_(root,indexName,index);
  annalsSavePrivate_(folder,consumeName,{schema:'annals-photo-canary-consume-v1',jobToken:token,
    state:record.state,at:now.toISOString()});
  return qualified?'photo_canary_private_only':'photo_result_held';
}
