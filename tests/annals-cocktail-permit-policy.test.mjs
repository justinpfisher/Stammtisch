/* No private records or real keys are used. The same pure policy runs under
 * Apps Script V8 and Node. Real permissions remain owner-private.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import Policy from '../scripts/annals/CocktailEditorialCore.js';

const id='annal-96b5ae266a36793c6a203033';
const source='a'.repeat(64),reference='b'.repeat(64);
const at=new Date('2026-10-20T23:30:00Z');
const active=(scope,when)=>({status:'active',scope,consentedAt:when});
function member(){
 return {
  status:'active',scope:'future_text_ai_drafting',
  autoPublication:active('future_source_grounded_text_and_screened_image_publication','2026-10-10T17:03:52Z'),
  photoSubjects:active('six_member_photographic_depiction','2026-10-15T21:18:38Z'),
  cocktailEditorialTransformation:{
   status:'active',scope:'cocktail_photo_ai_editorial_transformation',
   authority:'owner_attestation_2026_10_20',revocationsPrevail:true,
   recordedAt:'2026-10-20T22:34:56Z'
  }
 };
}
function rights(){
 return {
  member:member(),
  registry:{ownerAttestations:{cocktailEditorialTransformation:{
   status:'active',scope:'eligible_cocktail_photographs_ai_editorial_transformation',
   authority:'Justin Fisher, club owner',
   recordedAt:'2026-10-20T22:34:56Z'
  }}},
  receivedAt:'2026-10-18T16:52:26Z',
  now:at,senderAuthenticated:true,imageConsentAtReceipt:true,
  currentOriginalImagePermission:true,sourceRecordComplete:true,
  securityRecoveryVerified:true,
  signedPhotoVerified:true,originalRightsVerified:true,
  cocktailCategoryVerified:true,safePhotoScreeningVerified:true,
  noUnconsentedPeopleOrPrivateDetails:true
 };
}
const blank=()=>({schemaVersion:1,monthlyCeilingCents:500,
 perPhotoCeilingCents:200,reservations:[]});
const plan=(ledger,photo=id,src=source,when=at)=>Policy.planReservation({
 ledger,entryId:photo,sourceSha256:src,referenceSha256:reference,
 now:when,rightsEligible:true,sourceStillSigned:true
});
test('previously approved documentary photograph can have a later, owner-dated edit scope without backdating',()=>{
 const input=rights();
 assert.deepEqual(Policy.evaluate(input),{eligible:true,reason:'qualified_private_evidence_only'});
 assert.ok(Date.parse(input.member.cocktailEditorialTransformation.recordedAt)>
   Date.parse(input.receivedAt));
 assert.equal(Policy.MEMBER_SCOPE,'cocktail_photo_ai_editorial_transformation');
});
test('revocations always prevail across existing ordinary and editorial scopes',()=>{
 const cases=[
  x=>x.member.status='revoked',
  x=>x.member.revokedAt='2026-10-20T22:59:00Z',
  x=>x.member.autoPublication.status='revoked',
  x=>x.member.autoPublication.revokedAt='2026-10-20T22:59:00Z',
  x=>x.member.photoSubjects.status='revoked',
  x=>x.member.imagePublication={status:'revoked'},
  x=>x.member.cocktailEditorialTransformation.status='revoked',
  x=>x.member.cocktailEditorialTransformation.revokedAt='2026-10-20T23:10:00Z',
  x=>x.registry.ownerAttestations.cocktailEditorialTransformation.status='revoked'
 ];
 for(const edit of cases){
  const r=rights();edit(r);
  assert.equal(Policy.evaluate(r).eligible,false,edit.toString());
 }
});
test('source and rights must be verified by private authority, not sender allowlist or public manifest',()=>{
 const critical=[
  'senderAuthenticated','imageConsentAtReceipt','currentOriginalImagePermission',
  'sourceRecordComplete','securityRecoveryVerified',
  'signedPhotoVerified','originalRightsVerified',
  'cocktailCategoryVerified','safePhotoScreeningVerified',
  'noUnconsentedPeopleOrPrivateDetails'
 ];
 for(const key of critical){
  const r=rights();r[key]=false;
  assert.deepEqual(Policy.evaluate(r),
   {eligible:false,reason:'specific_photo_evidence_not_verified'});
 }
});
test('scope mismatch, future attestation, missing owner evidence and old ordinary publication fail closed',()=>{
 for(const change of [
  x=>x.registry.ownerAttestations={},
  x=>x.member.cocktailEditorialTransformation.scope='original-photo-only',
  x=>x.member.cocktailEditorialTransformation.authority='claimed-by-guest',
  x=>x.member.cocktailEditorialTransformation.recordedAt='2026-10-22T00:00:00Z',
  x=>x.member.autoPublication.scope='future_source_grounded_text_publication',
  x=>x.member.autoPublication.consentedAt='2026-10-19T00:00:00Z',
  x=>x.member.cocktailEditorialTransformation.revocationsPrevail=false,
  x=>x.registry.ownerAttestations.cocktailEditorialTransformation.recordedAt='2026-10-22T00:00:00Z'
 ]){
  let r=rights();change(r);assert.equal(Policy.evaluate(r).eligible,false);
 }
});
test('budget plan reserves exact USD 2 from separate USD 5 Toronto-month ledger',()=>{
 const p1=plan(blank());
 const p2=plan(p1.ledger,'annal-'+'c'.repeat(24),'c'.repeat(64));
 assert.equal(p1.reservation.period,'2026-10');
 assert.equal(p1.reservation.reservationCents,200);
 assert.equal(p2.ledger.reservations.length,2);
 assert.deepEqual(blank().reservations,[]);
 assert.throws(()=>plan(p2.ledger,'annal-'+'d'.repeat(24),'d'.repeat(64)),/allowance/);
 assert.throws(()=>plan(p1.ledger,id,source),/already reserved/);
 assert.throws(()=>plan(p1.ledger,id,source,new Date('2026-11-20T23:30:00Z')),/already reserved/);
});
test('Toronto month boundaries retain DST and January-year offset',()=>{
 assert.equal(Policy.period(new Date('2026-11-01T03:59:00Z')),'2026-10');
 assert.equal(Policy.period(new Date('2026-11-01T04:00:00Z')),'2026-11');
 assert.equal(Policy.period(new Date('2027-01-01T04:59:00Z')),'2026-12');
 assert.equal(Policy.period(new Date('2027-01-01T05:00:00Z')),'2027-01');
});
test('malformed, missing or replenished ledgers never initialise or clear history',()=>{
 assert.throws(()=>Policy.validateLedger(null),/invalid/);
 assert.throws(()=>plan(null),/invalid/);
 const valid=plan(blank()).ledger;
 assert.throws(()=>Policy.validateLedger({...valid,reservations:[...valid.reservations,...valid.reservations]}),/invalid/);
 assert.throws(()=>Policy.validateLedger({...valid,monthlyCeilingCents:700}),/invalid/);
 const forged={...valid,reservations:valid.reservations.map(x=>({...x,reservationCents:100}))};
 assert.throws(()=>Policy.validateLedger(forged),/invalid/);
 assert.throws(()=>Policy.planReservation({...{
  ledger:blank(),entryId:id,sourceSha256:source,referenceSha256:reference,
  now:at,rightsEligible:true,sourceStillSigned:false
 }}),/evidence/);
});
test('unsigned permit derives only from one durable source reservation and trusted nonce',()=>{
 const planned=plan(blank()),ledger=planned.ledger;
 assert.equal(Policy.PERMIT_SCOPE,'cocktail-editorial-transform-v1');
 const p=Policy.unsignedPermit({
  entryId:id,sourceSha256:source,referenceSha256:reference,
  rightsEligible:true,nonce:'f'.repeat(32),now:at,ledger
 });
 assert.equal(p.scope,'cocktail-editorial-transform-v1');
 assert.equal(p.entryId,id);assert.equal(p.sourceSha256,source);
 assert.equal(p.referenceSha256,reference);assert.equal(p.budgetReserved,true);
 assert.equal(p.reservedCents,200);assert.equal(p.monthlyCeilingCents,500);
 assert.equal(p.budgetPeriod,'2026-10');
 assert.equal(Date.parse(p.expiresAt)-Date.parse(p.issuedAt),7200000);
 assert.equal(Object.keys(p).sort().join(','),
  'budgetPeriod,budgetReserved,entryId,expiresAt,issuedAt,monthlyCeilingCents,nonce,perPhotoCeilingCents,referenceSha256,reservedCents,rightsActive,scope,screened,sourceSha256');
 assert.throws(()=>Policy.unsignedPermit({
  entryId:id,sourceSha256:'e'.repeat(64),referenceSha256:reference,
  rightsEligible:true,nonce:'f'.repeat(32),now:at,ledger
 }),/matching durable/);
 assert.throws(()=>Policy.unsignedPermit({
  entryId:id,sourceSha256:source,referenceSha256:reference,
  rightsEligible:false,nonce:'f'.repeat(32),now:at,ledger
 }),/missing/);
});
test('recursive stable JSON serialisation cannot be influenced by property insertion order',()=>{
 const p={members:[{z:1,a:2}],d:{y:3,b:4},a:'x'};
 const q={a:'x',d:{b:4,y:3},members:[{a:2,z:1}]};
 assert.equal(Policy.serial(p),Policy.serial(q));
 assert.equal(Policy.serial(q),'{"a":"x","d":{"b":4,"y":3},"members":[{"a":2,"z":1}]}');
});
