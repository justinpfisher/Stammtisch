function annalsSpeakerIdentities_(){return AnnalsProduction.portraitMap(AnnalsPilot.allowedSenders(annalsProps_().getProperty('ANNALS_ALLOWED_SENDERS')||''),JSON.parse(annalsProps_().getProperty('ANNALS_SPEAKER_IDENTITIES')||'null'));}
/* In-place extension; all new capabilities default off. No trigger/setup API. */
function annalsPhotosReady_(){
  var p=annalsProps_();
  return p.getProperty('ANNALS_AUTO_MEDIA_ENABLED')==='true' && p.getProperty('ANNALS_PHOTOS_V2_ENABLED')==='true' &&
    p.getProperty('ANNALS_PHOTOS_HOSTED_ACCEPTED')==='true' &&
    Number.isFinite(Date.parse(p.getProperty('ANNALS_SIGNING_REMEDIATED_AT')));
}
function annalsPhotoSubjectGrants_(at){
  var members=annalsConsentRegistry_().members,map=annalsSpeakerIdentities_();
  return Object.keys(map).map(function(a){
    var m=members[a],g=m&&m.photoSubjects;
    return {member:map[a],active:!!(g&&g.status==='active'&&!g.revokedAt&&m.status==='active'&&!m.revokedAt&&(!m.imagePublication||m.imagePublication.status!=='revoked')&&m.autoPublication&&m.autoPublication.status==='active'&&!m.autoPublication.revokedAt),
      atReceipt:!!(g&&Number.isFinite(Date.parse(g.consentedAt))&&Date.parse(g.consentedAt)<=Date.parse(at))};
  });
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
  if(!annalsPhotosReady_()||!source.imageConsentAtReceipt||!annalsImageConsentActive_(source.source.sender,source.source.receivedAt))return [];
  var f=annalsFolder_(id),saved=annalsRead_(f,'photos-v2-private.json');
  if(saved){
    return saved.map(function(p){var file=annalsFile_(f,p.name);if(!file)throw new Error('Missing private derivative');
      var clean=AnnalsMedia.sanitize(file.getBlob().getBytes());
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
      var original=annalsFile_(f,item.storageName),thumbnail=original&&original.getThumbnail();
      if(!thumbnail)return;
      // Drive renders orientation before metadata removal. Unsupported or
      // unexpectedly large thumbnails fail closed, including HEIC failures.
      var p=AnnalsMedia.sanitize(thumbnail.getBytes()),digest=annalsHash_(p.bytes);
      if(seen[digest])return;seen[digest]=true;
      var name='screened-'+digest+'.jpg';
      if(!annalsFile_(f,name))annalsPrivate_(f.createFile(Utilities.newBlob(p.bytes,'image/jpeg',name)));
      result.push({sha256:digest,width:p.width,height:p.height,size:p.bytes.length,name:name,attachmentIndex:item.index,base64:Utilities.base64Encode(p.bytes)});
    }catch(ignored){/* This image stays private; independently safe text continues. */}
  });
  if(result.reduce(function(n,p){return n+p.size;},0)>32768)return [];
  if(result.length)annalsWriteOnce_(f,'photos-v2-private.json',result.map(function(p){var m=Object.assign({},p);delete m.base64;return m;}));
  return result;
}
function annalsPhotoDecision_(source,draft,id,decision,set){
  if(!set.length||!draft.imageReviews||draft.imageReviews.length!==set.length)return decision;
  var text=AnnalsAuto.cleanText(source.source.excerpt||''),subject=AnnalsAuto.cleanText(source.source.subject||'')||'A photographic contribution';
  var evidence={senderAuthenticated:source.senderAuthenticated,imageConsentAtReceipt:source.imageConsentAtReceipt,
    originalRights:! /\b(?:not my photo|borrowed|found online|from (?:instagram|facebook|a website)|copyright|photographer unknown|forwarded photo)\b/i.test(subject+'\n'+text),peopleAttestedSixOnly:/\b(?:only (?:the )?(?:six )?(?:Stammtisch )?members|all six of us)\b/i.test(subject+'\n'+text)};
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
  decision.mode=AnnalsMediaPolicy.MODE;return decision;
}
