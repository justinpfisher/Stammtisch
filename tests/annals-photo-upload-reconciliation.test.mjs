import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../scripts/annals/PhotoProduction.gs',import.meta.url),'utf8');
const sha256=bytes=>createHash('sha256').update(Buffer.from(bytes)).digest('hex');
const gitBlobSha=bytes=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),Buffer.from(bytes)])).digest('hex');
const bytes=Buffer.from([0xff,0xd8,0xff,0xdb,1,2,3,4,0xff,0xd9]);
const imageSha=sha256(bytes),gitSha=gitBlobSha(bytes);
const base64=bytes.toString('base64');
const sourceId='d'.repeat(64),entryId='annal-'+ 'a'.repeat(24);
const approvalHash='b'.repeat(64);

function fixture({uploadState=null,remoteStatus=200,remoteBytes=bytes,quarantined=false,removed=false}={}){
  const files=new Map(),calls=[];
  const props={
    ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED:'true',
    ANNALS_GITHUB_REPOSITORY:'justinpfisher/Stammtisch',
    ANNALS_GITHUB_TOKEN:'fixture-token'
  };
  const entry={id:entryId,photos:[{sha256:imageSha,width:1152,height:1536}]};
  const approval={entryId,contentSha256:approvalHash,approvedAt:new Date().toISOString(),mode:'standing-consent-photos-v2'};
  const saved={entry,receipt:{},publication:approval};
  files.set('source-private.json',JSON.stringify({source:{sender:'fixture@example.test'}}));
  files.set('approval-private.json',JSON.stringify(saved));
  if(uploadState){
    files.set('photo-upload-private.json',JSON.stringify({
      state:uploadState,at:'2026-11-06T19:12:03.970Z',contentSha256:approvalHash,
      refs:[{sha256:imageSha,gitSha,size:bytes.length}],completed:0
    }));
  }
  if(quarantined)files.set('quarantine-private.json','{}');
  if(removed)files.set('removal-private.json','{}');
  const folder={getName:()=>sourceId};
  const context={
    AnnalsProduction:{serial:value=>JSON.stringify(value)},
    AnnalsPhotos:{validate:()=>true,blobRefs:()=>true},
    AnnalsMedia:{sanitize:input=>({bytes:Uint8Array.from(input),width:1152,height:1536})},
    AnnalsPhotoDerivative:{thumbnail:()=>({bytes:Uint8Array.of(1,2,3)})},
    AnnalsJpegCodec:{},
    Utilities:{
      DigestAlgorithm:{SHA_1:'SHA_1'},
      base64Decode:value=>Uint8Array.from(Buffer.from(value,'base64')),
      computeDigest:(algorithm,value)=>createHash('sha1').update(Buffer.from(value)).digest(),
      newBlob:value=>({getBytes:()=>Array.from(Buffer.isBuffer(value)?value:Buffer.from(String(value),'utf8'))})
    },
    annalsProps_:()=>({getProperty:key=>props[key]||''}),
    annalsPhotosReady_:()=>true,
    annalsPublisherDispatchReady_:()=>true,
    annalsFile_:(folder,name)=>files.has(name)?{getName:()=>name,setContent:value=>files.set(name,String(value)),getBlob:()=>({getDataAsString:()=>files.get(name)})}:null,
    annalsRead_:(folder,name)=>files.has(name)?JSON.parse(files.get(name)):null,
    annalsWriteOnce_:(folder,name,value)=>{if(files.has(name))throw Error('already exists');files.set(name,JSON.stringify(value));},
    annalsOrdinarySourceGate_:()=>true,
    annalsStandingGalleryCorrectionAllowed_:()=>true,
    annalsPrivateReceiptValid_:()=>true,
    annalsPublicApproval_:()=>approval,
    annalsPhotoSet_:()=>[{sha256:imageSha,base64}],
    annalsHash_:value=>sha256(typeof value==='string'?Buffer.from(value,'utf8'):value),
    annalsHex_:value=>Buffer.from(value).toString('hex'),
    UrlFetchApp:{fetch:(url,options)=>{
      calls.push({url,method:options.method});
      if(options.method==='get'){
        if(remoteStatus!==200)return {getResponseCode:()=>remoteStatus,getContentText:()=>''};
        const encoded=Buffer.from(remoteBytes).toString('base64');
        const wrapped=encoded.match(/.{1,60}/g).join('\n');
        return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({
          sha:gitBlobSha(remoteBytes),size:remoteBytes.length,encoding:'base64',content:wrapped
        })};
      }
      return {getResponseCode:()=>201,getContentText:()=>JSON.stringify({sha:gitSha})};
    }}
  };
  vm.runInNewContext(source,context);
  context.annalsPublisherDispatchReady_=()=>true;
  context.annalsPhotosReady_=()=>true;
  context.annalsOrdinarySourceGate_=()=>true;
  context.annalsStandingGalleryCorrectionAllowed_=()=>true;
  context.annalsPrivateReceiptValid_=()=>true;
  context.annalsPublicApproval_=()=>approval;
  context.annalsPhotoSet_=()=>[{sha256:imageSha,base64}];
  return {context,files,calls,folder,entry,approval};
}

test('reconciles a reserved upload only from an exact immutable Git blob and preserves the original journal',()=>{
  const x=fixture({uploadState:'attempt_reserved'});
  const before=x.files.get('photo-upload-private.json');
  const refs=x.context.annalsPhotoBlobRefs_(x.folder,x.entry,x.approval,'annals-auto-entry');
  assert.deepEqual(JSON.parse(JSON.stringify(refs)),[{sha256:imageSha,gitSha,size:bytes.length}]);
  assert.deepEqual(x.calls.map(c=>c.method),['get']);
  assert.equal(x.files.get('photo-upload-private.json'),before);
  assert.equal(x.files.has('photo-upload-reconciliation-private.json'),false);
});

test('a later locked pass rechecks the immutable blob without replaying POST',()=>{
  const x=fixture({uploadState:'attempt_reserved'});
  assert.ok(x.context.annalsPhotoBlobRefs_(x.folder,x.entry,x.approval,'annals-auto-entry'));
  const firstCalls=x.calls.length,oldJournal=x.files.get('photo-upload-private.json');
  assert.ok(x.context.annalsPhotoBlobRefs_(x.folder,x.entry,x.approval,'annals-auto-entry'));
  assert.equal(x.calls.length,firstCalls+1);
  assert.deepEqual(x.calls.map(c=>c.method),['get','get']);
  assert.equal(x.files.get('photo-upload-private.json'),oldJournal);
  assert.equal(x.calls.some(c=>c.method==='post'),false);
  assert.equal(x.files.has('photo-upload-reconciliation-private.json'),false);
});

test('unknown upload outcome reconciles by immutable content, never by replaying POST',()=>{
  const x=fixture({uploadState:'unknown_no_retry'});
  assert.ok(x.context.annalsPhotoBlobRefs_(x.folder,x.entry,x.approval,'annals-auto-entry'));
  assert.deepEqual(x.calls.map(c=>c.method),['get']);
});

test('missing immutable blob leaves the reservation untouched and does not retry upload',()=>{
  const x=fixture({uploadState:'attempt_reserved',remoteStatus:404});
  const before=x.files.get('photo-upload-private.json');
  assert.equal(x.context.annalsPhotoBlobRefs_(x.folder,x.entry,x.approval,'annals-auto-entry'),null);
  assert.equal(x.calls.length,1);
  assert.equal(x.calls[0].method,'get');
  assert.equal(x.files.get('photo-upload-private.json'),before);
  assert.equal(x.files.has('photo-upload-reconciliation-private.json'),false);
});

test('a mismatched immutable blob fails closed without changing journals or issuing POST',()=>{
  const x=fixture({uploadState:'attempt_reserved',remoteBytes:Buffer.from('different image')});
  const before=x.files.get('photo-upload-private.json');
  assert.equal(x.context.annalsPhotoBlobRefs_(x.folder,x.entry,x.approval,'annals-auto-entry'),null);
  assert.deepEqual(x.calls.map(c=>c.method),['get']);
  assert.equal(x.files.get('photo-upload-private.json'),before);
  assert.equal(x.files.has('photo-upload-reconciliation-private.json'),false);
});

test('explicitly rejected upload records are not eligible for reconciliation',()=>{
  const x=fixture({uploadState:'rejected_no_retry'});
  x.files.set('photo-upload-private.json',JSON.stringify({
    state:'rejected_no_retry',contentSha256:approvalHash,refs:[{sha256:imageSha,gitSha,size:bytes.length}],completed:0
  }));
  assert.equal(x.context.annalsPhotoBlobRefs_(x.folder,x.entry,x.approval,'annals-auto-entry'),null);
  assert.equal(x.calls.length,0);
});

test('quarantine and removal continue to block reconciliation before any network read',()=>{
  for(const options of [{quarantined:true},{removed:true}]){
    const x=fixture({uploadState:'attempt_reserved',...options});
    assert.equal(x.context.annalsPhotoBlobRefs_(x.folder,x.entry,x.approval,'annals-auto-entry'),null);
    assert.equal(x.calls.length,0);
  }
});

test('fresh upload path still makes exactly one POST when no prior journal exists',()=>{
  const x=fixture();
  assert.ok(x.context.annalsPhotoBlobRefs_(x.folder,x.entry,x.approval,'annals-auto-entry'));
  assert.deepEqual(x.calls.map(c=>c.method),['post']);
  assert.equal(JSON.parse(x.files.get('photo-upload-private.json')).state,'uploaded');
});


