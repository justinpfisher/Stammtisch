import {readFileSync} from 'node:fs';
import {createHash,createHmac} from 'node:crypto';
import {createContext,runInContext} from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyHistoryRevision,historyDigest,renderHistory} from '../../scripts/annals/HistoryPublisher.mjs';
import {historyCredits,historyBacklinks,subtractStaleHistory} from '../../scripts/annals/BoundHistory.mjs';
import Production from '../../scripts/annals/ProductionCore.js';
const source=readFileSync(new URL('../../scripts/annals/HistoryProduction.gs',import.meta.url),'utf8');
const production=readFileSync(new URL('../../scripts/annals/Production.gs',import.meta.url),'utf8');
const canon=x=>Array.isArray(x)?x.map(canon):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canon(x[k])])):x;
const serial=x=>JSON.stringify(canon(x));
const hash=x=>createHash('sha256').update(x).digest('hex');
const snap=x=>JSON.parse(JSON.stringify(x));
const a='annal-'+'a'.repeat(24),b='annal-'+'b'.repeat(24);
const binding=(entryId,digest,portrait)=>({kind:'annal',entryId,digest,label:'Original entry',portrait});
function fixture(){
 const publishKey='fixture-only-Annals-publishing-key-002';
 const publicRecord=(id,portrait)=>{
   const entry=Production.publicEntry({id,category:'club_history',title:'Fictional recollection',summary:'A fictional public account.',
     credit:'anonymous',year:2026,sortDate:'',dateLabel:'',quoteVerbatim:'',contributorPortrait:portrait,
     recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]}});
   const unsigned={entryId:id,contentSha256:hash(serial(entry)),approvedAt:new Date(Date.now()-10000).toISOString(),
     consents:{publication:true,quotePublication:false,recipeVerified:false,namedAttribution:true,photoPublication:false}};
   const signature=createHmac('sha256',publishKey).update(serial({entry,approval:unsigned})).digest('hex');
   return {entry,approval:{...unsigned,signature}};
 };
 const first=publicRecord(a,'fish'), second=publicRecord(b,'marc');
 const before={schemaVersion:1,entries:[first.entry,second.entry],approvals:[first.approval,second.approval]};
 const current={revision:1,schemaVersion:2,updatedAt:new Date().toISOString(),chapters:[
  {id:'origins',heading:'Origins',passages:[{id:'opening-1',text:'One recollection places it in spring.',sources:[{kind:'record',ref:'owner-notes'}]}]},
  {id:'traditions',heading:'Developing traditions',passages:[
   {id:'account-a',text:'One member recalls Tuesday.',sources:[binding(a,first.approval.contentSha256,'fish')]},
   {id:'account-b',text:'Another member recalls Thursday.',sources:[binding(b,second.approval.contentSha256,'marc')]}]}]};
 const key='fixture-only-history-signing-key-00001';
 const records=new Map([['history-published-private.json',current],['history-bound-ledger-private.json',{schemaVersion:1,privateOpeningPacketSha256:'c'.repeat(64),chapters:current.chapters}]]);
 let live=current,writes=[],html=renderHistory(current)+'\n',archive=before;
 const priorSha='a'.repeat(40),nextSha='b'.repeat(40);
 const hosted=new Map(), withdrawalFiles=new Map(), folder={getName:()=> 'a'.repeat(64)};
 const root={searchFolders:query=>{
   assert.equal(query,"trashed = false and title contains '"+'a'.repeat(24)+"'");
   let read=false;
   return {hasNext:()=>!read,next:()=>{read=true;return folder;}};
 }};
 const props={ANNALS_HISTORY_PUBLICATION_ENABLED:'true',ANNALS_SIGNING_REMEDIATED_AT:new Date().toISOString(),
   ANNALS_HISTORY_SIGNING_KEY:key,ANNALS_PUBLISH_SIGNING_KEY:publishKey};
 const cx=createContext();
 runInContext(production,cx);
 Object.assign(cx,{
  annalsUiCall_:(nonce,fn)=>{if(nonce!=='owner')throw Error('Owner only');return fn();},annalsLocked_:fn=>fn(),
  annalsRoot_:()=>root,annalsPrivate_:value=>value,
  annalsRead_:(r,n)=>snap((r===folder?withdrawalFiles:records).get(n)??null),
  annalsWriteOnce_:(r,n,v)=>{assert.equal(records.has(n),false);records.set(n,snap(v));},
  annalsSavePrivate_:(r,n,v)=>{records.set(n,snap(v));writes.push(n);},
  annalsProps_:()=>({getProperty:k=>props[k]}),annalsHash_:hash,annalsHex_:b=>Buffer.from(b).toString('hex'),
  AnnalsProduction:Production,AnnalsAuto:{sensitiveText:()=>false},AnnalsPublicDisplay:{historyPage:renderHistory},
  Utilities:{Charset:{UTF_8:'UTF_8'},computeHmacSha256Signature:(bytes,k)=>createHmac('sha256',k).update(bytes).digest()},
  UrlFetchApp:{fetch:url=>({getResponseCode:()=>200,getContentText:()=>{
    if(url.endsWith('/history.html'))return html;
    if(url.startsWith('https://api.github.com/'))return JSON.stringify([{sha:nextSha,parents:[{sha:priorSha}]},{sha:priorSha}]);
    const pinned=[nextSha,priorSha].find(sha=>url.includes('/'+sha+'/'));
    if(url.endsWith('/annals-approved.json'))return JSON.stringify(pinned===priorSha?before:archive);
    return JSON.stringify(pinned?hosted.get(pinned):live);
  }})},
  annalsDispatchEvent_:(folder,action,client_payload)=>{
   live=applyHistoryRevision({current:live,event:{action,client_payload},secret:key,enabled:true});
   html=renderHistory(live)+'\n';return true;
  }
 });
 runInContext(source,cx);
 return {cx,records,current,writes,live:()=>live,overtake:(showPredecessor)=>{
   const prior=live;
   archive={schemaVersion:1,entries:[second.entry],approvals:[second.approval],retiredIds:[a]};
   const approvedAt=new Date().toISOString(), proof=cx.annalsPublicRemoval_(first.entry,approvedAt,publishKey);
   withdrawalFiles.set('removal-private.json',{state:'dispatch_accepted',entry:first.entry,approvedAt,proof});
   withdrawalFiles.set('removal-dispatch-private.json',{state:'accepted',at:approvedAt,completedAt:approvedAt});
   live=subtractStaleHistory(prior,archive.entries,archive.approvals,new Date(Date.now()+1000));
   html=renderHistory(live)+'\n';
   hosted.set(priorSha,showPredecessor?prior:current);
   hosted.set(nextSha,live);
 }};
}
test('owner corrects an opening recollection through the actual signed publisher and verifies it live',()=>{
 const f=fixture(),{cx,current,records}=f;
 assert.throws(()=>cx.annalsListHistoryMaintenance('outsider'),/Owner only/);
 const edition=cx.annalsListHistoryMaintenance('owner');
 assert.equal(edition.digest,historyDigest(current));
 const r=cx.annalsPrepareHistoryMaintenance('owner',edition.digest,'origins','opening-1','correct','One recollection places it in early spring.','Owner verified the surviving record.');
 assert.equal(f.live(),current);
 assert.throws(()=>cx.annalsPublishHistoryMaintenance('owner',r.hash,false),/Review the exact change/);
 assert.equal(cx.annalsPublishHistoryMaintenance('owner',r.hash,true).dispatchAccepted,true);
 assert.equal(f.live().schemaVersion,2);
 assert.deepEqual(snap(f.live().chapters[1]),current.chapters[1]);
 assert.deepEqual(snap(f.live().chapters[0].passages[0].sources),current.chapters[0].passages[0].sources);
 assert.equal(cx.annalsReconcileHistory('owner').verified,true);
 assert.equal(records.get('history-published-private.json').revision,2);
});
test('History-only withdrawal removes the selected account and its last credit but preserves a differing recollection',()=>{
 const f=fixture(),{cx,current,records}=f;
 const r=cx.annalsPrepareHistoryMaintenance('owner',historyDigest(current),'traditions','account-a','withdraw','','Member requested withdrawal from History only.');
 assert.equal(cx.annalsPublishHistoryMaintenance('owner',r.hash,true).dispatchAccepted,true);
 assert.equal(cx.annalsReconcileHistory('owner').verified,true);
 assert.deepEqual(snap(f.live().chapters[1].passages),[current.chapters[1].passages[1]]);
 assert.deepEqual(historyCredits(f.live()),[{key:'marc',name:'Marc'}]);
 assert.equal(historyBacklinks(f.live()).has(a),false);
 assert.equal(historyBacklinks(f.live()).has(b),true);
 const originalDigest=current.chapters[1].passages[0].sources[0].digest;
 assert.equal(records.get('history-bound-ledger-private.json').ownerMaintainedSourceVersions[a+':'+originalDigest],true);
 assert.throws(()=>cx.annalsPublishHistoryMaintenance('owner',r.hash,true),/Review the exact change/);
});
test('stale, unsupported-looking or modified previews cannot dispatch',()=>{
 const f=fixture(),{cx,current,records}=f;
 assert.throws(()=>cx.annalsPrepareHistoryMaintenance('owner','bad','origins','opening-1','withdraw','','Recorded withdrawal request.'),/Reload current/);
 assert.throws(()=>cx.annalsPrepareHistoryMaintenance('owner',historyDigest(current),'origins','opening-1','correct','Contact person@example.com','Recorded correction request.'),/safe/);
 const r=cx.annalsPrepareHistoryMaintenance('owner',historyDigest(current),'origins','opening-1','withdraw','','Recorded withdrawal request.');
 records.get('history-maintenance-review-private.json').reason='Altered after preview.';
 assert.throws(()=>cx.annalsPublishHistoryMaintenance('owner',r.hash,true),/altered/);
 assert.equal(f.live(),current);
});

for(const showPredecessor of [false,true]){
 test('an overtaken accepted revision '+(showPredecessor?'is recovered by immutable commit and exact subtraction':'stays pending without historical proof'),()=>{
   const f=fixture(),{cx,records,current}=f;
   const r=cx.annalsPrepareHistoryMaintenance('owner',historyDigest(current),'traditions','account-a','correct','One member remembers an early Tuesday.','Source reviewed by club owner.');
   assert.equal(cx.annalsPublishHistoryMaintenance('owner',r.hash,true).dispatchAccepted,true);
   f.overtake(showPredecessor);
   assert.equal(f.live().revision,3);
   const result=cx.annalsReconcileHistory('owner');
   assert.equal(result.verified,showPredecessor);
   assert.equal(records.get('history-published-private.json').revision,showPredecessor?3:1);
   if(showPredecessor){
     assert.equal(result.superseded,true);
     assert.equal(records.get('history-live-2-private.json').supersededByRevision,3);
     assert.deepEqual(historyCredits(f.live()),[{key:'marc',name:'Marc'}]);
   }else assert.equal(records.get('history-pending-private.json').state,'dispatch_accepted');
 });
}
