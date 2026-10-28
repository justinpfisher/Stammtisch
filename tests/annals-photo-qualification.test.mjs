/* End-to-end offline qualification of the private photo route.
 * All storage, signing keys, provider responses, and pixels are fictional.
 * The Apps Script production functions run against in-memory adapters; no
 * Google service, provider, real image, or public artifact is contacted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash,createHmac} from 'node:crypto';
import {createRequire} from 'node:module';
import {applyApprovedEntry} from '../scripts/annals/apply-approved-entry.mjs';
import {verifyPublicApproval,contentDigest} from '../scripts/annals/ApprovedRenderer.mjs';
import {qualifiedEditorialPhoto,styleCocktailPreviews} from '../annals-photos.mjs';

const require=createRequire(import.meta.url);
const Photos=require('../scripts/annals/PhotoContracts.js');
const Media=require('../scripts/annals/MediaCore.js');
const Codec=require('../scripts/annals/JpegCodec.js');
const Derivative=require('../scripts/annals/PhotoDerivative.js');
const Production=require('../scripts/annals/ProductionCore.js');
const photoSource=readFileSync(new URL('../scripts/annals/PhotoProduction.gs',import.meta.url),'utf8');
const productionSource=readFileSync(new URL('../scripts/annals/Production.gs',import.meta.url),'utf8');
const derivativeSource=readFileSync(new URL('../scripts/annals/PhotoDerivative.js',import.meta.url),'utf8');
const at='2026-10-15T21:00:00.000Z';
const folderId='a'.repeat(64);
const approvalKey='fictional-private-approval-key-not-production';
const publishKey='fictional-publication-signing-key-not-production';
const githubToken='fictional-token-not-production';
const hash=value=>createHash('sha256').update(typeof value==='string'?value:Buffer.from(value)).digest('hex');
const gitBlobSha=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const image=(width,height)=>{
  const data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=(y*width+x)*4;data[p]=x<width/2?220:35;data[p+1]=y<height/2?180:45;data[p+2]=90;data[p+3]=255;
  }
  return {width,height,data};
};
const originalBytes=Buffer.from(Codec.encode(image(800,800),82).data);
const corruptBytes=Buffer.from('synthetic corrupt jpeg bytes');

function harness({dispatchStatus=204,original=originalBytes}={}){
  const files=new Map(),uploaded=new Map(),dispatches=[];
  const properties={
    ANNALS_APPROVAL_KEY:approvalKey,ANNALS_PUBLISH_SIGNING_KEY:publishKey,
    ANNALS_GITHUB_TOKEN:githubToken,ANNALS_GITHUB_REPOSITORY:'justinpfisher/Stammtisch',
    ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED:'true',ANNALS_SIGNING_REMEDIATED_AT:at,
    ANNALS_AUTO_MEDIA_ENABLED:'true',ANNALS_PHOTOS_V2_ENABLED:'true',ANNALS_PHOTOS_HOSTED_ACCEPTED:'true',
  };
  let dispatchCalls=0,blobCalls=0;
  const store=(name,value)=>{
    const file={
      getName:()=>name,
      getBlob:()=>({
        getBytes:()=>Buffer.isBuffer(value)?Array.from(value):Array.from(Buffer.from(String(value))),
        getDataAsString:()=>Buffer.isBuffer(value)?value.toString('utf8'):String(value),
        getContentType:()=> 'image/jpeg',
      }),
      setContent:text=>{value=String(text);},
      getSharingAccess:()=> 'PRIVATE',getEditors:()=>[],getViewers:()=>[],
      getOwner:()=>({getEmail:()=> 'offline-owner@example.test'}),
    };
    Object.defineProperty(file,'_content',{get:()=>value});
    files.set(name,file);return file;
  };
  const folder={
    getName:()=>folderId,
    getFilesByName:name=>{let used=false;return {hasNext:()=>!used&&files.has(name),next:()=>{used=true;return files.get(name);}};},
    createFile:(nameOrBlob,content)=>{
      if(nameOrBlob&&typeof nameOrBlob==='object'&&typeof nameOrBlob.getBytes==='function'){
        return store(nameOrBlob.getName(),Buffer.from(nameOrBlob.getBytes()));
      }
      return store(String(nameOrBlob),String(content));
    },
  };
  store('original-synthetic.jpg',original);
  const source={syntheticFixture:true,senderAuthenticated:true,clubMemberAuthenticated:true,
    externalContributionAtReceipt:false,imageConsentAtReceipt:true,
    source:{sender:'fictional-member@example.test',receivedAt:at,subject:'Synthetic qualification only',excerpt:'Fictional image fixture.'},
    attachmentManifest:{items:[{index:0,storageName:'original-synthetic.jpg',mime:'image/jpeg',accepted:true,size:original.length}]}};
  store('source-private.json',JSON.stringify(source));
  const utilities={
    DigestAlgorithm:{SHA_256:'sha256',SHA_1:'sha1'},Charset:{UTF_8:'utf8'},
    computeDigest:(algorithm,value)=>Array.from(createHash(algorithm).update(typeof value==='string'?value:Buffer.from(value)).digest()),
    computeHmacSha256Signature:(value,key)=>Array.from(createHmac('sha256',key).update(value).digest()),
    base64Encode:value=>Buffer.from(value).toString('base64'),base64Decode:value=>Array.from(Buffer.from(value,'base64')),
    newBlob:(value,mime,name)=>{const bytes=typeof value==='string'?Buffer.from(value):Buffer.from(value);return {getBytes:()=>Array.from(bytes),getName:()=>name||'offline-blob.jpg',getContentType:()=>mime||'application/octet-stream'};},
  };
  class FixedDate extends Date{constructor(...args){super(...(args.length?args:[at]));}static now(){return Date.parse(at);}}
  const context=vm.createContext({Date:FixedDate,Uint8Array,AnnalsPhotos:Photos,AnnalsMedia:Media,
    AnnalsPhotoDerivative:Derivative,AnnalsJpegCodec:Codec,AnnalsProduction:Production,Utilities:utilities,
    MimeType:{PLAIN_TEXT:'text/plain'},
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties[key]??null,setProperty:(key,value)=>{properties[key]=value;}})},
    annalsProps_:()=>({getProperty:key=>properties[key]??null,setProperty:(key,value)=>{properties[key]=value;}}),
    annalsHash_:hash,annalsHex_:bytes=>Buffer.from(bytes).toString('hex'),annalsPrivate_:value=>value,
    annalsFolder_:()=>folder,annalsRead_:(_,name)=>{const file=files.get(name);if(!file)return null;const data=file._content;return Buffer.isBuffer(data)?null:JSON.parse(String(data));},
    annalsFile_:(_,name)=>files.get(name)||null,
    annalsWriteOnce_:(_,name,value)=>{assert.equal(files.has(name),false,`write-once marker ${name}`);return store(name,JSON.stringify(value));},
    annalsSavePrivate_:(_,name,value)=>{const file=files.get(name);if(file)file.setContent(JSON.stringify(value));else store(name,JSON.stringify(value));},
    annalsPhotosReady_:()=>true,annalsPublisherDispatchReady_:()=>true,
    annalsImageConsentActive_:()=>true,annalsStandingGalleryCorrectionAllowed_:()=>true,
    // Membership/source integrity is checked by the exact-head PR #328 suite;
    // this fixture asserts the authenticated six-member receipt shape.
    annalsOrdinarySourceGate_:candidate=>{
      assert.equal(candidate.senderAuthenticated,true);assert.equal(candidate.clubMemberAuthenticated,true);
      assert.equal(candidate.externalContributionAtReceipt,false);assert.equal(candidate.syntheticFixture,true);
    },
    UrlFetchApp:{fetch:(url,options)=>{
      if(url.endsWith('/git/blobs')){
        blobCalls++;const request=JSON.parse(options.payload),bytes=Buffer.from(request.content,'base64'),sha=gitBlobSha(bytes);
        uploaded.set(sha,bytes);return {getResponseCode:()=>201,getContentText:()=>JSON.stringify({sha})};
      }
      if(url.endsWith('/dispatches')){
        dispatchCalls++;dispatches.push(JSON.parse(options.payload));
        return {getResponseCode:()=>dispatchStatus,getContentText:()=>''};
      }
      assert.fail('Unexpected provider URL in offline qualification');
    }},
  });
  vm.runInContext(derivativeSource,context);
  vm.runInContext(photoSource,context);
  vm.runInContext(productionSource,context);
  // Production.gs defines the real Apps Script adapters. Replace only those
  // external-service boundaries after loading so all route logic stays real.
  context.annalsProps_=()=>({getProperty:key=>properties[key]??null,setProperty:(key,value)=>{properties[key]=value;}});
  context.annalsRoot_=()=>folder;context.annalsFolder_=()=>folder;
  context.annalsHash_=hash;context.annalsHex_=bytes=>Buffer.from(bytes).toString('hex');context.annalsPrivate_=value=>value;
  context.annalsFile_=(_,name)=>files.get(name)||null;
  context.annalsRead_=(_,name)=>{const file=files.get(name);if(!file)return null;const data=file._content;return Buffer.isBuffer(data)?null:JSON.parse(String(data));};
  context.annalsWriteOnce_=(_,name,value)=>{assert.equal(files.has(name),false,`write-once marker ${name}`);return store(name,JSON.stringify(value));};
  context.annalsSavePrivate_=(_,name,value)=>{const file=files.get(name);if(file)file.setContent(JSON.stringify(value));else store(name,JSON.stringify(value));};
  context.annalsOrdinarySourceGate_=candidate=>{
    assert.equal(candidate.senderAuthenticated,true);assert.equal(candidate.clubMemberAuthenticated,true);
    assert.equal(candidate.externalContributionAtReceipt,false);assert.equal(candidate.syntheticFixture,true);
  };
  context.annalsPhotosReady_=()=>true;
  context.annalsPublisherDispatchReady_=()=>true;
  context.annalsImageConsentActive_=()=>true;
  context.annalsStandingGalleryCorrectionAllowed_=()=>true;
  return {context,files,folder,properties,uploaded,dispatches,store,
    counts:()=>({blobCalls,dispatchCalls}),source,original,
    convert:()=>context.annalsPhotoSet_(folderId,source,true)};
}

function makeSignedPublication(h,entry){
  assert.equal(hash(Production.serial(entry)),contentDigest(entry),'private/public canonical entry digest agrees');
  const receipt={entryId:entry.id,approvedAt:at,reviewedBy:'offline-fictional-owner',
    consents:{publication:true,quotePublication:false,recipeVerified:true,namedAttribution:false,photoPublication:true},
    contentSha256:contentDigest(entry)};
  receipt.signature=createHmac('sha256',approvalKey)
    .update(Production.serial({entry,receipt})).digest('hex');
  const publication=h.context.annalsPublicApproval_(entry,receipt,publishKey);
  assert.ok(publication,'distinct fictional publication signer is configured');
  h.store('approval-private.json',JSON.stringify({entry,receipt,publication}));
  return {receipt,publication};
}

function qualifiedEntry(h,photos){
  const entry={id:'annal-'+folderId.slice(0,24),category:'cocktail',title:'Synthetic qualification fixture',
    summary:'Fictional geometry only; no Club history.',year:2026,dateLabel:'',sortDate:'',credit:'anonymous',quoteVerbatim:'',
    recipe:{drinkIngredients:['1 oz imaginary syrup'],syrupIngredients:[],steps:['Mix synthetic ingredients.']},
    photos:photos.map(p=>({sha256:p.sha256,width:p.width,height:p.height,alt:'Fictional synthetic geometry fixture'})),
    submittedAt:at,eventPeriod:''};
  return Production.publicEntry(entry);
}

test('synthetic private route converts privately, signs a receipt, uploads through mocks and verifies the published derivative',async()=>{
  const h=harness(),converted=h.convert();
  assert.equal(converted.length,1);assert.equal(converted[0].width,800);assert.equal(converted[0].height,800);
  assert.deepEqual(Buffer.from(h.files.get('original-synthetic.jpg').getBlob().getBytes()),originalBytes,'original is preserved byte-for-byte');
  assert.ok(h.files.has('photo-conversion-0-private.json'));assert.ok(h.files.has('photos-v2-private.json'));
  const entry=qualifiedEntry(h,converted),{receipt,publication}=makeSignedPublication(h,entry);
  assert.equal(h.context.annalsPrivateReceiptValid_(entry,receipt),true,'private HMAC receipt verifies');
  assert.equal(verifyPublicApproval(entry,publication,publishKey),true,'public signature verifies independently');
  const accepted=h.context.annalsDispatchApproved_(h.folder,entry,publication,'annals-approved-entry','publication-dispatch-private.json');
  assert.equal(accepted,true);assert.equal(h.dispatches.length,1);assert.equal(h.counts().blobCalls,1);
  assert.equal(h.files.get('photo-upload-private.json')._content.includes('uploaded'),true);
  const event={action:h.dispatches[0].event_type,client_payload:h.dispatches[0].client_payload};
  const result=await applyApprovedEntry({event,data:{schemaVersion:1,entries:[],approvals:[]},secret:publishKey,
    now:new Date(at),photosEnabled:true,blobTransportEnabled:true,
    fetchBlob:async ref=>h.uploaded.get(ref.gitSha)});
  assert.equal(result.data.entries.length,1);assert.equal(result.data.approvals.length,1);
  assert.equal(result.data.approvals[0].signature,publication.signature);
  assert.equal(result.assetsToWrite.filter(asset=>asset.path.endsWith('.jpg')).length,2,'full derivative and thumbnail only');
  assert.ok(result.assetsToWrite.every(asset=>asset.path.includes(entry.photos[0].sha256)));
  const forged={...publication,signature:'0'.repeat(64)};
  await assert.rejects(applyApprovedEntry({event:{...event,client_payload:{...event.client_payload,approval:forged}},
    data:{schemaVersion:1,entries:[],approvals:[]},secret:publishKey,now:new Date(at),photosEnabled:true,
    blobTransportEnabled:true,fetchBlob:async ref=>h.uploaded.get(ref.gitSha)}),/approval|signature/i);
});

test('corrupt synthetic JPEG is held before derivative, upload or dispatch and the source bytes remain intact',()=>{
  const h=harness({original:corruptBytes});
  assert.equal(h.convert().length,0);
  assert.deepEqual(Buffer.from(h.files.get('original-synthetic.jpg').getBlob().getBytes()),corruptBytes);
  assert.equal(h.files.get('photo-conversion-0-private.json')._content.includes('held_no_retry'),true);
  assert.equal(h.files.has('photos-v2-private.json'),false);assert.equal(h.counts().blobCalls,0);assert.equal(h.counts().dispatchCalls,0);
});

test('a rejected dispatch is journalled once and cannot replay uploaded bytes or create a public archive',()=>{
  const h=harness({dispatchStatus:503}),converted=h.convert(),entry=qualifiedEntry(h,converted),{publication}=makeSignedPublication(h,entry);
  assert.equal(h.context.annalsDispatchApproved_(h.folder,entry,publication,'annals-approved-entry','publication-dispatch-private.json'),false);
  const dispatchMarker=JSON.parse(h.files.get('publication-dispatch-private.json')._content);
  assert.equal(dispatchMarker.state,'rejected_no_retry');assert.equal(h.dispatches.length,1);
  const before=h.counts();
  assert.equal(h.context.annalsDispatchApproved_(h.folder,entry,publication,'annals-approved-entry','publication-dispatch-private.json'),false);
  assert.deepEqual(h.counts(),before,'the reserved dispatch/upload is not replayed');
  assert.equal(h.files.has('public-archive-private.json'),false);
});

test('failed editorial treatment restores the authentic original in the public viewer',async()=>{
  const source='assets/annals/'+ 'b'.repeat(64)+'.jpg',styled=source.replace(/\.jpg$/,'-editorial-v2.jpg');
  const record={source,sourceSha256:'b'.repeat(64),asset:styled,status:'qualified',artDirection:'moody-atmospheric-v2',
    generationOperation:'image-edit',rightsQualified:true,safetyQualified:true,visualQualified:true,
    editorialSha256:'c'.repeat(64),width:800,height:800,alt:'AI-stylized synthetic still-life fixture'};
  const listeners={},caption={textContent:'Fictional fixture caption',append:node=>{caption.label=node;}};
  const figure={querySelector:selector=>selector==='figcaption'?caption:selector==='[data-editorial-caption]'?caption.label:null};
  const img={src:source,alt:'Authentic synthetic original',width:800,height:800,
    getAttribute(name){return this[name]??null;},removeAttribute(name){delete this[name];},addEventListener:(name,fn)=>{listeners[name]=fn;}};
  const link={href:source,dataset:{photoSha256:'b'.repeat(64)},isConnected:true,getAttribute:()=>source,querySelector:()=>img,closest:()=>figure};
  const root={querySelectorAll:()=>[link]};
  const previousFetch=globalThis.fetch,PreviousImage=globalThis.Image,PreviousDocument=globalThis.document,probes=[];let fetchCalls=0;
  globalThis.fetch=async()=>{fetchCalls++;return {ok:true,json:async()=>({schemaVersion:1,artDirection:'moody-atmospheric-v2',images:[record]})};};
  globalThis.Image=class{constructor(){probes.push(this);}set src(value){this._src=value;}get src(){return this._src;}};
  globalThis.document={createElement:()=>({dataset:{},textContent:'',remove(){caption.label=null;}})};
  try{
    assert.equal(typeof Image,'function');assert.equal(qualifiedEditorialPhoto(record,source,'b'.repeat(64)),record);
    await styleCocktailPreviews(root);assert.equal(fetchCalls,1);assert.equal(probes.length,1);
    probes[0].onload();assert.equal(img.src,styled);
    listeners.error();
    assert.equal(img.src,source);assert.equal(img.alt,'Authentic synthetic original');
    assert.equal(link.dataset.editorialSrc,undefined);assert.equal(figure.querySelector('[data-editorial-caption]'),null);
  }finally{
    if(previousFetch===undefined)delete globalThis.fetch;else globalThis.fetch=previousFetch;
    if(PreviousImage===undefined)delete globalThis.Image;else globalThis.Image=PreviousImage;
    if(PreviousDocument===undefined)delete globalThis.document;else globalThis.document=PreviousDocument;
  }
});

