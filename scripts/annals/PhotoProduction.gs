function annalsSpeakerIdentities_(){return AnnalsProduction.portraitMap(AnnalsPilot.allowedSenders(annalsProps_().getProperty('ANNALS_ALLOWED_SENDERS')||''),JSON.parse(annalsProps_().getProperty('ANNALS_SPEAKER_IDENTITIES')||'null'));}
/* In-place extension; all new capabilities default off. No trigger/setup API. */
function annalsPhotosReady_(id){
  var p=annalsProps_();
  if(!Number.isFinite(Date.parse(p.getProperty('ANNALS_SIGNING_REMEDIATED_AT'))))return false;
  if(p.getProperty('ANNALS_AUTO_MEDIA_ENABLED')==='true' && p.getProperty('ANNALS_PHOTOS_V2_ENABLED')==='true' &&
    (p.getProperty('ANNALS_PHOTOS_HOSTED_ACCEPTED')==='true'||typeof annalsGuardedPhotosReady_==='function'&&annalsGuardedPhotosReady_()))return true;
  // A separate, short-lived, exact-source acceptance lane after security work.
  // It cannot enable another email or override consent, budget or one-shot gates.
  var until=Date.parse(p.getProperty('ANNALS_PHOTOS_ACCEPTANCE_UNTIL'));
  return /^[a-f0-9]{64}$/.test(id||'') && id===p.getProperty('ANNALS_PHOTOS_ACCEPTANCE_SOURCE_ID') &&
    until>Date.now() && until<=Date.now()+86400000;
}
function annalsReadPhotoPublicationGates(nonce){
  return annalsUiCall_(nonce,function(){var p=annalsProps_();return {
    automaticMedia:p.getProperty('ANNALS_AUTO_MEDIA_ENABLED')==='true',
    photosV2:p.getProperty('ANNALS_PHOTOS_V2_ENABLED')==='true',
    photosHostedAccepted:p.getProperty('ANNALS_PHOTOS_HOSTED_ACCEPTED')==='true',
    rulesV2:p.getProperty('ANNALS_RULES_V2_ENABLED')==='true',
    rulesHostedAccepted:p.getProperty('ANNALS_RULES_HOSTED_ACCEPTED')==='true',
    photoBlobTransport:p.getProperty('ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED')==='true',
    photoAcceptanceConfigured:!!p.getProperty('ANNALS_PHOTOS_ACCEPTANCE_SOURCE_ID')
  };});
}
/** Pure private V8 performance fixture. Never reads a signing property, calls a
 * provider, stores an image, dispatches or changes a gate. Reserve once so a
 * terminated/OOM test is not repeated automatically. This is NOT real quality. */
function annalsQualifyPhotoCodec(nonce){
  return annalsUiCall_(nonce,annalsRunPhotoCodecFixture_);
}
function annalsQualifyPhotoCodecInEditor_(){
  annalsOwner_();var result=annalsRunPhotoCodecFixture_();console.log(JSON.stringify(result));return result;
}
function annalsReadPhotoGatesInEditor_(){
  annalsOwner_();var p=annalsProps_(),names=['ANNALS_AUTO_MEDIA_ENABLED','ANNALS_PHOTOS_V2_ENABLED','ANNALS_PHOTOS_HOSTED_ACCEPTED','ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED','ANNALS_RULES_V2_ENABLED','ANNALS_RULES_HOSTED_ACCEPTED','ANNALS_RULES_V3_ENABLED','ANNALS_RULES_V3_HOSTED_ACCEPTED','ANNALS_RULES_V3_CLOCK_QUALIFIED','ANNALS_RULES_V3_AUTO_LITERAL_ENABLED','ANNALS_HISTORY_PUBLICATION_ENABLED'];
  var result={};names.forEach(function(name){result[name]=p.getProperty(name)==='true';});
  result.photoAcceptanceConfigured=!!p.getProperty('ANNALS_PHOTOS_ACCEPTANCE_SOURCE_ID');console.log(JSON.stringify(result));return result;
}
function annalsRunPhotoCodecFixture_(){
  return annalsLocked_(function(){
    var root=annalsRoot_(),name='photo-codec-fixture-v1-private.json',saved=annalsRead_(root,name);
    if(saved)return {executed:false,record:saved};
    var record={kind:'fictional-private-codec-runtime-only',state:'attempt_reserved',startedAt:new Date().toISOString(),genuinePhotoAccepted:false};
    annalsWriteOnce_(root,name,record);
    try{
      var started=Date.now(),width=4032,height=3024,pixels=new Uint8Array(width*height*4);
      for(var y=0;y<height;y++)for(var x=0;x<width;x++){
        var i=(y*width+x)*4;pixels[i]=x<width/2?220:30;pixels[i+1]=y<height/2?180:50;pixels[i+2]=90;pixels[i+3]=255;
      }
      var encoded=AnnalsJpegCodec.encode({data:pixels,width:width,height:height},85).data;pixels=null;
      record.results=[];
      for(var n=0;n<3;n++){
        var converted=AnnalsPhotoDerivative.convert(encoded,AnnalsJpegCodec,AnnalsMedia),thumb=AnnalsPhotoDerivative.thumbnail(converted.bytes,AnnalsJpegCodec,AnnalsMedia);
        if(converted.width!==1600||converted.height!==1200||thumb.width!==400||thumb.height!==300)throw new Error('Fixture dimensions disagree');
        record.results.push({width:converted.width,height:converted.height,bytes:converted.bytes.length,thumbnailBytes:thumb.bytes.length});
      }
      record.elapsedMs=Date.now()-started;record.state=record.elapsedMs<=180000?'passed_fixture_only':'held_runtime_too_slow';
    }catch(ignored){record.state='failed_no_retry';}
    record.completedAt=new Date().toISOString();annalsSavePrivate_(root,name,record);
    return {executed:true,record:record};
  });
}
function annalsPhotoSubjectGrants_(at){
  var members=annalsConsentRegistry_().members,map=annalsSpeakerIdentities_();
  return Object.keys(map).map(function(a){
    var m=members[a],g=m&&m.photoSubjects;
    return {member:map[a],active:!!(g&&g.status==='active'&&!g.revokedAt&&m.status==='active'&&!m.revokedAt&&(!m.imagePublication||m.imagePublication.status!=='revoked')&&m.autoPublication&&m.autoPublication.status==='active'&&!m.autoPublication.revokedAt),
      atReceipt:!!(g&&Number.isFinite(Date.parse(g.consentedAt))&&Date.parse(g.consentedAt)<=Date.parse(at))};
  });
}
function annalsPhotoEvidence_(source){
  var text=AnnalsAuto.cleanText(source.source.excerpt||''),subject=AnnalsAuto.cleanText(source.source.subject||'');
  return {senderAuthenticated:source.senderAuthenticated,imageConsentAtReceipt:source.imageConsentAtReceipt,
    originalRights:! /\b(?:not my photo|borrowed|found online|from (?:instagram|facebook|a website)|copyright|photographer unknown|forwarded photo)\b/i.test(subject+'\n'+text),
    peopleAttestedSixOnly:/\b(?:only (?:the )?(?:six )?(?:Stammtisch )?members|all six of us)\b/i.test(subject+'\n'+text)};
}
function annalsStandingGalleryCorrectionAllowed_(source,entry,folder){
  if(!source||source.senderAuthenticated!==true||source.imageConsentAtReceipt!==true)return false;
  if(!annalsImageConsentActive_(source.source.sender,source.source.receivedAt))return false;
  var grants=annalsPhotoSubjectGrants_(source.source.receivedAt);
  if(entry&&folder){
    var set=annalsRead_(folder,'photos-v2-private.json'),draft=annalsRead_(folder,'draft-private.json');
    if(!Array.isArray(set)||!draft||!Array.isArray(draft.imageReviews)||draft.imageReviews.length!==set.length)return false;
    var evidence=annalsPhotoEvidence_(source);
    return entry.photos.every(function(p){var i=set.findIndex(function(x){return x.sha256===p.sha256;});
      return i>=0&&AnnalsPhotos.allowed(evidence,draft.imageReviews[i],grants);});
  }
  // Older callers without exact per-image screening retain the conservative
  // six-member hold. No kind or consent is inferred from an AI face identity.
  return !!source&&source.senderAuthenticated===true&&source.imageConsentAtReceipt===true&&
    grants.length===6&&grants.every(function(g){return g.active&&g.atReceipt;});
}
/** Record the owner's 15 October standing attestation, not invented member mail.
 * Never calls this automatically or revives an individual revocation. */
function annalsRecordSixMemberPhotoAttestation(nonce,evidence){
  return annalsUiCall_(nonce,function(){return annalsLocked_(function(){
    if(typeof evidence!=='string'||evidence.trim().length<20||evidence.length>2000)throw new Error('Private attestation context required');
    var members=annalsConsentRegistry_().members,map=annalsSpeakerIdentities_(),at=new Date().toISOString();
    if(Object.keys(map).length!==6)throw new Error('Existing six identities required');
    Object.keys(map).forEach(function(a){var m=members[a];
      if(!m||m.status!=='active'||m.revokedAt||m.imagePublication&&m.imagePublication.status==='revoked'||m.photoSubjects&&m.photoSubjects.status==='revoked')throw new Error('Preserve individual revocation');
    });
    Object.keys(map).forEach(function(a){
      if(!members[a].photoSubjects)members[a].photoSubjects={status:'active',consentedAt:at,
        scope:'six_member_photographic_depiction',authority:'owner_attestation_2026_10_15',evidence:evidence};
    });
    var registry=annalsConsentRegistry_();registry.members=members;annalsSavePrivate_(annalsRoot_(),'consent-registry-private.json',registry);
    return {recorded:true,members:6,activated:false};
  });});
}
function annalsPhotoSet_(id,source,create){
  if(typeof publishGuardedJpegOnly_==='function'&&!publishGuardedJpegOnly_(source))return [];
  if(!annalsPhotosReady_(id)||!source.imageConsentAtReceipt||!annalsImageConsentActive_(source.source.sender,source.source.receivedAt))return [];
  var large=typeof annalsProps_==='function'&&annalsProps_().getProperty('ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED')==='true';
  var f=annalsFolder_(id),saved=annalsRead_(f,'photos-v2-private.json');
  if(saved){
    return saved.map(function(p){var file=annalsFile_(f,p.name);if(!file)throw new Error('Missing private derivative');
      var clean=AnnalsMedia.sanitize(file.getBlob().getBytes(),large);
      if(large&&Math.max(clean.width,clean.height)<AnnalsPhotos.MIN_LONG_EDGE)throw new Error('Derivative resolution requires qualification');
      if(annalsHash_(clean.bytes)!==p.sha256)throw new Error('Changed private derivative');
      return Object.assign({},p,{base64:Utilities.base64Encode(clean.bytes)});
    });
  }
  if(!create)return [];
  var items=source.attachmentManifest.items.filter(function(a){return a.accepted&&a.size>0&&a.size<=8*1024*1024&&/^image\/(?:jpeg|png|webp|heic|heif)$/.test(a.mime);});
  // Bounded gallery and provider input; do not silently truncate a larger set.
  if(!items.length||items.length>3)return [];
  var result=[],seen={};
  items.forEach(function(item){
    try{
      var original=annalsFile_(f,item.storageName),p;
      if(large&&item.mime==='image/jpeg'){
        // A failed JPEG orientation/conversion must never fall through to an
        // unqualified thumbnail. All enlarged transport inputs are screened.
        if(typeof annalsQualifiedPhotoDerivative_!=='function')return;
        p=annalsConvertPhotoOnce_(f,original,item);
        if(!p)return;
        p=AnnalsMedia.sanitize(p.bytes,true);
      }else{
        var thumbnail=original&&original.getThumbnail();
        if(!thumbnail)return;
        // Drive renders orientation before metadata removal. No undocumented
        // thumbnail URL resizing; undersized/unsupported HEIC stays private.
        p=AnnalsMedia.sanitize(thumbnail.getBytes(),large);
      }
      var digest=annalsHash_(p.bytes);
      if(large&&Math.max(p.width,p.height)<AnnalsPhotos.MIN_LONG_EDGE)return;
      if(seen[digest])return;seen[digest]=true;
      var name='screened-'+digest+'.jpg';
      if(!annalsFile_(f,name))annalsPrivate_(f.createFile(Utilities.newBlob(p.bytes,'image/jpeg',name)));
      result.push({sha256:digest,width:p.width,height:p.height,size:p.bytes.length,name:name,attachmentIndex:item.index,base64:Utilities.base64Encode(p.bytes)});
    }catch(ignored){/* This image stays private; independently safe text continues. */}
  });
  if(result.reduce(function(n,p){return n+p.size;},0)>(large?3*AnnalsPhotos.MAX_BYTES:32768))return [];
  if(result.length)annalsWriteOnce_(f,'photos-v2-private.json',result.map(function(p){var m=Object.assign({},p);delete m.base64;return m;}));
  return result;
}

// Pure JPEG conversion is CPU-heavy even without a provider call. Reserve once
// per attachment before decoding; an interrupted execution never repeats it.
function annalsConvertPhotoOnce_(folder,original,item){
  if(!Number.isInteger(item.index)||item.index<0||item.index>255)return null;
  var markerName='photo-conversion-'+item.index+'-private.json',record=annalsRead_(folder,markerName);
  if(record){
    if(record.state!=='ready'||!/^[a-f0-9]{64}$/.test(record.sha256||''))return null;
    var file=annalsFile_(folder,'screened-'+record.sha256+'.jpg');if(!file)return null;
    var existing=AnnalsMedia.sanitize(file.getBlob().getBytes(),true);
    return annalsHash_(existing.bytes)===record.sha256?existing:null;
  }
  record={state:'attempt_reserved',at:new Date().toISOString(),attachmentIndex:item.index};
  annalsWriteOnce_(folder,markerName,record);
  try{
    var converted=annalsQualifiedPhotoDerivative_(original,item);
    if(!converted)throw new Error('Conversion held');
    var clean=AnnalsMedia.sanitize(converted.bytes,true);
    if(Math.max(clean.width,clean.height)<AnnalsPhotos.MIN_LONG_EDGE)throw new Error('Small derivative');
    var digest=annalsHash_(clean.bytes),name='screened-'+digest+'.jpg';
    if(!annalsFile_(folder,name))annalsPrivate_(folder.createFile(Utilities.newBlob(clean.bytes,'image/jpeg',name)));
    record.state='ready';record.sha256=digest;
    annalsFile_(folder,markerName).setContent(JSON.stringify(record));return clean;
  }catch(ignored){record.state='held_no_retry';annalsFile_(folder,markerName).setContent(JSON.stringify(record));return null;}
}
function annalsPhotoDecision_(source,draft,id,decision,set){
  if(!set.length||!draft.imageReviews||draft.imageReviews.length!==set.length)return decision;
  var text=AnnalsAuto.cleanText(source.source.excerpt||''),subject=AnnalsAuto.cleanText(source.source.subject||'')||'A photographic contribution';
  var evidence=annalsPhotoEvidence_(source);
  var grants=annalsPhotoSubjectGrants_(source.source.receivedAt);
  var eligible=set.filter(function(p,i){return AnnalsPhotos.allowed(evidence,draft.imageReviews[i],grants);});
  if(!eligible.length)return decision;
  // Preserve ordinary eligible text when images are held. For a photo-only
  // message use literal safe member caption; never publish extraction evidence.
  if(!decision.eligible){
    if(['media_context_required','photo_only_requires_safe_permission','recipe_measure_or_step_uncertain','classification_not_supported','living_history_revision_required','source_incomplete','material_uncertainty'].indexOf(decision.reason)<0||
      decision.reason==='material_uncertainty'&&draft.riskFlags.some(function(flag){return ['faces_or_reflections','date_unconfirmed','other_uncertainty','attribution_unconfirmed'].indexOf(flag)<0;})||
      !subject||subject.length>150||text.length>250||AnnalsAuto.sensitiveText(subject+'\n'+text))return decision;
    decision={eligible:true,entry:{id:'annal-'+id.slice(0,24),category:draft.category==='assembly'?'assembly':draft.category==='cocktail'?'cocktail':'club_history',
      title:AnnalsAuto.censor(subject),summary:AnnalsAuto.censor(text)||'A photograph submitted to the Annals; event date unrecorded.',
      year:Number(source.source.receivedAt.slice(0,4)),dateLabel:'Submitted '+source.source.receivedAt.slice(0,7),sortDate:'',quoteVerbatim:'',
      recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]},credit:'anonymous'}};
  }
  if(decision.entry.category==='quotation')return decision;
  delete decision.entry.photo;
  decision.entry.photos=eligible.map(function(p){var a=draft.imageReviews[set.indexOf(p)];return {sha256:p.sha256,width:p.width,height:p.height,
    alt:a.kind==='member_group'?'Member-submitted group photograph':a.kind==='scenery'?'Member-submitted scenery':'Member-submitted drink or object'};});
  decision.entry.submittedAt=source.source.receivedAt;decision.entry.eventPeriod='';
  decision.mode=AnnalsPhotos.MODE;return decision;
}

/* Upload is PUBLIC storage, even before a commit. Only exact signed screened
 * derivatives may enter this route. Never upload originals or private records.
 * One operation journal is reserved before the first request. An incomplete,
 * rejected or unknown operation is never resumed or retried automatically. */
function annalsPhotoBlobRefs_(folder,entry,approval,eventType){
  if(['annals-auto-entry','annals-approved-entry','annals-correct-entry'].indexOf(eventType)<0)return null;
  var p=annalsProps_(),id=folder.getName(),name=eventType==='annals-correct-entry'?'correction-photo-upload-private.json':'photo-upload-private.json';
  if(p.getProperty('ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED')!=='true'||!annalsPhotosReady_(id)||
    !annalsPublisherDispatchReady_()||p.getProperty('ANNALS_GITHUB_REPOSITORY')!=='justinpfisher/Stammtisch'||
    !p.getProperty('ANNALS_GITHUB_TOKEN')||annalsFile_(folder,name)||annalsFile_(folder,'quarantine-private.json')||annalsFile_(folder,'removal-private.json'))return null;
  var source=annalsRead_(folder,'source-private.json');
  annalsOrdinarySourceGate_(source);
  if(!annalsStandingGalleryCorrectionAllowed_(source,entry,folder))return null;
  var saved=annalsRead_(folder,eventType==='annals-correct-entry'?'correction-approval-private.json':'approval-private.json');
  if(!saved||!annalsPrivateReceiptValid_(entry,saved.receipt)||AnnalsProduction.serial(entry)!==AnnalsProduction.serial(saved.entry)||
    AnnalsProduction.serial(approval)!==AnnalsProduction.serial(annalsPublicApproval_(entry,saved.receipt,p.getProperty('ANNALS_PUBLISH_SIGNING_KEY'))))return null;
  var age=Date.now()-Date.parse(approval.approvedAt);
  if(!Number.isFinite(age)||age < -60000||age>86400000)return null;
  AnnalsPhotos.validate(entry.photos);
  var set=annalsPhotoSet_(id,source,false),uploads=entry.photos.map(function(photo){
    var d=set.find(function(v){return v.sha256===photo.sha256;});
    if(!d)throw new Error('Missing approved derivative');
    var bytes=Utilities.base64Decode(d.base64),clean=AnnalsMedia.sanitize(bytes,true);
    if(annalsHash_(bytes)!==photo.sha256||annalsHash_(clean.bytes)!==photo.sha256||clean.width!==photo.width||clean.height!==photo.height)throw new Error('Derivative mismatch');
    // Qualify the identical deterministic hosted thumbnail before any public
    // blob is created; a known decoder/thumbnail failure must stay private.
    if(typeof AnnalsPhotoDerivative==='undefined'||typeof AnnalsJpegCodec==='undefined')throw new Error('Thumbnail codec unavailable');
    var thumb=AnnalsPhotoDerivative.thumbnail(clean.bytes,AnnalsJpegCodec,AnnalsMedia);
    if(thumb.bytes.length>98304)throw new Error('Thumbnail exceeds bound');
    var header=Utilities.newBlob('blob '+bytes.length+'\u0000').getBytes();
    var gitSha=annalsHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1,header.concat(Array.from(bytes))));
    return {sha256:photo.sha256,gitSha:gitSha,size:bytes.length,base64:d.base64};
  });
  var refs=uploads.map(function(u){return {sha256:u.sha256,gitSha:u.gitSha,size:u.size};});
  AnnalsPhotos.blobRefs(entry.photos,refs);
  // Check the final dispatch budget before creating any publicly stored blob.
  if(Utilities.newBlob(JSON.stringify({event_type:eventType,client_payload:{entry:entry,approval:approval,imageBlobs:refs}})).getBytes().length>60000)return null;
  var record={state:'attempt_reserved',at:new Date().toISOString(),contentSha256:approval.contentSha256,refs:refs,completed:0};
  annalsWriteOnce_(folder,name,record);
  try{
    for(var i=0;i<uploads.length;i++){
      // Revocation/expiry wins even between uploads; retain any public partials.
      if(!annalsPhotosReady_(id)||p.getProperty('ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED')!=='true'||
        !annalsStandingGalleryCorrectionAllowed_(source,entry,folder)||!annalsPublisherDispatchReady_())throw new Error('Upload gate closed');
      var response=UrlFetchApp.fetch('https://api.github.com/repos/justinpfisher/Stammtisch/git/blobs',{
        method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+p.getProperty('ANNALS_GITHUB_TOKEN'),Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
        payload:JSON.stringify({content:uploads[i].base64,encoding:'base64'}),muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
      if(response.getResponseCode()!==201){record.state='rejected_no_retry';break;}
      var body=response.getContentText();
      if(body.length>4096||JSON.parse(body).sha!==uploads[i].gitSha)throw new Error('Unexpected upload response');
      record.completed++;
      annalsFile_(folder,name).setContent(JSON.stringify(record));
    }
    if(record.completed===uploads.length)record.state='uploaded';
  }catch(ignored){record.state='unknown_no_retry';}
  record.completedAt=new Date().toISOString();annalsFile_(folder,name).setContent(JSON.stringify(record));
  if(record.state!=='uploaded'||!annalsPhotosReady_(id)||p.getProperty('ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED')!=='true'||!annalsStandingGalleryCorrectionAllowed_(source,entry,folder))return null;
  return refs;
}

// Called after exact archive/signature/HTML reconciliation. Eight public reads
// maximum: three full/thumbnail pairs, index and exact expected 24-record shard.
function annalsVerifyPhotoAssets_(entry,archive,query){
  if(!entry.photos)return true;
  try{
    AnnalsPhotos.validate(entry.photos);
    if(!archive||!Array.isArray(archive.entries)||archive.entries.length>5000)return false;
    var options={method:'get',muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true};
    for(var i=0;i<entry.photos.length;i++){
      var photo=entry.photos[i],r=UrlFetchApp.fetch('https://stammtischbrewery.com/assets/annals/'+photo.sha256+'.jpg'+query,options);
      if(r.getResponseCode()!==200)return false;
      var bytes=r.getBlob().getBytes();
      if(bytes.length>AnnalsPhotos.MAX_BYTES||annalsHash_(bytes)!==photo.sha256)return false;
      var clean=AnnalsMedia.sanitize(bytes,true);
      if(clean.width!==photo.width||clean.height!==photo.height||annalsHash_(clean.bytes)!==photo.sha256)return false;
      if(Math.max(photo.width,photo.height)>=800){
        if(typeof AnnalsPhotoDerivative==='undefined'||typeof AnnalsJpegCodec==='undefined')return false;
        var thumb=AnnalsPhotoDerivative.thumbnail(clean.bytes,AnnalsJpegCodec,AnnalsMedia);
        var tr=UrlFetchApp.fetch('https://stammtischbrewery.com/assets/annals/'+photo.sha256+'-thumb.jpg'+query,options);
        if(tr.getResponseCode()!==200)return false;
        var tb=tr.getBlob().getBytes();
        if(tb.length>98304||annalsHash_(tb)!==annalsHash_(thumb.bytes))return false;
      }
    }
    var target=AnnalsPhotos.indexRow(entry);
    var rows=archive.entries.filter(function(e){return AnnalsPhotos.photos(e).length;}).map(AnnalsPhotos.indexRow)
      .filter(function(r){return r.collection===target.collection&&r.year===target.year;}).sort(AnnalsPhotos.indexOrder);
    var index=rows.findIndex(function(r){return r.entryId===entry.id;});if(index<0)return false;
    var expected=JSON.stringify(rows.slice(Math.floor(index/24)*24,Math.floor(index/24)*24+24))+'\n';
    var digest=annalsHash_(expected),path='data/photos/'+digest+'.json';
    var response=UrlFetchApp.fetch('https://stammtischbrewery.com/data/photos/index.json'+query,options);
    if(response.getResponseCode()!==200)return false;
    var text=response.getContentText();if(text.length>1000000)return false;
    var manifest=JSON.parse(text);
    if(manifest.schemaVersion!==1||!Array.isArray(manifest.pages)||manifest.pages.length>5000||
      manifest.pages.filter(function(p){return p.path===path&&p.collection===target.collection&&p.year===target.year;}).length!==1)return false;
    response=UrlFetchApp.fetch('https://stammtischbrewery.com/'+path+query,options);
    if(response.getResponseCode()!==200)return false;
    text=response.getContentText();return text.length<=1000000&&text===expected;
  }catch(ignored){return false;}
}

// Gallery corrections are a new exact revision of an existing entry. The old
// automatic-live marker cannot certify them, and no publication mail is resent.
function annalsVerifyGalleryCorrection_(folder,id){
  var name='correction-live-verification-private.json',saved=annalsRead_(folder,'correction-approval-private.json');
  if(annalsFile_(folder,name)||annalsFile_(folder,'removal-private.json')||!saved||!saved.entry||!saved.entry.photos||
    saved.publicationState!=='dispatch_accepted'||!saved.publication||!annalsPrivateReceiptValid_(saved.entry,saved.receipt))return false;
  try{
    var query='?checked='+id.slice(0,16)+'-'+Date.now(),options={muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true,headers:{'Cache-Control':'no-cache'}};
    function read(url,limit){var r=UrlFetchApp.fetch(url+query,options);if(r.getResponseCode()!==200)throw new Error('Correction bytes unavailable');var text=r.getContentText();if(!text||text.length>limit)throw new Error('Correction evidence exceeds bound');return text;}
    var raw='https://raw.githubusercontent.com/justinpfisher/Stammtisch/main/',host='https://stammtischbrewery.com/';
    var archiveText=read(raw+'data/annals-approved.json',1000000);
    if(archiveText!==read(host+'data/annals-approved.json',1000000))return false;
    var archive=JSON.parse(archiveText),entry=archive.entries.find(function(e){return e.id===saved.entry.id;}),approval=archive.approvals.find(function(a){return a.entryId===saved.entry.id;});
    if(!entry||!approval||annalsHash_(AnnalsProduction.serial(entry))!==saved.receipt.contentSha256||AnnalsProduction.serial(approval)!==AnnalsProduction.serial(saved.publication))return false;
    var html=read(raw+'annals.html',2000000);
    if(html!==read(host+'annals.html',2000000)||html.indexOf('id="'+saved.entry.id+'"')<0||!annalsVerifyPhotoAssets_(entry,archive,query))return false;
    annalsWriteOnce_(folder,name,{state:'verified_live',contentSha256:saved.receipt.contentSha256,verifiedAt:new Date().toISOString()});
    // A fast correction may precede the original publication reconciliation.
    // Send the original final outcome once only if it was never attempted.
    var source=annalsRead_(folder,'source-private.json');
    if(source&&source.senderAuthenticated===true&&source.source&&source.source.sender&&!annalsFile_(folder,'published-email-private.json')){
      annalsWriteOnce_(folder,'published-email-private.json',{state:'attempted_once',at:new Date().toISOString()});
      try{GmailApp.sendEmail(source.source.sender,'Your Stammtisch Annals entry is published',
        'Your Annals contribution, including its exact correction, was verified on the public website:\nhttps://stammtischbrewery.com/annals.html#'+entry.id+'\n\nOld copies in public GitHub history may remain.');}catch(ignored){}
    }
    return true;
  }catch(ignored){return false;}
}
