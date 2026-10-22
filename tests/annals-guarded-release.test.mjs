import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {photoReleaseAllowed} from '../scripts/annals/apply-approved-entry.mjs';
const code=readFileSync(new URL('../scripts/annals/GuardedRelease.gs',import.meta.url),'utf8');
const photos=readFileSync(new URL('../scripts/annals/PhotoProduction.gs',import.meta.url),'utf8');
const production=readFileSync(new URL('../scripts/annals/Production.gs',import.meta.url),'utf8');
function harness(){
 const values={ANNALS_PHOTOS_GUARDED_JPEG_ENABLED:'true',ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED:'true',ANNALS_AUTO_MEDIA_ENABLED:'true',ANNALS_PHOTOS_V2_ENABLED:'true',ANNALS_SIGNING_REMEDIATED_AT:'2026-10-18T01:00:00Z'};
 const c=vm.createContext({Date:class extends Date {static now(){return Date.parse('2026-10-18T05:00:00Z');}},annalsProps_:()=>({getProperty:k=>values[k]||null}),console:{log:()=>{}}});
 vm.runInContext(code,c);vm.runInContext(photos,c);return {c,values};
}
test('guarded JPEG production remains distinct from genuine acceptance and retains consent/security gates without calendar expiry',()=>{
 const {c,values}=harness();assert.equal(c.annalsPhotosReady_(),true);assert.equal(values.ANNALS_PHOTOS_HOSTED_ACCEPTED,undefined);
 for(const key of ['ANNALS_PHOTOS_GUARDED_JPEG_ENABLED','ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED','ANNALS_SIGNING_REMEDIATED_AT','ANNALS_AUTO_MEDIA_ENABLED']){const before=values[key];delete values[key];assert.equal(c.annalsPhotosReady_(),false,key);values[key]=before;}
 c.Date.now=()=>Date.parse('2027-11-08T00:00:00Z');assert.equal(c.annalsPhotosReady_(),true);
});
test('guarded source gate accepts qualified still HEIC HEIF PNG WebP and mixed sets; unsafe types stay private',()=>{
 const {c}=harness();const jpeg={accepted:true,mime:'image/jpeg',size:8000};
 c.AnnalsPhotoDerivative={convert:()=>{throw Error('Do not decode in gate test');}};
 c.AnnalsJpegCodec={};
 for(const mime of ['image/jpeg','image/png','image/webp','image/heic','image/heif']){
   assert.equal(c.publishGuardedJpegOnly_({attachmentManifest:{items:[{...jpeg,mime}]}}),true,mime);
 }
 assert.equal(c.publishGuardedJpegOnly_({attachmentManifest:{items:[jpeg,
   {...jpeg,mime:'image/heic'},{...jpeg,mime:'image/png'}]}}),true);
 for(const items of [[],Array(4).fill(jpeg),[{...jpeg,mime:'image/gif'}],
    [{...jpeg,mime:'image/svg+xml'}],[{...jpeg,mime:'image/heic-sequence'}],
    [{...jpeg,mime:'image/png',accepted:false}],[{...jpeg,mime:'image/webp',size:9000000}],
    [jpeg,{...jpeg,mime:'video/quicktime'}]]){
   assert.equal(c.publishGuardedJpegOnly_({attachmentManifest:{items}}),false);
 }
 delete c.AnnalsPhotoDerivative;
 assert.equal(c.publishGuardedJpegOnly_({attachmentManifest:{items:[jpeg]}}),true);
 assert.equal(c.publishGuardedJpegOnly_({attachmentManifest:{items:[{...jpeg,mime:'image/heic'}]}}),false,
   'a partial private installation must never enable unchecked conversions');
});
test('hosted guarded gate still requires signing qualification without arbitrary AI expiry',()=>{
 const args={securityVerified:true,guardedJpegEnabled:true,now:new Date('2026-10-18T05:00:00Z')};
 assert.equal(photoReleaseAllowed(args),true);assert.equal(photoReleaseAllowed({...args,securityVerified:false}),false);
 assert.equal(photoReleaseAllowed({...args,now:new Date('2027-11-08T00:00:00Z')}),true);
 assert.equal(photoReleaseAllowed({...args,guardedJpegEnabled:false}),false);
});
test('installed guarded release permanently retires the legacy Drive-thumbnail fallback',()=>{
 const start=production.indexOf('function annalsAutoThumbnail_');
 const end=production.indexOf('function annalsPrepareDraft',start);
 const c=vm.createContext({annalsGuardedPhotosReady_:()=>false});
 vm.runInContext(production.slice(start,end),c);
 assert.equal(c.annalsAutoThumbnail_('a'.repeat(64),{}),null);
});
test('owner activation rejects incomplete, blocked, stale and future reconciliation without setting any switch',()=>{
 for(const audit of [null,{complete:false},{complete:true,blocked:1},{complete:true,completedAt:'bad'},{complete:true,completedAt:'2099-01-01T00:00:00Z'},{complete:true,completedAt:'2020-01-01T00:00:00Z'}]){
  let writes=0;const c=vm.createContext({annalsOwner_:()=>{},annalsLocked_:f=>f(),annalsRoot_:()=>({}),annalsProps_:()=>({setProperty:()=>writes++}),annalsRead_:()=>audit});
  vm.runInContext(code,c);c.annalsGuardedControls_=()=>({});assert.throws(()=>c.annalsGuardedEnableTextInEditor(),/reconciliation/);assert.equal(writes,0);
 }
});
test('private photo activation cannot set any genuine acceptance marker or alter CoL gates',()=>{
 const {c,values}=harness(),writes=[];c.annalsOwner_=()=>{};c.annalsLocked_=f=>f();c.annalsGuardedControls_=()=>({});c.annalsRoot_=()=>({});
 c.annalsRead_=(_,n)=>n==='photo-codec-fixture-v1-private.json'?{state:'passed_fixture_only'}:null;
 c.annalsWriteOnce_=()=>{};c.annalsGuardedLaunchReadbackCore_=()=>({});c.annalsProps_=()=>({getProperty:k=>k==='ANNALS_AUTO_PUBLICATION_ENABLED'?'true':values[k]||null,setProperty:(k,v)=>writes.push([k,v])});
 c.annalsGuardedEnableJpegInEditor();assert.equal(writes.length,4);assert.ok(writes.every(([k])=>!/HOSTED_ACCEPTED|RULES|HISTORY/.test(k)));
 c.annalsOwner_=()=>{throw Error('Wrong owner');};assert.throws(()=>c.annalsGuardedEnableJpegInEditor(),/owner/);
});

test('owner readback distinguishes installed token cutoff from fallback and never asserts trigger frequency or provider expiry',()=>{
  const values={ANNALS_GITHUB_TOKEN:'private-test-credential',ANNALS_ALLOWED_SENDERS:'six-members'};
  const c=vm.createContext({
    Date,annalsOwner_:()=>{},annalsProps_:()=>({getProperties:()=>({...values})}),
    annalsPublisherExpiry_:()=>Date.parse(values.ANNALS_GITHUB_TOKEN_EXPIRES_AT||'2026-11-09T00:00:00Z'),
    AnnalsPilot:{allowedSenders:()=>['a','b','c','d','e','f']},
    ScriptApp:{getProjectTriggers:()=>[{getHandlerFunction:()=> 'runAnnalsProductionIntake'}]},
    console:{log:()=>{}}
  });
  vm.runInContext(code,c);
  let result=c.annalsQuickProductionReadbackInEditor();
  assert.equal(result.publisherExpirySource,'source_fallback');
  assert.equal(result.publisherTokenExpiryVerifiedByProvider,false);
  assert.equal(result.intakeFiveMinuteMarkerPresent,false);
  assert.equal(result.intakeIntervalObservedByThisCheck,false);
  assert.equal(result.soleTriggerIsIntake,true);
  values.ANNALS_GITHUB_TOKEN_EXPIRES_AT='2027-01-20T00:00:00Z';
  values.ANNALS_INTAKE_CADENCE_MINUTES='5';
  result=c.annalsQuickProductionReadbackInEditor();
  assert.equal(result.publisherExpirySource,'installed_script_property');
  assert.equal(result.publisherCutoff,'2027-01-20T00:00:00.000Z');
  assert.equal(result.intakeFiveMinuteMarkerPresent,true);
  assert.equal(result.intakeIntervalObservedByThisCheck,false);
  assert.doesNotMatch(JSON.stringify(result),/private-test-credential|six-members/);
});
