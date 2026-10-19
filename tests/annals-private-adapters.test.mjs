/* Offline private-adapter qualification. All records, images and keys are
 * fictional. No Google services, provider, signing remediation or dispatch I/O. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import Media from '../scripts/annals/MediaCore.js';
import Photos from '../scripts/annals/PhotoContracts.js';
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
  vm.runInContext(photoSource,c);const result=c.annalsReadPhotoPublicationGates('owner');assert.ok(Object.values(result).every(v=>v===false));assert.equal(read.length,7);
});
test('private runtime fixture stores only geometry/timing, never invokes services or repeats a reserved attempt',()=>{
  const files=new Map(),root={},encoded=[1,2,3],c=vm.createContext({
    Uint8Array:class{constructor(){return {};}},annalsUiCall_:(_,fn)=>fn(),annalsLocked_:fn=>fn(),annalsRoot_:()=>root,
    annalsRead_:(_,n)=>files.get(n)||null,annalsWriteOnce_:(_,n,v)=>{assert.equal(files.has(n),false);files.set(n,clone(v));},annalsSavePrivate_:(_,n,v)=>files.set(n,clone(v)),
    AnnalsJpegCodec:{encode:()=>({data:encoded})},AnnalsMedia:Media,
    AnnalsPhotoDerivative:{convert:()=>({bytes:encoded,width:1600,height:1200}),thumbnail:()=>({bytes:encoded,width:400,height:300})},
    UrlFetchApp:{fetch:()=>assert.fail('Runtime fixture made a network request')},GmailApp:{sendEmail:()=>assert.fail('Runtime fixture sent email')},
    annalsProps_:()=>assert.fail('Runtime fixture read configuration or keys')});
  // Avoid spending time generating millions of fake cells in this contract
  // fixture; real V8 timing is a separate once-only private deployed check.
  vm.runInContext(photoSource.replace('width=4032,height=3024','width=1,height=1'),c);
  const result=c.annalsQualifyPhotoCodec('owner');assert.equal(result.executed,true);assert.equal(result.record.state,'passed_fixture_only');assert.equal(result.record.results.length,3);
  assert.equal(result.record.genuinePhotoAccepted,false);assert.doesNotMatch(JSON.stringify(result),/base64|pixels|sender|signature/);
  assert.equal(c.annalsQualifyPhotoCodec('owner').executed,false);
  files.clear();files.set('photo-codec-fixture-v1-private.json',{state:'attempt_reserved'});assert.equal(c.annalsQualifyPhotoCodec('owner').executed,false);
});
test('editor-only fixture and flag helpers retain owner authentication and expose no remote private helper or signing state',()=>{
  const reads=[],c=vm.createContext({console:{log:()=>{}},annalsOwner_:()=>{},annalsProps_:()=>({getProperty:k=>{assert.doesNotMatch(k,/KEY|TOKEN|REMEDIAT/);reads.push(k);return null;}})});
  vm.runInContext(photoSource,c);const result=c.annalsReadPhotoGatesInEditor_();assert.ok(Object.values(result).every(v=>v===false));assert.equal(reads.length,12);
  c.annalsOwner_=()=>{throw Error('Wrong owner');};assert.throws(()=>c.annalsReadPhotoGatesInEditor_(),/owner/);assert.throws(()=>c.annalsQualifyPhotoCodecInEditor_(),/owner/);
  assert.equal(typeof c.annalsQualifyPhotoCodecInEditor,'undefined');assert.equal(typeof c.annalsReadPhotoGatesInEditor,'undefined');
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
test('qualified Drive previews of still HEIC HEIF PNG WebP enter the existing signed-JPEG gallery path',()=>{
  const codec=require('../scripts/annals/JpegCodec.js');
  const derivative=require('../scripts/annals/PhotoDerivative.js');
  const data=new Uint8Array(800*800*4);
  for(let i=3;i<data.length;i+=4)data[i]=255;
  const preview=codec.encode({width:800,height:800,data},75).data;
  const brands=(major,other)=>{
    const b=Buffer.alloc(24);b.writeUInt32BE(24);b.write('ftyp',4);
    b.write(major,8);b.write(other,16);b.write(major,20);return b;
  };
  const webp=Buffer.alloc(24);webp.write('RIFF');webp.writeUInt32LE(16,4);
  webp.write('WEBP',8);webp.write('VP8 ',12);webp.writeUInt32LE(4,16);
  const png=Buffer.alloc(57);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
  png.writeUInt32BE(13,8);png.write('IHDR',12);png.writeUInt32BE(800,16);
  png.writeUInt32BE(800,20);png.write('IDAT',37);png.write('IEND',49);
  const formats=[['image/heic',brands('heic','mif1')],['image/heif',brands('mif1','heic')],
    ['image/png',png],['image/webp',webp]];
  for(const [mime,raw] of formats){
    const files=new Map(),saved=[];
    const origin={getBlob:()=>({getBytes:()=>[...raw]}),
      getThumbnail:()=>({getContentType:()=> 'image/jpeg',getBytes:()=>[...preview]})};
    files.set('original',origin);
    const props={ANNALS_PHOTOS_GUARDED_JPEG_ENABLED:'true',
      ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED:'true',ANNALS_AUTO_MEDIA_ENABLED:'true',
      ANNALS_PHOTOS_V2_ENABLED:'true',ANNALS_SIGNING_REMEDIATED_AT:at};
    const c=vm.createContext({AnnalsMedia:Media,AnnalsPhotos:Photos,
      AnnalsJpegCodec:codec,AnnalsPhotoDerivative:derivative,
      annalsProps_:()=>({getProperty:k=>props[k]||null}),annalsImageConsentActive_:()=>true,
      annalsFolder_:()=>({createFile:blob=>{files.set(blob.name,blob);return blob;}}),
      annalsFile_:(_,name)=>files.get(name)||null,annalsRead_:()=>null,
      annalsPrivate_:v=>v,annalsHash_:v=>createHash('sha256').update(Buffer.from(v)).digest('hex'),
      annalsWriteOnce_:(_f,name,value)=>saved.push({name,value}),
      Utilities:{base64Encode:v=>Buffer.from(v).toString('base64'),
        newBlob:(bytes,type,name)=>({bytes,type,name})}});
    vm.runInContext(readFileSync(new URL('../scripts/annals/GuardedRelease.gs',import.meta.url),'utf8'),c);
    vm.runInContext(photoSource,c);
    const source={imageConsentAtReceipt:true,source:{sender:'fictional@example.test',receivedAt:at},
      attachmentManifest:{items:[{index:1,storageName:'original',mime,accepted:true,size:raw.length}]}};
    assert.equal(c.publishGuardedJpegOnly_(source),true,mime);
    const set=c.annalsPhotoSet_('a'.repeat(64),source,true);assert.equal(set.length,1,mime);
    const jpeg=Buffer.from(set[0].base64,'base64'),clean=Media.sanitize(jpeg,true);
    assert.equal(clean.width,800);assert.equal(clean.height,800);
    assert.deepEqual(clean.bytes,[...jpeg]);
    assert.equal(set[0].sha256,createHash('sha256').update(jpeg).digest('hex'));
    assert.deepEqual(saved.map(x=>x.name),['photos-v2-private.json']);
    assert.equal('base64' in saved[0].value[0],false);
  }
});
test('unsupported, animated, spoofed and malformed source containers cannot enter still-image preview conversion',()=>{
  const c=vm.createContext({});vm.runInContext(photoSource,c);
  const check=(mime,raw)=>{
    const item={mime,accepted:true,size:raw.length};
    return c.annalsStillPhotoSource_({getBlob:()=>({getBytes:()=>[...raw]})},item);
  };
  const png=Buffer.alloc(57);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
  png.writeUInt32BE(13,8);png.write('IHDR',12);png.writeUInt32BE(800,16);
  png.writeUInt32BE(800,20);png.write('IDAT',37);png.write('IEND',49);
  const control=Buffer.alloc(20);control.writeUInt32BE(8);control.write('acTL',4);
  const animatedPng=Buffer.concat([png.subarray(0,33),control,png.subarray(33)]);
  const animatedWebp=Buffer.alloc(30);animatedWebp.write('RIFF');
  animatedWebp.writeUInt32LE(animatedWebp.length-8,4);animatedWebp.write('WEBP',8);
  animatedWebp.write('VP8X',12);animatedWebp.writeUInt32LE(10,16);animatedWebp[20]=2;
  const sequence=Buffer.alloc(24);sequence.writeUInt32BE(24);sequence.write('ftyp',4);
  sequence.write('msf1',8);sequence.write('heic',16);sequence.write('msf1',20);
  assert.equal(check('image/png',animatedPng),false,'animated PNG');
  assert.equal(check('image/webp',animatedWebp),false,'animated WebP');
  assert.equal(check('image/heic',sequence),false,'HEIF sequence');
  assert.equal(check('image/heic',png),false,'wrong MIME');
  assert.equal(check('image/png',Buffer.from('<svg/>')),false);
  assert.equal(check('image/gif',Buffer.from('GIF89a')),false);
  assert.equal(check('image/png',png),true,'a normal still PNG remains eligible for preview');
  assert.equal(c.annalsStillPhotoSource_({getBlob:()=>({getBytes:()=>[...png]})},
    {mime:'image/png',size:png.length+1}),false,'source size mismatch');
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
test('the single pending rule is reconciled before the bounded historical folder walk can delay its lease',()=>{
  const c=vm.createContext({});vm.runInContext(readFileSync(new URL('../scripts/annals/Production.gs',import.meta.url),'utf8'),c);
  let visited=0;const pendingId='a'.repeat(64),reconciled=[],properties={};
  const folders={hasNext:()=>visited<1000,next:()=>({getName:()=>String(++visited).padStart(64,'0')}),getContinuationToken:()=> 'fictional-next-page'},root={getFolders:()=>folders};
  Object.assign(c,{annalsProps_:()=>({getProperty:()=>null,setProperty:(k,v)=>properties[k]=v,deleteProperty:()=>assert.fail('Cursor reset')}),
    annalsRoot_:()=>root,annalsPrivate_:x=>x,annalsRead_:(_,name)=>name==='col-release-pending-private.json'?{kind:'v3',state:'accepted',sourceId:pendingId}:null,
    annalsFile_:()=>null,annalsReconcileRuleRelease_:id=>reconciled.push(id)});
  assert.equal(c.annalsResumeConsentedDrafts_(2),0);assert.deepEqual(reconciled,[pendingId]);assert.equal(visited,12);assert.equal(properties.ANNALS_DRAFT_CURSOR,'fictional-next-page');
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
  const c=vm.createContext({AnnalsPhotos:Photos,AnnalsProduction:{publicEntry:clone,serial:JSON.stringify}});vm.runInContext(readFileSync(new URL('../scripts/annals/Production.gs',import.meta.url),'utf8'),c);
  Object.assign(c,{annalsUiCall_:(_,fn)=>fn(),annalsLocked_:fn=>fn(),annalsFolder_:()=> 'folder',annalsRead_:(_,name)=>files.get(name)||null,
    annalsFile_:(_,name)=>files.get(name)||null,annalsPrivateReceiptValid_:()=>true,annalsStandingGalleryCorrectionAllowed_:()=>true,annalsHash_:()=> 'fictional-hash',annalsWriteOnce_:(_,name,value)=>files.set(name,value)});
  const edited={id:old.id,title:'Fictional corrected caption',category:old.category},result=c.annalsSaveCorrection('owner','fictional',edited);
  assert.deepEqual(result.entry.photos,old.photos);assert.equal(result.entry.submittedAt,at);assert.equal(result.entry.eventPeriod,'');assert.match(result.entry.correction.note,/Text corrected/);
  files.delete('correction-review-private.json');const dateCorrection=c.annalsSaveCorrection('owner','fictional',{...edited,eventPeriod:'2026-09'});assert.equal(dateCorrection.entry.eventPeriod,'2026-09');assert.equal(dateCorrection.entry.submittedAt,at);
  files.delete('correction-review-private.json');const captionCorrection=c.annalsSaveCorrection('owner','fictional',{...old,photos:[{...old.photos[0],alt:'Corrected fictional description',caption:'Source-confirmed fictional caption'}]});assert.equal(captionCorrection.entry.photos[0].caption,'Source-confirmed fictional caption');assert.equal(captionCorrection.entry.photos[0].sha256,old.photos[0].sha256);
  files.delete('correction-review-private.json');assert.throws(()=>c.annalsSaveCorrection('owner','fictional',{...edited,photos:[{...old.photos[0],sha256:'b'.repeat(64)}]}),/replacement/);
  assert.throws(()=>c.annalsSaveCorrection('owner','fictional',old),/must change/);c.annalsStandingGalleryCorrectionAllowed_=()=>false;assert.throws(()=>c.annalsSaveCorrection('owner','fictional',edited),/rights/);
});
