/* Offline private-adapter qualification. All records, images and keys are
 * fictional. No Google services, provider, signing remediation or dispatch I/O. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import Media from '../scripts/annals/MediaCore.js';
import {photoReleaseAllowed} from '../scripts/annals/apply-approved-entry.mjs';
const at='2026-10-15T21:00:00Z';
const photoSource=readFileSync(new URL('../scripts/annals/PhotoProduction.gs',import.meta.url),'utf8');
const ruleSource=readFileSync(new URL('../scripts/annals/RulesProduction.gs',import.meta.url),'utf8');
const identities=Object.fromEntries(['fish','marc','matt','ken','jamie','jerome'].map(n=>[n+'@example.test',n]));
const clone=v=>JSON.parse(JSON.stringify(v));
function attestation(){
  const members=Object.fromEntries(Object.keys(identities).map(a=>[a,{status:'active',autoPublication:{status:'active'},imagePublication:{status:'active'},priorEvidence:'unchanged'}]));
  const registry={schemaVersion:1,members},writes=[];
  const c=vm.createContext({annalsUiCall_:(nonce,fn)=>{assert.equal(nonce,'fictional-owner-session');return fn();},annalsLocked_:fn=>fn(),
    annalsConsentRegistry_:()=>clone(registry),annalsRoot_:()=> 'root',annalsSavePrivate_:(f,n,v)=>{writes.push(clone(v));Object.assign(registry,clone(v));}});
  vm.runInContext(photoSource,c);c.annalsSpeakerIdentities_=()=>identities;
  return {c,registry,writes};
}
test('private standing attestation records owner authority once without rewriting prior permissions',()=>{
  const {c,registry,writes}=attestation(),before=clone(registry),note='Fictional qualification of the authorised owner decision.';
  assert.equal(c.annalsRecordSixMemberPhotoAttestation('fictional-owner-session',note).activated,false);
  for(const address of Object.keys(identities)){const m=registry.members[address];assert.equal(m.photoSubjects.authority,'owner_attestation_2026_10_15');assert.equal(m.photoSubjects.evidence,note);delete m.photoSubjects;assert.deepEqual(m,before.members[address]);}
  assert.equal(writes.length,1);
});
test('standing attestation preserves individual revocations and rejects unauthorised callers without a write',()=>{
  for(const field of ['imagePublication','photoSubjects']){const {c,registry,writes}=attestation();registry.members['marc@example.test'][field]={status:'revoked',revokedAt:at};
    assert.throws(()=>c.annalsRecordSixMemberPhotoAttestation('fictional-owner-session','Fictional existing owner authority.'),/revocation/);assert.equal(writes.length,0);}
  const {c,writes}=attestation();assert.throws(()=>c.annalsRecordSixMemberPhotoAttestation('wrong-session','Fictional existing owner authority.'));assert.equal(writes.length,0);
});
test('an existing standing attestation keeps its exact provenance on another owner call',()=>{
  const {c,registry}=attestation();c.annalsRecordSixMemberPhotoAttestation('fictional-owner-session','First fictional attestation evidence.');const original=clone(registry);
  c.annalsRecordSixMemberPhotoAttestation('fictional-owner-session','Later fictional attestation evidence.');assert.deepEqual(registry,original);
});
test('new photo and rule gates are closed with missing acceptance or remediation evidence',()=>{
  let values={},writes=0;const c=vm.createContext({annalsProps_:()=>({getProperty:k=>values[k]||null,setProperty:()=>writes++})});
  vm.runInContext(photoSource,c);vm.runInContext(ruleSource,c);
  assert.equal(c.annalsPhotosReady_(),false);assert.equal(c.annalsRulesReady_(),false);
  values={ANNALS_AUTO_MEDIA_ENABLED:'true',ANNALS_PHOTOS_V2_ENABLED:'true',ANNALS_RULES_V2_ENABLED:'true',ANNALS_RULES_ACCEPT_FROM:at};
  assert.equal(c.annalsPhotosReady_(),false);assert.equal(c.annalsRulesReady_(),false);assert.equal(writes,0);
});
test('private controlled acceptance requires security evidence, exact source and short expiry while broad gates stay off',()=>{
  const id='a'.repeat(64),values={ANNALS_PHOTOS_ACCEPTANCE_SOURCE_ID:id,ANNALS_PHOTOS_ACCEPTANCE_UNTIL:'2026-10-15T22:00:00Z'};
  const c=vm.createContext({Date:class extends Date{static now(){return Date.parse(at);}},annalsProps_:()=>({getProperty:k=>values[k]||null})});vm.runInContext(photoSource,c);
  assert.equal(c.annalsPhotosReady_(id),false);values.ANNALS_SIGNING_REMEDIATED_AT=at;
  assert.equal(c.annalsPhotosReady_(id),true);assert.equal(c.annalsPhotosReady_('b'.repeat(64)),false);assert.equal(c.annalsPhotosReady_(),false);
  for(const until of [at,'2026-10-17T21:00:00Z','invalid']){values.ANNALS_PHOTOS_ACCEPTANCE_UNTIL=until;assert.equal(c.annalsPhotosReady_(id),false);}
});
test('hosted controlled photo acceptance cannot widen to other entries or bypass final security',()=>{
  const entryId='annal-'+'a'.repeat(24),args={entryId,photosEnabled:false,securityVerified:true,acceptanceEntryId:entryId,acceptanceUntil:'2026-10-15T22:00:00Z',now:new Date(at)};
  assert.equal(photoReleaseAllowed(args),true);
  for(const change of [{entryId:'annal-'+'b'.repeat(24)},{securityVerified:false},{acceptanceUntil:at},{acceptanceUntil:'2026-10-17T21:00:00Z'},{acceptanceEntryId:'*'}])assert.equal(photoReleaseAllowed({...args,...change}),false);
  assert.equal(photoReleaseAllowed({...args,photosEnabled:true,securityVerified:false}),false);
});
test('private gate inspection exposes booleans only and does not inspect any signing value or write state',()=>{
  const read=[],c=vm.createContext({annalsUiCall_:(n,fn)=>{assert.equal(n,'owner');return fn();},annalsProps_:()=>({getProperty:k=>{assert.doesNotMatch(k,/KEY|TOKEN|REMEDIAT/);read.push(k);return null;},setProperty:()=>assert.fail('Read-only gate inspection wrote state')})});
  vm.runInContext(photoSource,c);const result=c.annalsReadPhotoPublicationGates('owner');assert.ok(Object.values(result).every(v=>v===false));assert.equal(read.length,6);
});
test('combined gallery overflow retains all derivatives privately and saves no public-ready manifest',()=>{
  const source={imageConsentAtReceipt:true,source:{sender:'fictional@example.test',receivedAt:at},attachmentManifest:{items:[1,2,3].map(index=>({index,storageName:String(index),mime:'image/jpeg',accepted:true,size:12000}))}},saved=[];
  const c=vm.createContext({AnnalsMedia:{sanitize:b=>({bytes:b,width:200,height:200})},annalsImageConsentActive_:()=>true,
    annalsFolder_:()=>({createFile:b=>b}),annalsRead_:()=>null,annalsFile_:(_,name)=>/^\d$/.test(name)?{getThumbnail:()=>({getBytes:()=>Array(12000).fill(Number(name))})}:null,
    annalsHash_:b=>createHash('sha256').update(Buffer.from(b)).digest('hex'),annalsPrivate_:v=>v,Utilities:{base64Encode:b=>Buffer.from(b).toString('base64'),newBlob:(bytes,mime,name)=>({bytes,mime,name})},annalsWriteOnce_:(...args)=>saved.push(args)});
  vm.runInContext(photoSource,c);c.annalsPhotosReady_=()=>true;assert.equal(c.annalsPhotoSet_('fictional',source,true).length,0);assert.equal(saved.length,0);
});
test('private derivative adapter strips metadata, deduplicates and holds failed conversion without publication',()=>{
  const jpeg=Buffer.from(readFileSync(new URL('./annals-safe-media.test.mjs',import.meta.url),'utf8').match(/const photo=\(\)=>Buffer.from\('([^']+)'/)[1],'base64');
  const files=new Map(),saved=[],source={imageConsentAtReceipt:true,source:{sender:'fictional@example.test',receivedAt:at},attachmentManifest:{items:[0,1,2].map(index=>({index,storageName:'original-'+index,mime:index===2?'image/heic':'image/jpeg',accepted:true,size:jpeg.length}))}};
  for(let i=0;i<3;i++)files.set('original-'+i,{getThumbnail:()=>i===2?null:{getBytes:()=>jpeg}});
  const c=vm.createContext({AnnalsMedia:Media,annalsFolder_:()=>({createFile:blob=>{files.set(blob.name,{getBlob:()=>({getBytes:()=>blob.bytes})});return blob;}}),annalsRead_:()=>null,
    annalsFile_:(_,n)=>files.get(n)||null,annalsHash_:b=>createHash('sha256').update(Buffer.from(b)).digest('hex'),annalsPrivate_:v=>v,
    Utilities:{base64Encode:b=>Buffer.from(b).toString('base64'),newBlob:(bytes,mime,name)=>({bytes,mime,name})},annalsImageConsentActive_:()=>true,
    annalsWriteOnce_:(_,name,value)=>saved.push({name,value})});
  vm.runInContext(photoSource,c);c.annalsPhotosReady_=()=>true;
  const set=c.annalsPhotoSet_('fictional',source,true);assert.equal(set.length,1);assert.equal(saved.length,1);assert.match(set[0].name,/^screened-[a-f0-9]{64}\.jpg$/);
  assert.ok(Buffer.from(set[0].base64,'base64').length<jpeg.length);assert.equal('base64' in saved[0].value[0],false);
  c.annalsImageConsentActive_=()=>false;assert.equal(c.annalsPhotoSet_('fictional',source,true).length,0);
});
function ruleHarness(){
  const root='root',folder='source',files=new Map(),sent=[],dispatches=[];
  const get=(f,n)=>files.get(f+'/'+n)||null,put=(f,n,v)=>files.set(f+'/'+n,clone(v));
  const c=vm.createContext({Date:class extends Date{constructor(...args){super(...(args.length?args:[at]));}static now(){return Date.parse(at);}},
    annalsRoot_:()=>root,annalsFolder_:()=>folder,annalsRead_:get,annalsFile_:get,annalsSavePrivate_:put,
    annalsWriteOnce_:(f,n,v)=>{assert.equal(get(f,n),null);put(f,n,v);},annalsHash_:s=>createHash('sha256').update(String(s)).digest('hex'),
    GmailApp:{sendEmail:(...args)=>sent.push(args)},UrlFetchApp:{fetch:()=>{throw Error('Unexpected network in fixture');}},
    annalsDispatchEvent_:(...args)=>{dispatches.push(args);return true;}});
  vm.runInContext(ruleSource,c);return {c,files,sent,dispatches,get,put,root,folder};
}
test('transactional notices reserve once and never resend an unknown email outcome',()=>{
  const h=ruleHarness();h.c.GmailApp.sendEmail=()=>{h.sent.push('attempt');throw Error('Fictional interruption');};
  assert.equal(h.c.annalsRuleNotice_(h.folder,'fictional@example.test','outcome','Fictional body'),false);
  assert.equal(h.c.annalsRuleNotice_(h.folder,'fictional@example.test','outcome','Fictional body'),false);
  assert.equal(h.sent.length,1);assert.equal(h.get(h.folder,'rules-outcome-notice-private.json').state,'unknown_no_retry');
});
test('scheduled due-time adapter queues engineering exactly once and never activates or dispatches',()=>{
  const h=ruleHarness();h.put(h.folder,'source-private.json',{source:{sender:'fictional@example.test'}});
  h.put(h.folder,'col-rule-request-private.json',{id:'col-fictional',state:'scheduled',effectiveAt:'2026-10-16T00:00:00Z'});
  assert.equal(h.c.annalsScheduledRuleCheck_('fictional'),false);
  h.put(h.folder,'col-rule-request-private.json',{id:'col-fictional',state:'scheduled',effectiveAt:at});
  assert.equal(h.c.annalsScheduledRuleCheck_('fictional'),true);assert.equal(h.get(h.folder,'col-rule-request-private.json').state,'awaiting_implementation');
  assert.equal(h.c.annalsScheduledRuleCheck_('fictional'),false);assert.equal(h.sent.length,1);assert.equal(h.dispatches.length,0);
});
test('private release reconciliation preserves pending state on hosted failure and emits no success notice',()=>{
  const h=ruleHarness();h.put(h.root,'col-release-pending-private.json',{state:'accepted',sourceId:'fictional',at,expectedFiles:{'celebration.html':'a'.repeat(64)}});
  h.c.UrlFetchApp.fetch=()=>({getResponseCode:()=>503,getContentText:()=> 'unavailable'});
  assert.equal(h.c.annalsReconcileRuleRelease_('fictional'),false);assert.equal(h.get(h.root,'col-release-pending-private.json').state,'accepted');assert.equal(h.sent.length,0);assert.equal(h.dispatches.length,0);
});
test('matching hosted pending-status bytes report only pending, with no adoption or repeat notice',()=>{
  const h=ruleHarness(),body='fictional verified public bytes',hash=h.c.annalsHash_(body);
  h.put(h.root,'col-release-pending-private.json',{state:'accepted',kind:'status',sourceId:'fictional',revisionId:'col-fictional',at,expectedFiles:{'col-revisions.html':hash}});
  h.put(h.folder,'source-private.json',{source:{sender:'fictional@example.test'}});h.put(h.folder,'col-rule-request-private.json',{id:'col-fictional',state:'awaiting_implementation',effectiveAt:null});
  h.c.UrlFetchApp.fetch=()=>({getResponseCode:()=>200,getContentText:()=>body});
  assert.equal(h.c.annalsReconcileRuleRelease_('fictional'),true);assert.equal(h.get(h.folder,'col-rule-request-private.json').state,'awaiting_implementation');
  assert.match(h.sent[0][2],/previous operative rules remain in force/);assert.equal(h.c.annalsReconcileRuleRelease_('fictional'),false);assert.equal(h.sent.length,1);assert.equal(h.dispatches.length,0);
});
test('private text correction preserves the canonical gallery and dates, marks correction and refuses replacements or revocation',()=>{
  const old={id:'annal-fictional',title:'Fictional original caption',category:'assembly',photos:[{sha256:'a'.repeat(64),width:200,height:200,alt:'Fictional object'}],submittedAt:at,eventPeriod:''};
  const source={senderAuthenticated:true,imageConsentAtReceipt:true,source:{sender:'fictional@example.test',receivedAt:at}},files=new Map([['approval-private.json',{entry:old,receipt:{},publicationState:'dispatch_accepted'}],['source-private.json',source]]);
  const c=vm.createContext({AnnalsProduction:{publicEntry:clone,serial:JSON.stringify}});vm.runInContext(readFileSync(new URL('../scripts/annals/Production.gs',import.meta.url),'utf8'),c);
  Object.assign(c,{annalsUiCall_:(_,fn)=>fn(),annalsLocked_:fn=>fn(),annalsFolder_:()=> 'folder',annalsRead_:(_,name)=>files.get(name)||null,
    annalsFile_:(_,name)=>files.get(name)||null,annalsPrivateReceiptValid_:()=>true,annalsStandingGalleryCorrectionAllowed_:()=>true,annalsHash_:()=> 'fictional-hash',annalsWriteOnce_:(_,name,value)=>files.set(name,value)});
  const edited={id:old.id,title:'Fictional corrected caption',category:old.category},result=c.annalsSaveCorrection('owner','fictional',edited);
  assert.deepEqual(result.entry.photos,old.photos);assert.equal(result.entry.submittedAt,at);assert.equal(result.entry.eventPeriod,'');assert.match(result.entry.correction.note,/Text corrected/);
  files.delete('correction-review-private.json');const dateCorrection=c.annalsSaveCorrection('owner','fictional',{...edited,eventPeriod:'2026-09'});assert.equal(dateCorrection.entry.eventPeriod,'2026-09');assert.equal(dateCorrection.entry.submittedAt,at);
  files.delete('correction-review-private.json');assert.throws(()=>c.annalsSaveCorrection('owner','fictional',{...edited,photos:[{...old.photos[0],sha256:'b'.repeat(64)}]}),/replacement/);
  assert.throws(()=>c.annalsSaveCorrection('owner','fictional',old),/must change/);c.annalsStandingGalleryCorrectionAllowed_=()=>false;assert.throws(()=>c.annalsSaveCorrection('owner','fictional',edited),/rights/);
});
