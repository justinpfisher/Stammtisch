/* Fully fictional test of the SOURCE-ONLY Apps Script issuer.
 * No Drive account, original member data, private key or provider endpoint.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,createHmac} from 'node:crypto';
import vm from 'node:vm';
import Policy from '../scripts/annals/CocktailEditorialCore.js';
import {verifyEditorialPermit} from '../scripts/annals/CocktailImageEdit.mjs';

const moduleSource=readFileSync(new URL('../scripts/annals/CocktailEditorialProduction.gs',import.meta.url),'utf8');
const referenceBuffer=Buffer.alloc(5000,17),referenceId='fictional-owner-approved-reference-id';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const itemId='c'.repeat(64),entryId='annal-'+itemId.slice(0,24),sourceSha='d'.repeat(64);
const publicKey='fictional-publisher-key-'+'p'.repeat(40);
const issuerKey='fictional-editorial-permit-key-'+'i'.repeat(40);
const fakeApprovalKey='fictional-private-approval-key-'+'a'.repeat(40);
function fixture({recovered=true,enabled=true,originalReceiptValid=true,revoked=false}={}){
 const signed={
  entry:{id:entryId,category:'cocktail',photo:{sha256:sourceSha,alt:'Fictional amber drink'}},
  receipt:{consents:{photoPublication:true}},
  publicationState:'dispatch_accepted',uncertaintiesReviewed:true
 };
 const submission={
  senderAuthenticated:true,imageConsentAtReceipt:true,
  source:{sender:'fictional@example.invalid',receivedAt:'2026-10-19T16:52:26Z',
   sourceTruncated:false,subjectTruncated:false,excerptTruncated:false}
 };
 const member={
  status:'active',scope:'future_text_ai_drafting',
  autoPublication:{status:'active',scope:'future_source_grounded_text_and_screened_image_publication',
   consentedAt:'2026-10-10T17:00:00Z'},
  photoSubjects:{status:'active',scope:'six_member_photographic_depiction',
   consentedAt:'2026-10-15T21:00:00Z'},
  cocktailEditorialTransformation:{status:revoked?'revoked':'active',
   scope:'cocktail_photo_ai_editorial_transformation',
   authority:'owner_attestation_2026_10_20',
   recordedAt:'2026-10-20T00:00:00Z',revocationsPrevail:true}
 };
 const registry={ownerAttestations:{cocktailEditorialTransformation:{
   status:'active',scope:'eligible_cocktail_photographs_ai_editorial_transformation',
   authority:'Justin Fisher, club owner',recordedAt:'2026-10-20T00:00:00Z'
 }},members:{'fictional@example.invalid':member}};
 const props={
  ANNALS_EDITORIAL_SECURITY_RECOVERY_VERIFIED:recovered?'true':'false',
  ANNALS_EDITORIAL_IMAGE_ENABLED:enabled?'true':'false',
  ANNALS_EDITORIAL_PROJECT_HARD_LIMIT_VERIFIED:'true',
  ANNALS_EDITORIAL_PERMIT_SIGNING_KEY:issuerKey,
  ANNALS_PUBLISH_SIGNING_KEY:publicKey,
  ANNALS_APPROVAL_KEY:fakeApprovalKey,
  ANNALS_EDITORIAL_IMAGE_API_KEY:'fictional-model-key-not-real',
  ANNALS_EDITORIAL_REFERENCE_FILE_ID:referenceId
 };
 const root={files:new Map([['cocktail-editorial-budget-private.json',
  {schemaVersion:1,monthlyCeilingCents:500,perPhotoCeilingCents:200,reservations:[]}]])};
 const folder={files:new Map([
  ['source-private.json',submission],
  ['approval-private.json',signed]
 ])};
 const log=[],events={};
 const context={
  // Keep dates in one realm for the pure Node/App Script policy fixture.
  Date:Date,Intl:Intl,
  AnnalsCocktailEditorial:Policy,
  annalsOwner_:()=>{events.ownerChecks=(events.ownerChecks||0)+1},
  annalsLocked_:(fn)=>fn(),
  annalsProps_:()=>({getProperty:(key)=>props[key]??''}),
  annalsFolder_:(id)=>{if(id!==itemId)throw Error('No private item');return folder},
  annalsRead_:(f,name)=>f.files.get(name)||null,
  annalsRoot_:()=>root,
  annalsFile_:(f,name)=>f.files.has(name)?{name:name}:null,
  annalsWriteOnce_:(f,name,v)=>{if(f.files.has(name))throw Error('Immutable record already exists');f.files.set(name,v);return {name}},
  annalsSavePrivate_:(f,name,v)=>{f.files.set(name,v)},
  annalsPrivateReceiptValid_:()=>originalReceiptValid,
  annalsImageConsentActive_:()=>true,
  annalsPhotoEvidence_:()=>({originalRights:true}),
  annalsConsentRegistry_:()=>registry,
  annalsPrivate_:(x)=>x,
  DriveApp:{getFileById:(id)=>{if(id!==referenceId)throw Error('Ref missing');return {
   getMimeType:()=> 'image/jpeg',
   getBlob:()=>({getBytes:()=>Array.from(referenceBuffer)})
  }}},
  annalsHash_:(bytes)=>sha(Buffer.from(bytes)),
  annalsHex_:(b)=>Buffer.from(b).toString('hex'),
  Utilities:{
   Charset:{UTF_8:'UTF-8'},
   getUuid:()=> 'ffffffff-ffff-ffff-ffff-ffffffffffff',
   computeHmacSha256Signature:(raw,key)=>Array.from(createHmac('sha256',key).update(raw).digest())
  },
  UrlFetchApp:{fetch:(url,options)=>{
    events.modelRequests=(events.modelRequests||0)+1;
    events.modelRequestShape={url,method:options.method,
      followRedirects:options.followRedirects,
      muteHttpExceptions:options.muteHttpExceptions};
    if(events.rejectModelRequest)throw Error('fictional network failure');
    return {getResponseCode:()=>events.modelResponseCode??200};
  }},
  console:{log:(...args)=>log.push(args)}
 };
 vm.createContext(context);
 vm.runInContext(moduleSource,context,{filename:'CocktailEditorialProduction.gs',timeout:10000});
 return {context,folder,root,props,member,signed,log,events};
}
test('owner preflight returns Boolean statuses only and makes no writes or calls',()=>{
 const f=fixture();
 const report=f.context.annalsCocktailEditorialPreflightInEditor(itemId,0);
 assert.equal(report.eligible,true);
 assert.equal(report.providerCalled,false);
 assert.equal(report.published,false);
 assert.equal(report.recoveryRequired,false);
 assert.ok(f.events.ownerChecks>0);
 assert.equal(f.root.files.size,1);
 assert.equal(f.folder.files.size,2);
 assert.deepEqual(f.log,[]);
 assert.doesNotMatch(JSON.stringify(report),/fictional-model-key|permit-key|publisher-key|example.invalid/);
});
test('owner-private issuer writes a durable budget reservation and distinct signed permit, never a paid request',()=>{
 const f=fixture();
 const result=f.context.annalsCocktailEditorialReserveInEditor(itemId,0);
 assert.equal(result.reserved,true);assert.equal(result.requestMade,false);
 assert.equal(result.published,false);assert.equal(result.reservationCents,200);
 const ledger=f.root.files.get('cocktail-editorial-budget-private.json');
 assert.equal(ledger.reservations.length,1);
 assert.equal(ledger.reservations[0].entryId,entryId);
 const record=f.folder.files.get('cocktail-editorial-permit-'+sourceSha+'-private.json');
 assert.equal(record.state,'reserved_unspent');
 assert.equal(record.providerCalled,false);
 assert.equal(record.publicRelease,false);
 assert.equal(record.permit.referenceSha256,sha(referenceBuffer));
 const verified=verifyEditorialPermit(record.permit,{
  entryId,sourceSha256:sourceSha,referenceSha256:sha(referenceBuffer),
  signingKey:publicKey,permitSigningKey:issuerKey,
  now:new Date(record.permit.issuedAt)
 });
 assert.equal(verified.budgetReserved,true);
 assert.equal(f.log.length,0);
 assert.throws(()=>f.context.annalsCocktailEditorialReserveInEditor(itemId,0),/reserved/);
});
test('issuer refuses until separate incident recovery, even when project hard limit exists',()=>{
 const f=fixture({recovered:false});
 const view=f.context.annalsCocktailEditorialPreflightInEditor(itemId,0);
 assert.equal(view.eligible,false);
 assert.equal(view.recoveryRequired,true);
 assert.throws(()=>f.context.annalsCocktailEditorialReserveInEditor(itemId,0),/disabled/);
 assert.equal(f.root.files.get('cocktail-editorial-budget-private.json').reservations.length,0);
});
test('issuer refuses revocation, missing historical receipt or disabled feature, with no ledger mutation',()=>{
 for(const config of [{revoked:true},{originalReceiptValid:false},{enabled:false}]){
  const f=fixture(config);
  assert.throws(()=>f.context.annalsCocktailEditorialReserveInEditor(itemId,0));
  assert.equal(f.root.files.get('cocktail-editorial-budget-private.json').reservations.length,0);
 }
});
test('missing budget ledger never triggers unsafe reset or a spending permit',()=>{
 const f=fixture();f.root.files.delete('cocktail-editorial-budget-private.json');
 assert.throws(()=>f.context.annalsCocktailEditorialReserveInEditor(itemId,0),/ledger invalid/);
 assert.equal(f.root.files.size,0);
});
test('no raw Script Properties enumeration or key logging exists in staged issuer source',()=>{
 assert.doesNotMatch(moduleSource,/getProperties\s*\(/);
 assert.doesNotMatch(moduleSource,/console\.(?:log|warn|error)\s*\(/);
 assert.equal((moduleSource.match(/UrlFetchApp\.fetch\s*\(/g)||[]).length,1);
 assert.doesNotMatch(moduleSource,/(?:setProperty|deleteProperty)\s*\(/);
 assert.match(moduleSource,/ANNALS_EDITORIAL_SECURITY_RECOVERY_VERIFIED/);
 assert.match(moduleSource,/ANNALS_EDITORIAL_PERMIT_SIGNING_KEY/);
});

test('credential status uses owner-only GET and returns Booleans, never keys or response bodies',()=>{
 const f=fixture();
 const result=f.context.annalsCocktailEditorialCredentialPreflightInEditor();
 assert.equal(result.kind,'cocktail-editorial-credential-readonly-v1');
 assert.equal(result.imageCredentialPresent,true);
 assert.equal(result.permitSignerPresentAndDistinct,true);
 assert.equal(result.modelLookupAccepted,true);
 assert.equal(result.modelLookupStatus,'model_metadata_visible');
 assert.equal(result.recoveryFlagSet,true);
 assert.equal(result.projectHardLimitFlagSet,true);
 assert.equal(result.paidRequestMade,false);
 assert.equal(result.propertiesChanged,false);
 assert.equal(f.events.modelRequests,1);
 assert.deepEqual(f.events.modelRequestShape,{
   url:'https://api.openai.com/v1/models/gpt-image-2.5-sunburst',
   method:'get',followRedirects:false,muteHttpExceptions:true
 });
 assert.equal(f.root.files.size,1);
 assert.equal(f.folder.files.size,2);
 assert.deepEqual(f.log,[]);
 assert.doesNotMatch(JSON.stringify(result),/fictional-model-key|permit-key|publisher-key|example.invalid|Bearer /);
});
test('missing image key does not call provider; separate signer mismatches are reported only as false',()=>{
 for(const changedKey of ['',null]){
   const f=fixture();
   f.props.ANNALS_EDITORIAL_IMAGE_API_KEY=changedKey;
   const report=f.context.annalsCocktailEditorialCredentialPreflightInEditor();
   assert.equal(report.imageCredentialPresent,false);
   assert.equal(report.modelLookupAccepted,false);
   assert.equal(report.modelLookupStatus,'not_attempted');
   assert.equal(f.events.modelRequests||0,0);
 }
 for(const signer of ['ANNALS_PUBLISH_SIGNING_KEY','ANNALS_APPROVAL_KEY']){
   const f=fixture();
   f.props.ANNALS_EDITORIAL_PERMIT_SIGNING_KEY=f.props[signer];
   const report=f.context.annalsCocktailEditorialCredentialPreflightInEditor();
   assert.equal(report.permitSignerPresentAndDistinct,false);
   assert.equal(report.modelLookupAccepted,false);
   assert.equal(report.modelLookupStatus,'not_attempted');
   assert.equal(report.modelLookupStatus,'not_attempted');
   assert.equal(f.events.modelRequests||0,0);
   assert.deepEqual(f.log,[]);
 }
});
test('provider rejects/unavailable and unset owner flags remain non-spending false statuses',()=>{
 for(const thrown of [false,true]){
   const f=fixture({recovered:false});
   f.props.ANNALS_EDITORIAL_PROJECT_HARD_LIMIT_VERIFIED='false';
   f.events.modelResponseCode=401;
   f.events.rejectModelRequest=thrown;
   const report=f.context.annalsCocktailEditorialCredentialPreflightInEditor();
   assert.equal(report.recoveryFlagSet,false);
   assert.equal(report.projectHardLimitFlagSet,false);
   assert.equal(report.modelLookupAccepted,false);
   assert.equal(report.modelLookupStatus,'not_attempted');
   assert.equal(report.modelLookupStatus,'not_attempted');
   assert.equal(f.events.modelRequests||0,0);
   assert.equal(report.paidRequestMade,false);
   assert.equal(f.root.files.size,1);
   assert.equal(f.folder.files.size,2);
   assert.deepEqual(f.log,[]);
 }
});
test('after recorded recovery, provider 401 and transport failures remain non-billed false',()=>{
 for(const networkFail of [false,true]){
   const f=fixture({recovered:true});
   f.events.modelResponseCode=401;
   f.events.rejectModelRequest=networkFail;
   const report=f.context.annalsCocktailEditorialCredentialPreflightInEditor();
   assert.equal(report.modelLookupAccepted,false);
   assert.equal(report.modelLookupStatus,networkFail?'transport_failure':'authentication_or_models_read_denied');
   assert.equal(report.paidRequestMade,false);
   assert.equal(f.events.modelRequests,1);
   assert.equal(f.root.files.size,1);
   assert.equal(f.folder.files.size,2);
   assert.deepEqual(f.log,[]);
 }
});
test('bounded model metadata statuses distinguish failures without exposing provider bodies',()=>{
 const outcomes=[
   [200,'model_metadata_visible',true],
   [400,'other_http_failure',false],
   [401,'authentication_or_models_read_denied',false],
   [403,'access_forbidden',false],
   [404,'model_not_found_or_inaccessible',false],
   [429,'rate_or_quota_limited',false],
   [500,'provider_unavailable',false],
   [503,'provider_unavailable',false]
 ];
 for(const [http,status,visible] of outcomes){
   const f=fixture();
   f.events.modelResponseCode=http;
   const report=f.context.annalsCocktailEditorialCredentialPreflightInEditor();
   assert.equal(report.modelLookupStatus,status);
   assert.equal(report.modelLookupAccepted,visible);
   assert.equal(report.paidRequestMade,false);
   assert.equal(f.events.modelRequests,1);
   assert.equal(f.root.files.size,1);
   assert.equal(f.folder.files.size,2);
   assert.deepEqual(f.log,[]);
   assert.doesNotMatch(JSON.stringify(report),/Bearer|fictional-model-key|permit-key|publisher-key|example.invalid/i);
 }
});
test('model credential probe contains no source records, mutation or paid endpoints',()=>{
 const begin=moduleSource.indexOf('function annalsCocktailEditorialCredentialPreflightInEditor()');
 const end=moduleSource.indexOf('/** Owner-only private reservation;',begin);
 assert.ok(begin>0&&end>begin);
 const source=moduleSource.slice(begin,end);
 assert.match(source,/annalsOwner_\(\)/);
 assert.match(source,/method:'get'/);
 assert.match(source,/\/v1\/models\/gpt-image-2\.5-sunburst/);
 assert.doesNotMatch(source,/\/v1\/(?:images|chat\/completions)/);
 assert.doesNotMatch(source,/console\.|Logger\.|getContentText\(|(?:setProperty|deleteProperty|annalsSavePrivate_|annalsWriteOnce_)\(/);
});
