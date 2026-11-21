import { readFileSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import vm from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyHistoryRevision, emptyHistory, renderHistory } from '../../scripts/annals/HistoryPublisher.mjs';

const adapter=readFileSync(new URL('../../scripts/annals/HistoryProduction.gs',import.meta.url),'utf8');
const at='2026-11-21T17:00:00.000Z';
const canon=x=>Array.isArray(x)?x.map(canon):x&&typeof x==='object'?Object.fromEntries(
  Object.keys(x).sort().map(k=>[k,canon(x[k])])):x;
const serial=x=>JSON.stringify(canon(x));
const digest=x=>createHash('sha256').update(x).digest('hex');
const fixture=(options={})=>{
  const today=emptyHistory(), store=new Map(), sources=new Map(), events=[];
  const key='fictional test-only History authority'.repeat(2);
  const chapters=[{id:'gatherings',heading:'Gathering together',passages:[
    {id:'opening-1',text:'Marc remembers serving a fictional fixture drink.'}]}];
  const id='a'.repeat(64), entryId='annal-'+id.slice(0,24);
  const archive={entries:[{id:entryId,contributorPortrait:'marc'}],approvals:[]};
  archive.approvals.push({entryId,contentSha256:digest(serial(archive.entries[0])),
    consents:{publication:true,namedAttribution:true}});
  const packet={schemaVersion:1,chapters,annals:{[entryId]:id},
    records:Object.fromEntries(['naming-recollection','standing-date-recollection','cottage-recollection',
      'christisch-recollection','fictional-record'].map(k=>[k,{locator:'private-pointer-'+k,reviewedMeaning:'fixture-only'}]))};
  store.set('history-opening-authorized-private.json',packet);
  sources.set(id,{source:{sender:'private@example.test',receivedAt:at},senderAuthenticated:true});
  let publicHistory=today, tick=new Date(at);
  const props={ANNALS_HISTORY_PUBLICATION_ENABLED:'true',ANNALS_SIGNING_REMEDIATED_AT:at,ANNALS_HISTORY_SIGNING_KEY:key};
  const c=vm.createContext({
    Date:class extends Date{constructor(...a){super(...(a.length?a:[tick.toISOString()]));}},
    Utilities:{Charset:{UTF_8:'UTF-8'},computeHmacSha256Signature:(message,key)=>createHmac('sha256',key).update(message).digest()},
    AnnalsProduction:{serial},AnnalsPublicDisplay:{historyPage:renderHistory},annalsHash_:digest,
    annalsHex_:b=>b.toString('hex'),
    annalsRoot_:()=> 'private',annalsProps_:()=>({getProperty:k=>props[k]}),
    annalsFolder_:value=>{if(value!==id)throw Error('Bad source binding');return value;},
    annalsRead_:(f,n)=>f===id?(n==='source-private.json'?sources.get(f):undefined):store.get(n),
    annalsFile_:()=>false,annalsConsentActive_:()=>!options.revoked,
    annalsStandingPublicationActive_:()=>!options.revoked,
    annalsContributorPortrait_:()=>options.portraitRevoked?null:'marc',
    annalsOrdinarySourceGate_:x=>{if(!x.senderAuthenticated)throw Error('Unauthenticated fixture');},
    annalsUiCall_:(nonce,fn)=>{if(nonce!=='owner')throw Error('Not owner');return fn();},
    annalsLocked_:fn=>fn(),
    annalsWriteOnce_:(f,n,v)=>{if(store.has(n))throw Error('Already exists');store.set(n,v);},
    annalsSavePrivate_:(f,n,v)=>store.set(n,v),
    annalsDispatchEvent_:(f,action,payload)=>{events.push({action,client_payload:payload});return !options.dispatchFailed;},
    UrlFetchApp:{fetch:url=>({getResponseCode:()=>200,getContentText:()=>url.endsWith('annals-approved.json')?
      JSON.stringify(archive):url.endsWith('history.html')?renderHistory(publicHistory)+'\n':JSON.stringify(publicHistory)})}
  });
  vm.runInContext(adapter,c);
  c.ANNALS_HISTORY_OPENING_COPY_SHA_=digest(serial(chapters));
  c.ANNALS_HISTORY_OPENING_SOURCES_={'gatherings/opening-1':[
    ['record','fictional-record'],['annal',entryId,'Fixture drink','marc']]};
  c.ANNALS_HISTORY_OPENING_ANNALS_SHA_={[entryId]:archive.approvals[0].contentSha256};
  const readback=()=>{publicHistory=applyHistoryRevision({current:today,event:events[0],secret:key,enabled:true,now:tick});};
  return {c,archive,packet,events,props,store,readback};
};

test('opening signed via the existing owner-only route; ledger advances only after exact served bytes',()=>{
  const f=fixture(),c=f.c;
  assert.throws(()=>c.annalsPreviewHistoryOpening('other'),/Not owner/);
  const p=c.annalsPreviewHistoryOpening('owner');
  assert.equal(p.portraitCount,1);
  assert.equal(p.chapterCount,1);
  assert.equal(c.annalsPublishHistoryOpening('owner',p.previewDigest,true).dispatchAccepted,true);
  assert.doesNotMatch(JSON.stringify(f.events),/private@example|private-pointer|fixture-only|privateOpeningPacket/);
  assert.equal(c.annalsReconcileHistory('owner').verified,false);
  assert.equal(f.store.has('history-bound-ledger-private.json'),false);
  assert.throws(()=>c.annalsPublishHistoryOpening('owner',p.previewDigest,true),/Prior history dispatch/);
  f.readback();
  assert.equal(c.annalsReconcileHistory('owner').verified,true);
  assert.equal(f.store.get('history-published-private.json').revision,1);
  assert.equal(f.store.get('history-bound-ledger-private.json').chapters.length,1);
  assert.throws(()=>c.annalsPublishHistoryOpening('owner',p.previewDigest,true),/expected revision/);
  assert.equal(f.events.length,1);
});

test('opening catches altered copy, changed signed source, rights loss and missing private provenance',()=>{
  const inputs=[
    [f=>f.packet.chapters[0].passages[0].text+=' Altered.',/altered approved opening/],
    [f=>f.archive.approvals[0].contentSha256='b'.repeat(64),/provenance or permission/],
    [f=>f.archive.approvals[0].consents.namedAttribution=false,/provenance or permission/],
    [f=>delete f.packet.records['cottage-recollection'],/Missing opening recollection/],
    [f=>delete f.packet.records['fictional-record'],/documentary provenance/]
  ];
  for(const [edit,error] of inputs){
    const f=fixture(); edit(f);
    assert.throws(()=>f.c.annalsPreviewHistoryOpening('owner'),error);
    assert.equal(f.events.length,0);
  }
  for(const options of [{revoked:true},{portraitRevoked:true}]){
    const f=fixture(options);
    assert.throws(()=>f.c.annalsPreviewHistoryOpening('owner'),/provenance or permission/);
    assert.equal(f.events.length,0);
  }
});

test('opening obeys existing release readiness and an unconfirmed dispatch is never replayed',()=>{
  const f=fixture({dispatchFailed:true}), c=f.c;
  const p=c.annalsPreviewHistoryOpening('owner');
  assert.throws(()=>c.annalsPublishHistoryOpening('owner',p.previewDigest,false),/not confirmed/);
  assert.throws(()=>c.annalsPublishHistoryOpening('owner','other',true),/Reviewed opening changed/);
  f.props.ANNALS_HISTORY_PUBLICATION_ENABLED='false';
  assert.throws(()=>c.annalsPublishHistoryOpening('owner',p.previewDigest,true),/signing remediation/);
  assert.equal(f.events.length,0);
  f.props.ANNALS_HISTORY_PUBLICATION_ENABLED='true';
  assert.equal(c.annalsPublishHistoryOpening('owner',p.previewDigest,true).dispatchAccepted,false);
  assert.equal(c.annalsReconcileHistory('owner').verified,false);
  assert.throws(()=>c.annalsPublishHistoryOpening('owner',p.previewDigest,true),/Prior history dispatch/);
  assert.equal(f.events.length,1);
});
