/* Pure, secret-free contractual policy for the owner-only Cocktail Register
 * editorial permit issuer. Compatible with Apps Script V8 and Node.
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
  var PERMIT_SCOPE = 'cocktail-editorial-transform-v1';
  var ORIGINAL_SCOPE = 'future_source_grounded_text_and_screened_image_publication';
  var SHA = /^[0-9a-f]{64}$/;
  var ID = /^annal-[0-9a-f]{24}$/;
  var PER_PHOTO = 200, MONTHLY = 500;
  var EXPECTED_RESERVATION = 'entryId,period,reservationCents,reservedAt,sourceSha256';
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
        input.signedPhotoVerified!==true ||
        input.originalRightsVerified!==true ||
        input.cocktailCategoryVerified!==true ||
        input.safePhotoScreeningVerified!==true ||
        input.noUnconsentedPeopleOrPrivateDetails!==true)
      return fail('specific_photo_evidence_not_verified');
    return {eligible:true,reason:'qualified_private_evidence_only'};
  }
  function validateLedger(ledger) {
    if (!ledger || typeof ledger!=='object'||Array.isArray(ledger)||
        Object.keys(ledger).sort().join(',')!=='monthlyCeilingCents,perPhotoCeilingCents,reservations,schemaVersion'||
        ledger.schemaVersion!==1 || ledger.monthlyCeilingCents!==MONTHLY ||
        ledger.perPhotoCeilingCents!==PER_PHOTO ||
        !Array.isArray(ledger.reservations) || ledger.reservations.length>2500)
      throw Error('Separate private editorial budget ledger invalid');
    var seen={},totals={};
    ledger.reservations.forEach(function (r) {
      if (!r || typeof r!=='object'||Array.isArray(r) ||
          Object.keys(r).sort().join(',')!==EXPECTED_RESERVATION ||
          !ID.test(r.entryId||'') || !SHA.test(r.sourceSha256||'') ||
          !/^\d{4}-(0[1-9]|1[0-2])$/.test(r.period||'') ||
          r.reservationCents!==PER_PHOTO ||
          !Number.isFinite(Date.parse(r.reservedAt)) ||
          period(new Date(r.reservedAt))!==r.period ||
          seen[r.sourceSha256])
        throw Error('Separate private editorial budget history invalid');
      seen[r.sourceSha256]=true;
      totals[r.period]=(totals[r.period]||0)+r.reservationCents;
      if(totals[r.period]>MONTHLY)throw Error('Monthly editorial budget oversubscribed');
    });
    return ledger;
  }
  function planReservation(input) {
    if (!input || !ID.test(input.entryId||'') ||
        !SHA.test(input.sourceSha256||'') ||
        !SHA.test(input.referenceSha256||'') ||
        !(input.now instanceof Date) ||
        !Number.isFinite(input.now.getTime()) ||
        input.rightsEligible!==true ||
        input.sourceStillSigned===false)
      throw Error('Exact source-bound owner-private reservation evidence required');
    var ledger=validateLedger(input.ledger),month=period(input.now),used=0;
    ledger.reservations.forEach(function (r) {
      if(r.sourceSha256===input.sourceSha256)throw Error('One-shot editorial source already reserved');
      if(r.period===month)used+=r.reservationCents;
    });
    if(used+PER_PHOTO>MONTHLY)throw Error('Separate monthly editorial allowance exhausted');
    var reservation={entryId:input.entryId,sourceSha256:input.sourceSha256,
      period:month,reservationCents:PER_PHOTO,reservedAt:input.now.toISOString()};
    return {reservation:reservation,ledger:{schemaVersion:1,
      monthlyCeilingCents:MONTHLY,perPhotoCeilingCents:PER_PHOTO,
      reservations:ledger.reservations.concat([reservation])}};
  }
  function unsignedPermit(input) {
    // Call ONLY after the private reservation has been durably saved and a
    // currently authenticated owner has rechecked all scoped grants.
    if(!input||input.rightsEligible!==true ||
       !SHA.test(input.referenceSha256||'') ||
       !/^[0-9a-f]{32}$/.test(input.nonce||'') ||
       !(input.now instanceof Date) ||
       !Number.isFinite(input.now.getTime()))throw Error('Editorial permit evidence missing');
    var ledger=validateLedger(input.ledger);
    var matching=ledger.reservations.filter(function (r) {
      return r.entryId===input.entryId &&
        r.sourceSha256===input.sourceSha256 &&
        r.period===period(input.now);
    });
    if(matching.length!==1)throw Error('No matching durable image budget reservation');
    return {scope:PERMIT_SCOPE,entryId:input.entryId,
      sourceSha256:input.sourceSha256,referenceSha256:input.referenceSha256,
      rightsActive:true,screened:true,budgetReserved:true,
      monthlyCeilingCents:MONTHLY,perPhotoCeilingCents:PER_PHOTO,
      reservedCents:PER_PHOTO,budgetPeriod:period(input.now),
      nonce:input.nonce,issuedAt:input.now.toISOString(),
      expiresAt:new Date(input.now.getTime()+120*60*1000).toISOString()};
  }
  return Object.freeze({evaluate:evaluate,validateLedger:validateLedger,
    planReservation:planReservation,unsignedPermit:unsignedPermit,
    canonical:canonical,serial:serial,period:period,PER_PHOTO:PER_PHOTO,
    MONTHLY:MONTHLY,PERMIT_SCOPE:PERMIT_SCOPE,MEMBER_SCOPE:MEMBER_SCOPE});
})();
if (typeof module!=='undefined' && module.exports) module.exports=AnnalsCocktailEditorial;
