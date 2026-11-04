import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require=createRequire(import.meta.url);
const Policy=require('../scripts/annals/CocktailEditorialCore.js');
const source=readFileSync(new URL('../scripts/annals/CocktailEditorialProduction.gs',import.meta.url),'utf8');
const production=readFileSync(new URL('../scripts/annals/Production.gs',import.meta.url),'utf8');
const authSource=production.match(/function annalsAuthentication_\([\s\S]*?\n\}/)?.[0];
assert.ok(authSource,'real sender authentication function is present');
const handler=source.slice(source.indexOf('function annalsHandleCocktailPhotoResult_'),
  source.indexOf('\nfunction annalsEditorialSourceAlreadyQualified_'));
const preparation=source.slice(source.indexOf('function annalsPreparePrivatePhotoCanaryInEditor'),
  source.indexOf('function annalsHandleCocktailPhotoCanaryResult_'));
const jobTransport=source.slice(source.indexOf('function annalsPhotoJobMessageBody_'),
  source.indexOf('function annalsIssueCocktailPhotoJob_'));
const canary=source.slice(source.indexOf('function annalsHandleCocktailPhotoCanaryResult_'));
const sha=value=>createHash('sha256').update(Buffer.from(value)).digest('hex');
const token='a'.repeat(32),itemId='b'.repeat(64),entryId='annal-'+itemId.slice(0,24);
const worker='worker@example.invalid';
const sourceBytes=Buffer.alloc(5000,17),derivative=Buffer.alloc(5001,29);
function decodePhotoJobEnvelope(body){
 const marker='[ANNALS PHOTO JOB JSON V1]',separator=body.indexOf('\n');
 assert.ok(separator>=0);
 assert.equal(body.slice(0,separator).replace(/\r$/,''),marker);
 const payload=body.slice(separator+1).replace(/[\t\r\n ]/g,'');
 assert.match(payload,/^[A-Za-z0-9_-]+={0,2}$/);
 return JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
}

function harness({bytes=derivative,attachments=1,expired=false}={}){
 const now=new Date('2026-11-01T12:00:00.000Z'),files=new Map();
 const job={schema:'annals-photo-job-v1',jobToken:token,entryId,sourceSha256:sha(sourceBytes),photoIndex:0,
  name:'Synthetic drink',description:'Fictional qualification image.',ingredients:['imaginary citrus'],keywords:'synthetic'};
 const record={schema:'annals-photo-canary-job-v1',job,sourceItemId:itemId,
  sourceFilename:'synthetic-source.jpg',sourceSha256:job.sourceSha256,
  jobFilename:'job.json',expiresAt:'2026-11-08T12:00:00.000Z',state:'sent_once',sentAt:'2026-11-01T11:00:00.000Z'};
 const index={schema:'annals-photo-canary-index-v1',jobToken:token,sourceItemId:itemId,
  jobFilename:'job.json',entryId,sourceSha256:job.sourceSha256,
  expiresAt:expired?'2026-11-01T11:59:59.000Z':record.expiresAt,state:'sent_once'};
 const makeFile=(name,data)=>({getName:()=>name,getBlob:()=>({getBytes:()=>Array.from(data)}),
  setContent:value=>files.set(name,JSON.parse(String(value)))});
 const sourceFile=makeFile(record.sourceFilename,sourceBytes);files.set(record.sourceFilename,sourceFile);files.set('job.json',record);
 const folder={createFile(blob){const name=blob.getName();const f=makeFile(name,blob.getBytes());files.set(name,f);return f;}};
 const indexName='cocktail-photo-canary-token-'+token+'-private.json',rootFiles=new Map([[indexName,index]]),root={};let writeCount=0,publisherCalls=0;
 const context={Date,AnnalsCocktailEditorial:Policy,annalsFolder_:()=>folder,
  annalsRead_:(target,name)=>(target===root?rootFiles:files).get(name)||null,
  annalsFile_:(target,name)=>(target===root?rootFiles:files).has(name)?(target===root?rootFiles:files).get(name):null,
  annalsWriteOnce_:(target,name,value)=>{const map=target===root?rootFiles:files;if(map.has(name))throw Error('replay');map.set(name,value);writeCount++;},
  annalsSavePrivate_:(target,name,value)=>(target===root?rootFiles:files).set(name,value),annalsPrivate_:value=>value,
  annalsHash_:value=>sha(value),annalsJpegDerivativeSafe_:value=>value?.[0]===17||value?.[0]===29,
  AnnalsMedia:{sanitizeEditorial:value=>({bytes:Array.from(value),width:800,height:800})},AnnalsJpegCodec:{},
  Utilities:{newBlob:(value,_mime,name)=>{const bytes=typeof value==='string'?Buffer.from(value,'utf8'):Buffer.from(value);
    return {getName:()=>name,getBytes:()=>Array.from(bytes)};},
    base64EncodeWebSafe:value=>Buffer.from(value).toString('base64url')},
  annalsPublishCocktailEditorialResult_:()=>{publisherCalls++;throw Error('publisher must not run');},
  annalsProps_:()=>({getProperty:key=>key==='ANNALS_PHOTO_WORKER_EMAIL'?worker:''}),
  AnnalsPilot:{senderAddress:value=>String(value||'').toLowerCase()},
  annalsRoot_:()=>root};
 vm.createContext(context);vm.runInContext(authSource+'\n'+jobTransport+'\n'+handler+'\n'+canary,context,{timeout:10000});
 const qa={sameGlass:true,sameDrinkAndGarnish:true,photorealisticSubject:true,plausibleStemOrBase:true,
  sceneAppropriate:true,noArtifactsOrPrivateDetails:true};
 const result={schema:'annals-photo-result-v1',jobToken:token,entryId,sourceSha256:job.sourceSha256,
  status:'qualified',qa,alt:'AI-stylized fictional amber drink in a simple glass.',
  generatedAt:'2026-11-01T11:30:00.000Z',reviewedAt:'2026-11-01T11:35:00.000Z',
  generationProvider:'openai-chatgpt',generationModel:'undisclosed'};
 const message={getSubject:()=> '[ANNALS PHOTO RESULT V1] '+token,getFrom:()=> worker,
  getRawContent:()=> 'Authentication-Results: mx.google.com; dkim=pass header.d=example.invalid\r\n\r\nCanary fixture',
  getPlainBody:()=>JSON.stringify(result),getAttachments:()=>Array.from({length:attachments},()=>({getBytes:()=>Array.from(bytes),getContentType:()=> 'image/jpeg'}))};
 return {context,folder,files,index,record,result,message,now,counts:()=>({writeCount,publisherCalls})};
}

test('qualified synthetic canary is consumed privately and never reaches the publisher',()=>{
 const h=harness();
 const outcome=h.context.annalsHandleCocktailPhotoResult_(h.message);
 assert.equal(outcome,'photo_canary_private_only');
 assert.equal(h.files.get('cocktail-photo-canary-result-'+token+'-private.json').state,'qualified_private_only');
 assert.ok(h.files.has('cocktail-photo-canary-result-'+token+'-private.jpg'));
 assert.equal(h.files.get('job.json').state,'result_received_private_canary');
 assert.deepEqual(h.counts(),{writeCount:2,publisherCalls:0});
 assert.equal(h.context.annalsHandleCocktailPhotoResult_(h.message),'photo_result_held');
 assert.equal(h.counts().publisherCalls,0);
});

test('expired, replayed or source-mismatched canary is held without storage or publication',()=>{
 const old=harness({expired:true});
 assert.equal(old.context.annalsHandleCocktailPhotoResult_(old.message),'photo_result_held');
 assert.equal(old.counts().writeCount,0);
 const mismatched=harness();mismatched.index.sourceSha256='c'.repeat(64);
 assert.equal(mismatched.context.annalsHandleCocktailPhotoResult_(mismatched.message),'photo_result_held');
 assert.equal(mismatched.counts().writeCount,0);
 assert.equal(mismatched.counts().publisherCalls,0);
});

test('Base64URL photo-job envelope survives folded lines and preserves exact UTF-8 JSON values',()=>{
 const h=harness();
 const job={schema:'annals-photo-job-v1',jobToken:token,entryId,sourceSha256:sha(sourceBytes),photoIndex:2,
  name:'Café “North Star” — shaken, not stirred',
  description:('Quoted “long description”, tabs\t, spaces  and Unicode — 雪. ').repeat(45),
  ingredients:Array.from({length:12},(_,i)=>`Ingredient ${i+1}: crème de cacao “dark”, ½ oz\twith whitespace`),
  keywords:'amber · citrus · garnish — naïve façade'};
 const envelope=h.context.annalsPhotoJobMessageBody_(job);
 const marker='[ANNALS PHOTO JOB JSON V1]\n';
 assert.ok(envelope.startsWith(marker));
 const payload=envelope.slice(marker.length);
 const folded=payload.match(/.{1,71}/g).join('\r\n');
 const receivedEnvelope='[ANNALS PHOTO JOB JSON V1]\r\n'+folded;
 assert.equal(JSON.stringify(decodePhotoJobEnvelope(receivedEnvelope)),JSON.stringify(job));
});

test('forged Authentication-Results cannot consume the canary or fall through',()=>{
 const h=harness();
 h.message.getRawContent=()=> 'Authentication-Results: mx.google.com; dkim=pass header.d=attacker.example\r\n\r\nForged';
 assert.equal(h.context.annalsHandleCocktailPhotoResult_(h.message),'photo_result_held');
 assert.equal(h.counts().writeCount,0);assert.equal(h.counts().publisherCalls,0);
});

test('worker identity uncertainty remains the held reason when no attachment is returned',()=>{
 const h=harness({attachments:0});
 h.message.getPlainBody=()=>JSON.stringify({schema:'annals-photo-result-v1',jobToken:token,
  entryId,sourceSha256:h.record.sourceSha256,status:'held',reasonCode:'identity_uncertain'});
 assert.equal(h.context.annalsHandleCocktailPhotoResult_(h.message),'photo_result_held');
 assert.equal(h.files.get('cocktail-photo-canary-result-'+token+'-private.json').reasonCode,'identity_uncertain');
 assert.equal(h.counts().publisherCalls,0);
});

test('photo results are intercepted before ordinary intake staging',()=>{
 const start=production.indexOf('function processInboxMessage(message)');
 const end=production.indexOf('for (var recentIndex',start);
 const route=production.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.ok(route.indexOf('annalsHandleCocktailPhotoResult_')<route.indexOf('annalsStageProduction_'));
 assert.match(route,/if\s*\(photoOutcome\s*!==\s*null\)\s*\{[\s\S]*?return;/);
});

test('owner preparation records a synthetic 7-day job without sending, and send is one-shot',()=>{
 const rootFiles=new Map(),folderFiles=new Map(),folder={createFile(blob){
   const name=blob.getName(),file={getName:()=>name,getBlob:()=>({getBytes:()=>blob.getBytes()})};
   folderFiles.set(name,file);return file;
  }};
 let uuid=0,mailAttempts=0,drawnPixels=null,sentMessages=[];
 const ctx={Date,Uint8Array,AnnalsJpegCodec:{encode:image=>{drawnPixels={width:image.width,height:image.height,data:Array.from(image.data)};
   return {data:Uint8Array.from([17,...new Array(4998).fill(22),29])};}},
  AnnalsCocktailEditorial:Policy,annalsOwner_:()=>{},annalsServiceOwner_:()=> 'owner@example.invalid',
  annalsLocked_:fn=>fn(),
  annalsProps_:()=>({getProperty:key=>key==='ANNALS_PHOTO_WORKER_EMAIL'?worker:''}),
  annalsHash_:value=>sha(value),annalsJpegDerivativeSafe_:()=>true,
  Utilities:{getUuid:()=>++uuid===1?'12345678-1234-1234-1234-123456789abc':'abcdefab-cdef-abcd-efab-cdefabcdefab',
   newBlob:(value,_mime,name)=>{const bytes=typeof value==='string'?Buffer.from(value,'utf8'):Buffer.from(value);
    return {getName:()=>name,getBytes:()=>Array.from(bytes)};},
   base64EncodeWebSafe:value=>Buffer.from(value).toString('base64url')},
  annalsFolder_:()=>folder,annalsRoot_:()=>rootFiles,
  annalsPrivate_:value=>value,
  annalsWriteOnce_:(where,name,value)=>{const map=where===folder?folderFiles:where;if(map.has(name))throw Error('immutable');map.set(name,value);},
  annalsRead_:(where,name)=>(where===folder?folderFiles:where).get(name)||null,
  annalsFile_:(where,name)=>where===folder?folderFiles.get(name)||null:where.get(name)||null,
  annalsSavePrivate_:(where,name,value)=>(where===folder?folderFiles:where).set(name,value),
  GmailApp:{sendEmail:(...args)=>{mailAttempts++;sentMessages.push(args);}},
 };
 vm.createContext(ctx);vm.runInContext(jobTransport+'\n'+preparation,ctx,{timeout:10000});
 const prepared=ctx.annalsPreparePrivatePhotoCanaryInEditor(worker);
 const colorAt=(x,y)=>drawnPixels.data.slice((y*drawnPixels.width+x)*4,(y*drawnPixels.width+x)*4+3);
 assert.equal(prepared.state,'prepared_no_mail');assert.equal(prepared.mailSent,false);
 assert.equal(prepared.published,false);assert.equal(prepared.sourceIsSynthetic,true);
 assert.equal(prepared.workerMatchesConfiguration,true);
 assert.doesNotMatch(JSON.stringify(prepared),/worker@example\.invalid|owner@example\.invalid/);
 assert.match(prepared.subject,/^\[ANNALS PHOTO JOB v1\] [a-f0-9]{32}$/);
 assert.equal(mailAttempts,0);
 assert.deepEqual(colorAt(30,30),[222,237,229]);
 assert.deepEqual(colorAt(320,290),[206,132,48]);
 assert.deepEqual(colorAt(320,450),[83,105,101]);
 assert.deepEqual(colorAt(370,205),[242,183,122]);
 assert.deepEqual(colorAt(445,190),[245,205,111]);
 // The fixture folder lookup is keyed by its synthetic item ID.
 const indexName='cocktail-photo-canary-token-'+prepared.token+'-private.json';
 const index=rootFiles.get(indexName);ctx.annalsFolder_=id=>{assert.equal(id,index.sourceItemId);return folder;};
 assert.equal(Date.parse(index.expiresAt)-Date.parse(index.createdAt),7*24*60*60*1000);
 const sent=ctx.annalsSendPrivatePhotoCanaryInEditor(prepared.token,worker);
 assert.equal(sent.state,'sent_once');assert.equal(sent.published,false);assert.equal(mailAttempts,1);
 const marker='[ANNALS PHOTO JOB JSON V1]\n';
 assert.ok(sentMessages[0][2].startsWith(marker));
 const decodedJob=decodePhotoJobEnvelope(sentMessages[0][2]);
 const sentIndex=rootFiles.get(indexName),sentRecord=folderFiles.get(sentIndex.jobFilename);
 assert.equal(JSON.stringify(decodedJob),JSON.stringify(sentRecord.job));
 assert.equal(rootFiles.get(indexName).state,'sent_once');
 assert.throws(()=>ctx.annalsSendPrivatePhotoCanaryInEditor(prepared.token,worker),/unused/);
 assert.equal(mailAttempts,1);
});
