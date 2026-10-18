import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {photoReleaseAllowed} from '../scripts/annals/apply-approved-entry.mjs';
const code=readFileSync(new URL('../scripts/annals/GuardedRelease.gs',import.meta.url),'utf8');
const photos=readFileSync(new URL('../scripts/annals/PhotoProduction.gs',import.meta.url),'utf8');
function harness(){
 const values={ANNALS_PHOTOS_GUARDED_JPEG_ENABLED:'true',ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED:'true',ANNALS_AUTO_MEDIA_ENABLED:'true',ANNALS_PHOTOS_V2_ENABLED:'true',ANNALS_SIGNING_REMEDIATED_AT:'2026-10-18T01:00:00Z'};
 const c=vm.createContext({Date:class extends Date {static now(){return Date.parse('2026-10-18T05:00:00Z');}},annalsProps_:()=>({getProperty:k=>values[k]||null}),console:{log:()=>{}}});
 vm.runInContext(code,c);vm.runInContext(photos,c);return {c,values};
}
test('guarded JPEG production remains distinct from genuine acceptance and retains security and stop gates',()=>{
 const {c,values}=harness();assert.equal(c.annalsPhotosReady_(),true);assert.equal(values.ANNALS_PHOTOS_HOSTED_ACCEPTED,undefined);
 for(const key of ['ANNALS_PHOTOS_GUARDED_JPEG_ENABLED','ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED','ANNALS_SIGNING_REMEDIATED_AT','ANNALS_AUTO_MEDIA_ENABLED']){const before=values[key];delete values[key];assert.equal(c.annalsPhotosReady_(),false,key);values[key]=before;}
 c.Date.now=()=>Date.parse('2026-11-08T00:00:00Z');assert.equal(c.annalsPhotosReady_(),false);
});
test('guarded source format gate rejects HEIC, ambiguous mixtures, unsupported files and oversized sets before reading derivatives',()=>{
 const {c}=harness();const jpeg={accepted:true,mime:'image/jpeg',size:8000};
 for(const items of [[jpeg],[jpeg,jpeg,jpeg]])assert.equal(c.publishGuardedJpegOnly_({attachmentManifest:{items}}),true);
 for(const items of [[],[...Array(4)].map(()=>jpeg),[jpeg,{...jpeg,mime:'image/heic'}],[{...jpeg,mime:'image/png'}],[{...jpeg,accepted:false}],[{...jpeg,size:9000000}]]){
   const source={imageConsentAtReceipt:true,attachmentManifest:{items}};assert.equal(c.publishGuardedJpegOnly_(source),false);
   assert.equal(c.annalsPhotoSet_('a'.repeat(64),source,false).length,0);
 }
});
test('hosted guarded gate still requires signing qualification and stops at the unchanged AI expiry',()=>{
 const args={securityVerified:true,guardedJpegEnabled:true,now:new Date('2026-10-18T05:00:00Z')};
 assert.equal(photoReleaseAllowed(args),true);assert.equal(photoReleaseAllowed({...args,securityVerified:false}),false);
 assert.equal(photoReleaseAllowed({...args,now:new Date('2026-11-08T00:00:00Z')}),false);
 assert.equal(photoReleaseAllowed({...args,guardedJpegEnabled:false}),false);
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
