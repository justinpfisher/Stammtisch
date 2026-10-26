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
    GmailApp.sendEmail(recipient,'[ANNALS PHOTO JOB v1] '+token,JSON.stringify(job),{
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
    return {state:record.state};
  }
}

/** Consume one authenticated worker result into private storage only.
 * This handler never dispatches publication; a later, distinct publisher gate
 * must consume only the fully verified private result record. */
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
  if(!worker||sender!==worker||!annalsAuthentication_(message,sender))
    return 'photo_result_held';
  var result;
  try{
    var body=String(message.getPlainBody()||'').trim();
    if(!body||body.length>2048)return 'photo_result_held';
    result=JSON.parse(body);
  }catch(ignored){return 'photo_result_held';}
  var root=annalsRoot_(),indexName='cocktail-photo-job-token-'+token+'-private.json',
    index=annalsRead_(root,indexName),now=new Date();
  if(!index||index.schema!=='annals-photo-job-index-v1'||index.jobToken!==token||
     index.state!=='sent_once'||Date.parse(index.expiresAt)<=now.getTime())
    return 'photo_result_held';
  var folder=annalsFolder_(index.sourceItemId),jobRecord=annalsRead_(folder,index.jobFilename),
    job=jobRecord&&jobRecord.job,consumeName='cocktail-photo-consume-'+token+'-private.json',
    resultName='cocktail-photo-result-'+token+'-private.json',
    imageName='cocktail-photo-result-'+token+'-private.jpg';
  if(!jobRecord||jobRecord.state!=='sent_once'||!job||job.jobToken!==token||
     jobRecord.sourceItemId!==index.sourceItemId||jobRecord.expiresAt!==index.expiresAt||
     annalsFile_(folder,consumeName)||annalsFile_(folder,resultName)||annalsFile_(folder,imageName))
    return 'photo_result_held';
  var outcome;
  try{outcome=AnnalsCocktailEditorial.validatePhotoResult(result,job,true,now);}
  catch(ignored){return 'photo_result_held';}
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
      var clean=AnnalsMedia.sanitize(bytes,true);
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
      state:'worker_held',reasonCode:outcome.reason,receivedAt:now.toISOString()});
    jobRecord.state='worker_held';jobRecord.consumedAt=now.toISOString();
    index.state='worker_held';index.consumedAt=now.toISOString();
    annalsSavePrivate_(folder,index.jobFilename,jobRecord);
    annalsSavePrivate_(root,indexName,index);
    annalsSavePrivate_(folder,consumeName,{schema:'annals-photo-consume-v1',
      jobToken:token,state:'worker_held',at:now.toISOString()});
    return 'photo_result_held';
  }
  try{
    var outBlob=Utilities.newBlob(bytes,'image/jpeg',imageName),
      file=annalsPrivate_(folder.createFile(outBlob));
    if(file.getName()!==imageName)file.setName(imageName);
    annalsWriteOnce_(folder,resultName,{schema:'annals-photo-stored-result-v1',
      jobToken:token,entryId:job.entryId,sourceSha256:job.sourceSha256,
      photoIndex:job.photoIndex,state:'qualified_held_for_publisher',
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
    return annalsPublishCocktailEditorialResult_(index.sourceItemId,token)
      ?'photo_publisher_dispatch_accepted':'photo_result_stored_private';
  }catch(ignored){
    // The durable consume marker prevents uncertain Drive writes from replay.
    return 'photo_result_held';
  }
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
    jobFilename='cocktail-photo-job-'+(annalsRead_(folder,'cocktail-photo-job-'+token+'-private.json')||{}).sourceSha256+'-cocktail-cinematic-photoreal-v1-private.json',
    root=annalsRoot_(),indexName='cocktail-photo-job-token-'+token+'-private.json',
    index=annalsRead_(root,indexName),result=annalsRead_(folder,resultName),
    consume=annalsRead_(folder,'cocktail-photo-consume-'+token+'-private.json'),
    props=annalsProps_(),now=new Date();
  if(!index||index.jobToken!==token||index.state!=='result_received_private'||
     !result||result.state!=='qualified_held_for_publisher'||
     !consume||consume.state!=='result_received_private'||
     props.getProperty('ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED')!=='true'||
     props.getProperty('ANNALS_GITHUB_REPOSITORY')!=='justinpfisher/Stammtisch'||
     !props.getProperty('ANNALS_GITHUB_TOKEN')||
     !annalsPublisherDispatchReady_()||annalsFile_(folder,'quarantine-private.json')||
     annalsFile_(folder,'removal-private.json')||
     annalsFile_(folder,'editorial-photo-dispatch-private.json'))return false;
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
    var clean=AnnalsMedia.sanitize(bytes,true);
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
  var uploadName='cocktail-photo-editorial-blob-private.json';
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
      'editorial-photo-dispatch-private.json');
  var dispatch=annalsRead_(folder,'editorial-photo-dispatch-private.json');
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
  return 'photo_result_held';
}
