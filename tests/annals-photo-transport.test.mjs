/* Fictional structural/transport fixtures only, NOT image quality, real phone
 * decoding, consent or production acceptance evidence. No real network calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash,createHmac} from 'node:crypto';
import Media from '../scripts/annals/MediaCore.js';
import Photos from '../scripts/annals/PhotoContracts.js';
import {fetchPhotoBlob,gitBlobHash,resolvePhotoBlobs,verifyPhotoBlob} from '../scripts/annals/PhotoTransport.mjs';
import {applyApprovedEntry} from '../scripts/annals/apply-approved-entry.mjs';
import {contentDigest} from '../scripts/annals/ApprovedRenderer.mjs';
import {photoIndex} from '../scripts/annals/PhotoIndex.mjs';
import Codec from '../scripts/annals/JpegCodec.js';
import Derivative from '../scripts/annals/PhotoDerivative.js';

const key='fictional-photo-transport-test-key-not-a-production-secret',at='2026-10-15T21:00:00Z';
const hash=b=>createHash('sha256').update(b).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const serial=v=>JSON.stringify(canonical(v));
const raw=Buffer.from(readFileSync(new URL('./annals-safe-media.test.mjs',import.meta.url),'utf8').match(/const photo=\(\)=>Buffer.from\('([^']+)'/)[1],'base64');
function structuralImage(size=60000,seed=1){
  const b=Buffer.from(Media.sanitize(raw).bytes),frame=b.indexOf(Buffer.from([255,192]));
  b.writeUInt16BE(800,frame+5);b.writeUInt16BE(1200,frame+7);
  return Buffer.concat([b.subarray(0,-2),Buffer.alloc(size-b.length,seed),b.subarray(-2)]);
}
function decodedFixture(seed){
  const data=new Uint8Array(1200*800*4);let s=seed;
  for(let y=0;y<800;y+=8)for(let x=0;x<1200;x+=8){
    s=(1664525*s+1013904223)>>>0;
    for(let dy=0;dy<8;dy++)for(let dx=0;dx<8;dx++){
      const p=((y+dy)*1200+x+dx)*4;data[p]=s>>>24;data[p+1]=(s>>>16)&255;data[p+2]=(s>>>8)&255;data[p+3]=255;
    }
  }
  return Buffer.from(Media.sanitize(Codec.encode({data,width:1200,height:800},75).data,true).bytes);
}
const images=[1,2,3].map(decodedFixture);
const photos=images.map(b=>({sha256:hash(b),width:1200,height:800,alt:'Fictional structural transport fixture'}));
const refs=images.map(b=>({sha256:hash(b),gitSha:gitBlobHash(b),size:b.length}));
const entry={id:'annal-'+'a'.repeat(24),category:'assembly',title:'Fictional transport fixture',summary:'Local structural test only.',year:2026,dateLabel:'',sortDate:'',quoteVerbatim:'',recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]},credit:'anonymous',photos,submittedAt:at,eventPeriod:''};
function sign(e,mode=Photos.MODE,approvedAt=at){
  const proof={entryId:e.id,approvedAt,consents:{publication:true,quotePublication:false,recipeVerified:false,namedAttribution:false,photoPublication:true},contentSha256:contentDigest(e),...(mode?{mode}:{})};
  return {...proof,signature:createHmac('sha256',key).update(serial({entry:e,approval:proof})).digest('hex')};
}
const event={action:'annals-auto-entry',client_payload:{entry,approval:sign(entry),imageBlobs:refs}};
const args=()=>({event,data:{schemaVersion:1,entries:[],approvals:[]},secret:key,now:new Date(at),photosEnabled:true,blobTransportEnabled:true,fetchBlob:async r=>images[refs.findIndex(x=>x.gitSha===r.gitSha)]});

test('three 512 KiB derivatives fit a reference dispatch below 60,000 bytes without an inline limit increase',async()=>{
  const structural=[1,2,3].map(i=>structuralImage(Photos.MAX_BYTES,i));
  assert.equal(structural.reduce((n,b)=>n+b.length,0),1572864);
  for(const b of structural)assert.equal(verifyPhotoBlob({sha256:hash(b),width:1200,height:800},
    {gitSha:gitBlobHash(b),size:b.length},b).length,524288);
  assert.ok(Buffer.byteLength(JSON.stringify({event_type:event.action,client_payload:event.client_payload}))<3000);
  // Publication fixtures are actual encoded synthetic JPEGs so thumbnail
  // decoding is tested; exact maximum-byte fixtures above test only transport.
  const result=await applyApprovedEntry(args());assert.equal(result.assetsToWrite.length,6);
  assert.equal(result.assetsToWrite.filter(a=>!a.path.includes('-thumb')).reduce((n,a)=>n+a.bytes.length,0),images.reduce((n,b)=>n+b.length,0));
  assert.throws(()=>Media.sanitize(images[0]),/dimensions|small/);
  assert.throws(()=>Media.sanitize(structuralImage(524289),true),/small/);
});

test('reference contract rejects URLs, excess images, reordered digests, invalid sizes and undersized derivatives',()=>{
  for(const change of [{size:524289},{size:0},{gitSha:'../private'},{url:'https://private.invalid/'}])assert.throws(()=>Photos.blobRefs(photos,[{...refs[0],...change},...refs.slice(1)]));
  assert.throws(()=>Photos.blobRefs(photos,[refs[1],refs[0],refs[2]]));
  assert.throws(()=>Photos.blobRefs([...photos,photos[0]],[...refs,refs[0]]));
  assert.throws(()=>Photos.blobRefs([{...photos[0],width:799,height:799}],[refs[0]]));
});

test('disabled, forged, expired, replayed and retired releases perform zero blob reads',async()=>{
  for(const change of [{photosEnabled:false},{blobTransportEnabled:false},{secret:'wrong'},
    {now:new Date('2026-10-17T21:00:00Z')},
    {data:{schemaVersion:1,entries:[entry],approvals:[sign(entry)]}},
    {data:{schemaVersion:1,entries:[],approvals:[],retiredIds:[entry.id]}}]){
    let reads=0;await assert.rejects(applyApprovedEntry({...args(),...change,fetchBlob:async()=>{reads++;return images[0];}}));assert.equal(reads,0);
  }
});

test('blob fetch uses a fixed public repository, forbids redirects and streams under the exact declaration',async()=>{
  const b=images[0];let calls=0;
  const result=await fetchPhotoBlob(refs[0],{fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,'https://api.github.com/repos/justinpfisher/Stammtisch/git/blobs/'+refs[0].gitSha);
    assert.equal(options.redirect,'error');assert.equal('Authorization' in options.headers,false);
    return new Response(b,{status:200,headers:{'content-length':String(b.length)}});
  }});assert.ok(result.equals(b));assert.equal(calls,1);
  for(const response of [new Response(b,{status:404}),new Response(b,{headers:{'content-length':'524289'}}),new Response(b.subarray(1)),new Response(Buffer.concat([b,Buffer.from([1])]))]){
    let calls=0;await assert.rejects(fetchPhotoBlob(refs[0],{fetchImpl:async()=>{calls++;return response;}}));assert.equal(calls,1);
  }
});

test('signed digest, Git blob hash, byte count, dimensions and metadata must all match',async()=>{
  for(const ref of [{...refs[0],gitSha:'f'.repeat(40)},{...refs[0],size:1},{...refs[0],sha256:'b'.repeat(64)}]){
    if(ref.sha256!==refs[0].sha256)assert.throws(()=>Photos.blobRefs([photos[0]],[ref]));
    else assert.throws(()=>verifyPhotoBlob(photos[0],ref,images[0]));
  }
  assert.throws(()=>verifyPhotoBlob({...photos[0],width:800},refs[0],images[0]));
  const withApp=Buffer.concat([images[0].subarray(0,2),Buffer.from([255,225,0,4,1,2]),images[0].subarray(2)]);
  const p={...photos[0],sha256:hash(withApp)},r={sha256:p.sha256,gitSha:gitBlobHash(withApp),size:withApp.length};
  assert.throws(()=>verifyPhotoBlob(p,r,withApp),/metadata/);
  let calls=0;await assert.rejects(resolvePhotoBlobs(photos,refs,async()=>{calls++;throw Error('Unknown response');}));assert.equal(calls,1);
});

test('caption/date correction keeps exact assets and timestamp; replacement is held before fetching',async()=>{
  const corrected={...entry,title:'Fictional corrected caption',eventPeriod:'2026-09',correction:{at:'2026-10-15T22:00:00Z',note:'Fictional date correction.'}};
  const options={...args(),now:new Date('2026-10-15T22:00:00Z'),data:{schemaVersion:1,entries:[entry],approvals:[sign(entry)]},
    event:{action:'annals-correct-entry',client_payload:{entry:corrected,approval:sign(corrected,null,'2026-10-15T22:00:00Z'),imageBlobs:refs}}};
  const result=await applyApprovedEntry(options);assert.equal(result.data.entries[0].submittedAt,at);assert.equal(result.assetsToDelete.length,0);
  const replacement={...corrected,photos:photos.slice(0,1)};let calls=0;
  await assert.rejects(applyApprovedEntry({...options,event:{action:'annals-correct-entry',client_payload:{entry:replacement,approval:sign(replacement,null,'2026-10-15T22:00:00Z'),imageBlobs:refs.slice(0,1)}},fetchBlob:async()=>{calls++;}}),/replacement/);assert.equal(calls,0);
});

function uploadHarness(){
  const values={ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED:'true',ANNALS_GITHUB_REPOSITORY:'justinpfisher/Stammtisch',ANNALS_GITHUB_TOKEN:'fictional-token',ANNALS_PUBLISH_SIGNING_KEY:key};
  const files=new Map(),folder={getName:()=> 'a'.repeat(64)},approval=sign(entry),source={senderAuthenticated:true,imageConsentAtReceipt:true,source:{sender:'fictional@example.test',receivedAt:at}};
  files.set('source-private.json',source);files.set('approval-private.json',{entry,receipt:{},publication:approval});
  let requests=0,permitted=true,ready=true;
  const c=vm.createContext({Date:class extends Date{constructor(...a){super(...(a.length?a:[at]));}static now(){return Date.parse(at);}},
    AnnalsPhotos:Photos,AnnalsMedia:Media,AnnalsProduction:{serial},AnnalsPhotoDerivative:Derivative,AnnalsJpegCodec:Codec,
    annalsProps_:()=>({getProperty:k=>values[k]||null}),annalsRead_:(_,n)=>files.get(n)||null,
    annalsFile_:(_,n)=>files.has(n)?{setContent:t=>files.set(n,JSON.parse(t))}:null,
    annalsWriteOnce_:(_,n,v)=>{assert.equal(files.has(n),false);files.set(n,structuredClone(v));},
    annalsPrivateReceiptValid_:()=>true,annalsPublicApproval_:()=>approval,annalsOrdinarySourceGate_:()=>{},annalsHash_:b=>hash(Buffer.from(b)),
    annalsHex_:b=>Buffer.from(b).toString('hex'),Utilities:{base64Decode:s=>Array.from(Buffer.from(s,'base64')),
      newBlob:s=>({getBytes:()=>Array.from(Buffer.from(s))}),DigestAlgorithm:{SHA_1:'sha1'},computeDigest:(a,b)=>Array.from(createHash(a).update(Buffer.from(b)).digest())},
    UrlFetchApp:{fetch:(_,options)=>{assert.ok(files.has('photo-upload-private.json'),'reserve before upload');requests++;
      const b=Buffer.from(JSON.parse(options.payload).content,'base64');assert.ok(b.length<=524288);
      return {getResponseCode:()=>201,getContentText:()=>JSON.stringify({sha:gitBlobHash(b)})};}}});
  vm.runInContext(readFileSync(new URL('../scripts/annals/PhotoProduction.gs',import.meta.url),'utf8'),c);
  c.annalsPhotosReady_=()=>ready;c.annalsStandingGalleryCorrectionAllowed_=()=>permitted;
  c.annalsPhotoSet_=()=>images.map((b,i)=>({...photos[i],base64:b.toString('base64')}));
  return {c,values,files,run:()=>c.annalsPhotoBlobRefs_(folder,entry,approval,'annals-auto-entry'),requests:()=>requests,revoke:()=>{permitted=false;},close:()=>{ready=false;}};
}

test('private uploader reserves before network, stages only approved derivatives and never repeats uploads',()=>{
  const h=uploadHarness();assert.equal(h.run().length,3);assert.equal(h.requests(),3);assert.equal(h.files.get('photo-upload-private.json').state,'uploaded');
  assert.equal(h.run(),null);assert.equal(h.requests(),3);
});

test('private disabled/security/source gate, revocation, missing exact receipt and quarantines produce no uploads',()=>{
  for(const alter of [h=>delete h.values.ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED,h=>h.close(),h=>h.revoke(),h=>h.files.delete('approval-private.json'),
    h=>h.files.set('quarantine-private.json',{}),h=>h.files.set('removal-private.json',{}),h=>h.c.annalsPrivateReceiptValid_=()=>false,
    h=>h.values.ANNALS_GITHUB_REPOSITORY='other/repository']){
    const h=uploadHarness();alter(h);assert.equal(h.run(),null);assert.equal(h.requests(),0);
  }
});

test('unknown, rejected and malformed upload results are permanently held without retry',()=>{
  for(const result of ['unknown','rejected','malformed']){
    const h=uploadHarness();let requests=0;h.c.UrlFetchApp.fetch=()=>{requests++;if(result==='unknown')throw Error('Timeout');
      return {getResponseCode:()=>result==='rejected'?403:201,getContentText:()=>'{malformed'};};
    assert.equal(h.run(),null);assert.match(h.files.get('photo-upload-private.json').state,/no_retry/);
    assert.equal(h.run(),null);assert.equal(requests,1);
  }
});

test('revocation after first upload stops remaining public writes and retains the partial journal',()=>{
  const h=uploadHarness(),fetch=h.c.UrlFetchApp.fetch;
  h.c.UrlFetchApp.fetch=(...a)=>{const r=fetch(...a);h.revoke();return r;};
  assert.equal(h.run(),null);assert.equal(h.requests(),1);assert.equal(h.files.get('photo-upload-private.json').completed,1);
  assert.match(h.files.get('photo-upload-private.json').state,/no_retry/);assert.equal(h.run(),null);
});

test('a known thumbnail or decoder failure is held before any public blob is uploaded',()=>{
  const h=uploadHarness();h.c.AnnalsPhotoDerivative={thumbnail:()=>{throw Error('Fictional codec refusal');}};
  assert.throws(()=>h.run(),/codec refusal/);assert.equal(h.requests(),0);assert.equal(h.files.has('photo-upload-private.json'),false);
});

test('private final reconciliation needs exact hosted gallery bytes and canonical index shard',()=>{
  const index=photoIndex([entry]),bodies=new Map(images.map((b,i)=>['assets/annals/'+photos[i].sha256+'.jpg',b]));
  images.forEach((b,i)=>bodies.set('assets/annals/'+photos[i].sha256+'-thumb.jpg',Buffer.from(Derivative.thumbnail(b,Codec,Media).bytes)));
  bodies.set('data/photos/index.json',JSON.stringify(index.manifest));
  bodies.set(index.pages[0].path,JSON.stringify(index.pages[0].data)+'\n');let reads=0;
  const c=vm.createContext({AnnalsPhotos:Photos,AnnalsMedia:Media,AnnalsJpegCodec:Codec,AnnalsPhotoDerivative:Derivative,annalsHash_:b=>hash(typeof b==='string'?b:Buffer.from(b)),
    UrlFetchApp:{fetch:url=>{reads++;const path=url.replace('https://stammtischbrewery.com/','').split('?')[0];assert.ok(bodies.has(path));
      return {getResponseCode:()=>200,getBlob:()=>({getBytes:()=>Array.from(bodies.get(path))}),getContentText:()=>bodies.get(path)};}}});
  vm.runInContext(readFileSync(new URL('../scripts/annals/PhotoProduction.gs',import.meta.url),'utf8'),c);
  assert.equal(c.annalsVerifyPhotoAssets_(entry,{entries:[entry]},'?fictional'),true);assert.equal(reads,8);
  bodies.set(index.pages[0].path,'[]\n');assert.equal(c.annalsVerifyPhotoAssets_(entry,{entries:[entry]},'?fictional'),false);
  bodies.set(index.pages[0].path,JSON.stringify(index.pages[0].data)+'\n');bodies.set('assets/annals/'+photos[0].sha256+'.jpg',images[1]);
  assert.equal(c.annalsVerifyPhotoAssets_(entry,{entries:[entry]},'?fictional'),false);
});

test('large JPEG conversion failure never falls back to a Drive thumbnail or saves a ready manifest',()=>{
  let thumbnails=0,writes=0;const records=new Map();
  const source={imageConsentAtReceipt:true,source:{sender:'fictional@example.test',receivedAt:at},attachmentManifest:{items:[{index:0,storageName:'original',mime:'image/jpeg',accepted:true,size:100000}]}};
  const c=vm.createContext({AnnalsPhotos:Photos,AnnalsMedia:Media,annalsProps_:()=>({getProperty:()=> 'true'}),annalsImageConsentActive_:()=>true,
    annalsFolder_:()=>({}),annalsRead_:(_,name)=>records.get(name)||null,annalsFile_:(_,name)=>({getThumbnail:()=>{thumbnails++;return null;},setContent:s=>records.set(name,JSON.parse(s))}),
    annalsQualifiedPhotoDerivative_:()=>null,annalsWriteOnce_:(_,name,v)=>{writes++;records.set(name,v);}});
  vm.runInContext(readFileSync(new URL('../scripts/annals/PhotoProduction.gs',import.meta.url),'utf8'),c);c.annalsPhotosReady_=()=>true;
  assert.equal(c.annalsPhotoSet_('fictional',source,true).length,0);assert.equal(thumbnails,0);assert.equal(writes,1);
  assert.equal(records.get('photo-conversion-0-private.json').state,'held_no_retry');
  assert.equal(c.annalsPhotoSet_('fictional',source,true).length,0);assert.equal(writes,1);
});

test('JPEG conversion reserves before work, reuses an exact private derivative and never resumes an interrupted conversion',()=>{
  const records=new Map(),files=new Map();let calls=0;
  const folder={createFile:blob=>{files.set(blob.name,{getBlob:()=>({getBytes:()=>blob.bytes})});return blob;}};
  const c=vm.createContext({AnnalsPhotos:Photos,AnnalsMedia:Media,annalsRead_:(_,name)=>records.get(name)||null,
    annalsFile_:(_,name)=>records.has(name)?{setContent:t=>records.set(name,JSON.parse(t))}:files.get(name)||null,
    annalsWriteOnce_:(_,name,value)=>records.set(name,structuredClone(value)),annalsPrivate_:v=>v,
    annalsHash_:b=>hash(Buffer.from(b)),Utilities:{newBlob:(bytes,mime,name)=>({bytes,mime,name})},
    annalsQualifiedPhotoDerivative_:()=>{calls++;assert.equal(records.get('photo-conversion-0-private.json').state,'attempt_reserved');return Media.sanitize(images[0],true);}});
  vm.runInContext(readFileSync(new URL('../scripts/annals/PhotoProduction.gs',import.meta.url),'utf8'),c);
  assert.equal(c.annalsConvertPhotoOnce_(folder,{}, {index:0}).width,1200);assert.equal(calls,1);
  assert.equal(c.annalsConvertPhotoOnce_(folder,{}, {index:0}).width,1200);assert.equal(calls,1);
  records.set('photo-conversion-1-private.json',{state:'attempt_reserved'});
  assert.equal(c.annalsConvertPhotoOnce_(folder,{}, {index:1}),null);assert.equal(calls,1);
});
