import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const crypto=require('node:crypto');
const script=fs.readFileSync(new URL('../../scripts/annals/LivingHistoryIntake.gs',import.meta.url),'utf8');
const fixtures=(opts={})=>{
  const a='a'.repeat(64),root='root',annal='annal-'+a.slice(0,24);
  const span='I remember that we sang after the year-end gathering.';
  const chapter={id:'origins',heading:'Origins',passages:[{id:'opening-1',text:'Existing unaffected prose.',sources:[{kind:'record',ref:'club-record'}]}]};
  const shot={schemaVersion:2,revision:1,chapters:[chapter],updatedAt:'2026-01-01T00:00:00Z'};
  const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
  const entry={id:annal,title:'Fictional entry',summary:opts.hidden?'A different already public statement.':span,contributorPortrait:'fish'};
  const version=hash(JSON.stringify(entry));
  const key='test-only-signature';
  const candidate={chapter:'traditions',topic:'singing-tradition',kind:'recollection',field:'excerpt',period:'',span,editorialFrame:opts.frame||'recollection'};
  const records=new Map([
    [root+'/history-published-private.json',shot],
    [root+'/history-bound-ledger-private.json',{schemaVersion:1,privateOpeningPacketSha256:'b'.repeat(64)}],
    [a+'/draft-private.json',{category:'cocktail',riskFlags:[],interpretation:{intent:'anecdote'},historyCandidates:[candidate]}],
    [a+'/source-private.json',{senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,source:{excerpt:span}}],
    [a+'/approval-private.json',{entry,publicationState:'dispatch_accepted',publication:{signature:key},receipt:{contentSha256:version}}]]);
  const archive={entries:[entry],approvals:[{entryId:entry.id,signature:opts.mismatched?'different':key,contentSha256:version,consents:{publication:true,namedAttribution:true}}]};
  const events=[];let live=shot,main=null;
  const cx=vm.createContext({
    annalsProps_:()=>({getProperty:()=>opts.disabled?'false':'true'}),
    annalsRoot_:()=>root,annalsRead_:(f,n)=>records.get(f+'/'+n),
    annalsSavePrivate_:(f,n,d)=>records.set(f+'/'+n,d),annalsFile_:(f,n)=>records.has(f+'/'+n),
    annalsOrdinaryPublicationAllowed_:()=>!opts.revoked,annalsOrdinarySourceGate_:()=>{},
    annalsPrivateReceiptValid_:()=>true,annalsContributorPortrait_:()=>opts.anonymous?null:'fish',
    annalsOpeningArchive_:()=>archive,annalsReconcileHistoryLocked_:()=>({verified:false}),
    AnnalsPublicDisplay:{historyPage:v=>'rendered-'+v.revision},annalsHash_:hash,AnnalsProduction:{serial:JSON.stringify},
    AnnalsAuto:{sensitiveText:()=>false},
    UrlFetchApp:{fetch:url=>({getResponseCode:()=>200,getContentText:()=>url.endsWith('/history.html')?'rendered-'+live.revision+'\n':JSON.stringify(url.includes('githubusercontent')?(main||live):live)})},
    annalsDispatchHistoryRevision_:(...args)=>{events.push(args);records.set(root+'/history-pending-private.json',{state:'dispatch_accepted'});return {dispatchAccepted:true};}
  });
  vm.runInContext(script,cx);
  return {a,records,events,root,shot,archive,entry,version,
    setLive:(value,mainValue)=>{live=value;main=mainValue;},
    tick:()=>{const state={dispatched:false,archive:null};cx.annalsHistoryTickReconcile_(state);return state;},
    run:()=>{const state={dispatched:false,archive:null};cx.annalsHistoryTickReconcile_(state);return cx.annalsHistoryIntakeFolder_(a,a,state);}
  };
};
test('one real version-bound input dispatches only a focused History projection and never dispatches twice',()=>{
  const f=fixtures();assert.equal(f.run(),true);assert.equal(f.run(),false);
  assert.equal(f.events.length,1);
  const chapters=f.events[0][4];
  assert.equal(chapters[0],f.shot.chapters[0]);
  assert.equal(chapters[1].passages[0].sources[0].portrait,'fish');
  assert.match(chapters[1].passages[0].text,/Justin recalls/);
});
test('disable, private-only spans, revoked standing permission or stale receipt never sign',()=>{
  for(const opts of [{disabled:true},{hidden:true},{revoked:true},{mismatched:true}]){
    const f=fixtures(opts);assert.equal(f.run(),false);assert.equal(f.events.length,0);
  }
});
test('an authorized anonymous source contributes without naming or a portrait',()=>{
  const f=fixtures({anonymous:true});assert.equal(f.run(),true);
  const p=f.events[0][4][1].passages[0];
  assert.match(p.text,/A member recalls/);assert.equal(p.sources[0].portrait,null);
});

test('ordinary Annals subtraction projects only the lost source, leaving the other credit',()=>{
  const mock=vm.createContext({});
  vm.runInContext(script,mock);
  const a='annal-'+'a'.repeat(24), b='annal-'+'b'.repeat(24),digest='c'.repeat(64);
  const entrySource=(entryId,portrait)=>({kind:'annal',entryId,digest,portrait,label:'Source'});
  const p=(id,text,src)=>({id,text,sources:[src]});
  const before={schemaVersion:2,revision:1,updatedAt:'2026-01-01T00:00:00.000Z',chapters:[
    {id:'traditions',heading:'Developing traditions',passages:[
      p('account-a','One member recalls Tuesday.',entrySource(a,'fish')),
      p('account-b','Another member recalls Thursday.',entrySource(b,'marc'))]}]};
  const after=mock.annalsPredictHistorySubtraction_(before,[{id:b,contributorPortrait:'marc'}],
    [{entryId:b,contentSha256:digest,consents:{namedAttribution:true}}],new Date('2026-01-02T00:00:00Z'));
  assert.equal(after.revision,2);
  assert.equal(after.chapters[0].passages.length,1);
  assert.equal(after.chapters[0].passages[0],before.chapters[0].passages[1]);
});

test('the model editorial frame writes a bounded Club-voice line without changing the recollection',()=>{
  const f=fixtures({frame:'club_record'});
  assert.equal(f.run(),true);
  assert.equal(f.events[0][4][1].passages[0].text,'As Justin remembers it, we sang after the year-end gathering.');
});
test('an unrecognised frame cannot supply facts, names or unrestricted editorial wording',()=>{
  const f=fixtures({frame:'The event took place in 1998.'});
  assert.equal(f.run(),true);
  assert.equal(f.events[0][4][1].passages[0].text,'Justin recalls: I remember that we sang after the year-end gathering.');
});

for(const mode of ['correction','withdrawal']){
  test('the production intake tick rebases a '+mode+' without a draft or a second dispatch',()=>{
    const f=fixtures();
    const b='annal-'+'b'.repeat(24),otherDigest='b'.repeat(64);
    const aPass={id:'claim-'+'a'.repeat(24),text:'Justin remembers Tuesday.',
      sources:[{kind:'annal',entryId:f.entry.id,digest:'d'.repeat(64),label:'Source',portrait:'fish'}]};
    const bPass={id:'claim-'+'b'.repeat(24),text:'Marc remembers Thursday.',
      sources:[{kind:'annal',entryId:b,digest:otherDigest,label:'Source',portrait:'marc'}]};
    const chapter={id:'traditions',heading:'Developing traditions',passages:[aPass,bPass]};
    f.shot.chapters.push(chapter);
    const fresh=f.records.get(f.a+'/draft-private.json');
    f.records.delete(f.a+'/draft-private.json');
    f.records.set(f.a+'/history-intake-seen-private.json',{contentSha256:'d'.repeat(64)});
    if(mode==='withdrawal'){
      f.records.set(f.a+'/removal-private.json',{});
      f.archive.approvals.length=0;
      f.archive.entries.length=0;
    }else{
      f.records.set(f.a+'/correction-approval-private.json',f.records.get(f.a+'/approval-private.json'));
    }
    f.archive.entries.push({id:b,contributorPortrait:'marc'});
    f.archive.approvals.push({entryId:b,contentSha256:otherDigest,consents:{publication:true,namedAttribution:true}});
    const live={...f.shot,revision:2,updatedAt:'2026-01-02T00:00:00.000Z',chapters:[f.shot.chapters[0],{...chapter,passages:[bPass]}]};
    f.setLive(live,f.shot);
    assert.equal(f.tick().historySynced,false);
    assert.equal(f.records.get(f.root+'/history-published-private.json').revision,1);
    f.setLive(live);
    assert.equal(f.run(),false);
    assert.equal(f.events.length,0);
    assert.deepEqual(JSON.parse(JSON.stringify(f.records.get(f.root+'/history-published-private.json'))),live);
    assert.deepEqual(JSON.parse(JSON.stringify(f.records.get(f.root+'/history-bound-ledger-private.json').chapters)),live.chapters);
  });
}
