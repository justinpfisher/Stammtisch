/* Pure, secret-free photographic rights and source-bound signing policy.
 * Compatible with Apps Script V8 and Node.
 *
 * No Drive reads, property inspection, signing, HTTP, publication or mutation
 * happens here. Source/receipt authentication MUST be done independently by
 * the trusted private caller. A returned "eligible" decision is not itself a
 * publication or provider-call authorisation.
 */
var AnnalsCocktailEditorial = (function () {
  'use strict';
  var OWNER_SCOPE = 'eligible_cocktail_photographs_ai_editorial_transformation';
  var MEMBER_SCOPE = 'cocktail_photo_ai_editorial_transformation';
  var PERMIT_SCOPE = 'cocktail-editorial-transform-v2';
  var ORIGINAL_SCOPE = 'future_source_grounded_text_and_screened_image_publication';
  var SHA = /^[0-9a-f]{64}$/;
  var ID = /^annal-[0-9a-f]{24}$/;
  function canonical(v) {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === 'object') {
      var o={};Object.keys(v).sort().forEach(function (k) {o[k]=canonical(v[k]);});
      return o;
    }
    return v;
  }
  function serial(v) {return JSON.stringify(canonical(v));}
  function period(now) {
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw Error('Invalid reservation date');
    var fields={};
    new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit'})
      .formatToParts(now).forEach(function (p) {fields[p.type]=p.value;});
    return fields.year+'-'+fields.month;
  }
  function active(g) { return !!g && g.status==='active' && !g.revokedAt; }
  function safeAt(v, now) { var t=Date.parse(v);return Number.isFinite(t)&&t<=now.getTime(); }
  function fail(reason) {return {eligible:false,reason:reason};}
  function evaluate(input) {
    // Pass an already authenticated source and an already verified signed
    // source-photo reference; these booleans MUST come from private evidence,
    // never from a member's email, metadata, model output or public manifest.
    if (!input || !input.member || !input.registry ||
        !input.receivedAt || !(input.now instanceof Date) ||
        !Number.isFinite(input.now.getTime())) return fail('private_evidence_missing');
    var m=input.member,owner=input.registry.ownerAttestations &&
      input.registry.ownerAttestations.cocktailEditorialTransformation;
    if (!active(m) || !active(m.autoPublication) ||
        m.autoPublication.scope!==ORIGINAL_SCOPE ||
        !safeAt(m.autoPublication.consentedAt,input.now) ||
        Date.parse(m.autoPublication.consentedAt)>Date.parse(input.receivedAt) ||
        !active(m.photoSubjects) || !safeAt(m.photoSubjects.consentedAt,input.now) ||
        (m.imagePublication && (!active(m.imagePublication))) )
      return fail('ordinary_photo_permission_not_current');
    if (!active(owner) || owner.scope!==OWNER_SCOPE ||
        owner.authority!=='Justin Fisher, club owner' ||
        !safeAt(owner.recordedAt,input.now) ||
        !active(m.cocktailEditorialTransformation) ||
        m.cocktailEditorialTransformation.scope!==MEMBER_SCOPE ||
        m.cocktailEditorialTransformation.authority!=='owner_attestation_2026_10_20' ||
        m.cocktailEditorialTransformation.revocationsPrevail!==true ||
        !safeAt(m.cocktailEditorialTransformation.recordedAt,input.now))
      return fail('editorial_transformation_permission_not_current');
    if (!safeAt(input.receivedAt,input.now) ||
        input.senderAuthenticated!==true ||
        input.imageConsentAtReceipt!==true ||
        input.currentOriginalImagePermission!==true ||
        input.sourceRecordComplete!==true ||
        input.securityRecoveryVerified!==true ||
        input.signedPhotoVerified!==true ||
        input.originalRightsVerified!==true ||
        input.cocktailCategoryVerified!==true ||
        input.safePhotoScreeningVerified!==true ||
        input.noUnconsentedPeopleOrPrivateDetails!==true)
      return fail('specific_photo_evidence_not_verified');
    return {eligible:true,reason:'qualified_private_evidence_only'};
  }
  // The provider's existing US$5 monthly hard cap is the sole money control.
  // This short-lived signature proves separate transformation rights; one
  // immutable issuer receipt and a durable source attempt marker prevent replays.
  function unsignedPermit(input) {
    if(!input || !ID.test(input.entryId||'') ||
       !SHA.test(input.sourceSha256||'') ||
       !SHA.test(input.referenceSha256||'') ||
       input.rightsEligible!==true || input.sourceStillSigned!==true ||
       !/^[0-9a-f]{32}$/.test(input.nonce||'') ||
       !(input.now instanceof Date) || !Number.isFinite(input.now.getTime()))
      throw Error('Exact source and editorial rights evidence required');
    return {scope:PERMIT_SCOPE,entryId:input.entryId,
      sourceSha256:input.sourceSha256,referenceSha256:input.referenceSha256,
      rightsActive:true,screened:true,
      nonce:input.nonce,issuedAt:input.now.toISOString(),
      expiresAt:new Date(input.now.getTime()+120*60*1000).toISOString()};
  }
  var JOB_TOKEN=/^[0-9a-f]{32}$/;
  function boundedVisualText(value,limit){
    if(typeof value!=='string')return '';
    var text=value.replace(/[\u0000-\u001f\u007f]/g,' ')
      .replace(/https?:\/\/\S+|www\.\S+/gi,' ')
      .replace(/\s+/g,' ').trim();
    if(text.length>limit||/\b(?:ignore|override|system prompt|credential|password|policy)\b/i.test(text))return '';
    return text;
  }
  function photoJob(input){
    if(!input||!ID.test(input.entryId||'')||!SHA.test(input.sourceSha256||'')||
       !JOB_TOKEN.test(input.jobToken||'')||!Number.isInteger(input.photoIndex)||
       input.photoIndex<0||input.photoIndex>2)
      throw Error('Exact source-bound photo job required');
    var ingredients=Array.isArray(input.ingredients)?input.ingredients.slice(0,12)
      .map(function(v){return boundedVisualText(v,100)}).filter(Boolean):[];
    return {schema:'annals-photo-job-v1',jobToken:input.jobToken,
      entryId:input.entryId,sourceSha256:input.sourceSha256,photoIndex:input.photoIndex,
      name:boundedVisualText(input.name,120),
      description:boundedVisualText(input.description,400),
      ingredients:ingredients,
      keywords:boundedVisualText(input.keywords,160)};
  }
  var RESULT_QA=['sameGlass','sameDrinkAndGarnish','photorealisticSubject',
    'plausibleStemOrBase','sceneAppropriate','noArtifactsOrPrivateDetails'];
  function validatePhotoResult(result,job,authenticatedSender,now){
    if(authenticatedSender!==true)throw Error('Authenticated worker sender required');
    if(!result||!job||result.schema!=='annals-photo-result-v1')
      throw Error('Invalid photo result contract');
    if(result.jobToken!==job.jobToken||result.entryId!==job.entryId||
       result.sourceSha256!==job.sourceSha256)throw Error('Photo result source mismatch');
    if(result.status==='held'){
      if(Object.keys(result).sort().join(',')!==
         'entryId,jobToken,reasonCode,schema,sourceSha256,status'||
         ['source_unreadable','identity_uncertain','edit_failed',
          'visual_qa_failed','attachment_unavailable'].indexOf(result.reasonCode)<0)
        throw Error('Invalid held photo result');
      return {qualified:false,reason:result.reasonCode};
    }
    if(Object.keys(result).sort().join(',')!==
       'alt,entryId,generatedAt,generationModel,generationProvider,jobToken,qa,reviewedAt,schema,sourceSha256,status'||
       result.status!=='qualified'||!result.qa||Array.isArray(result.qa)||
       Object.keys(result.qa).sort().join(',')!==RESULT_QA.slice().sort().join(',')||
       RESULT_QA.some(function(k){return result.qa[k]!==true}))
      throw Error('Photo result did not pass every visual check');
    if(typeof result.alt!=='string'||result.alt.length<20||result.alt.length>240||
       !/^AI-stylized\\b/.test(result.alt)||/[\\u0000-\\u001f\\u007f]|https?:\\/\\//i.test(result.alt))
      throw Error('Invalid editorial alt description');
    if(result.generationProvider!=='openai-chatgpt'||
       result.generationModel!=='undisclosed'||
       ![result.generatedAt,result.reviewedAt].every(function(v){
         return typeof v==='string'&&/^\\d{4}-\\d{2}-\\d{2}T/.test(v)&&Number.isFinite(Date.parse(v));
       })||Date.parse(result.reviewedAt)<Date.parse(result.generatedAt))
      throw Error('Invalid generation provenance');
    if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('Valid receipt time required');
    return {qualified:true,receivedAt:now.toISOString(),alt:result.alt,
      generatedAt:result.generatedAt,reviewedAt:result.reviewedAt,
      generationProvider:result.generationProvider,generationModel:result.generationModel};
  }
  return Object.freeze({evaluate:evaluate,unsignedPermit:unsignedPermit,photoJob:photoJob,validatePhotoResult:validatePhotoResult,
    canonical:canonical,serial:serial,PERMIT_SCOPE:PERMIT_SCOPE,
    MEMBER_SCOPE:MEMBER_SCOPE});
})();
if (typeof module!=='undefined' && module.exports) module.exports=AnnalsCocktailEditorial;
