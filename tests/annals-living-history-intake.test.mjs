import assert from 'node:assert/strict';
import {createHash, createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import {historyBacklinks, historyCredits, subtractStaleHistory} from '../scripts/annals/BoundHistory.mjs';
import {applyHistoryRevision, renderHistory} from '../scripts/annals/HistoryPublisher.mjs';

const modules=['PilotCore.js','ProductionCore.js','AutoCore.js','Production.gs','HistoryProduction.gs','LivingHistoryIntake.gs']
  .map(name=>[name,readFileSync(new URL('../scripts/annals/'+name,import.meta.url),'utf8')]);
const sha=text=>createHash('sha256').update(text).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const at='2026-11-20T21:00:00.000Z';
const recall='I remember that we sang after the year-end gathering.';
const second='I remember that we sang before the year-end gathering.';
const topic='year-end-gathering-song';
const chapterIds=['origins','gatherings','assemblies','traditions'];
const portraits=['fish','marc','matt','ken','jamie','jerome'];
const candidate=(span=recall,overrides={})=>({chapter:'traditions',topic,kind:'recollection',
  field:'excerpt',span,period:'',editorialFrame:'club_record',...overrides});

function fixture({disabled=false,rejected=false}={}){
  const opening={schemaVersion:2,revision:1,updatedAt:at,chapters:chapterIds.map(id=>({
    id,heading:'Opening '+id,passages:[{id:'opening-1',text:'Existing opening prose about '+id+'.',
      sources:[{kind:'record',ref:'opening-record'}]}]}))};
  let live=opening, main=opening;
  const events=[], archive={entries:[],approvals:[]}, rootFiles=new Map(), folders=new Map();
  const members={}, addresses=portraits.map((_,i)=>'member'+i+'@example.test');
  for(const address of addresses)members[address]={
    status:'active',scope:'future_text_ai_drafting',consentedAt:'2026-10-01T00:00:00Z',
    autoPublication:{status:'active',scope:'future_source_grounded_text_publication',consentedAt:'2026-10-01T00:00:00Z'},
    contributorPortraitPublication:{status:'active',scope:'future_illustrated_contributor_identification',consentedAt:'2026-10-01T00:00:00Z'}
  };
  const props={
    ANNALS_HISTORY_PUBLICATION_ENABLED:disabled?'false':'true',
    ANNALS_AUTO_PUBLICATION_ENABLED:'true',ANNALS_SIGNING_REMEDIATED_AT:at,
    ANNALS_HISTORY_SIGNING_KEY:'offline fictional History key only',
    ANNALS_PUBLISH_SIGNING_KEY:'offline fictional publishing key only',
    ANNALS_APPROVAL_KEY:'offline fictional private approval key only',
    ANNALS_ALLOWED_SENDERS:addresses.join(','),
    ANNALS_SPEAKER_IDENTITIES:JSON.stringify(Object.fromEntries(addresses.map((address,i)=>[address,portraits[i]])))
  };
  rootFiles.set('consent-registry-private.json',{schemaVersion:1,members});
  rootFiles.set('history-published-private.json',opening);
  rootFiles.set('history-bound-ledger-private.json',{schemaVersion:1,privateOpeningPacketSha256:'b'.repeat(64),chapters:opening.chapters});
  const root={files:rootFiles,getFolders:()=>{
    const values=[...folders.values()];let index=0;
    return {hasNext:()=>index<values.length,next:()=>values[index++]};
  }};
  const cx=vm.createContext({
    Date:class extends Date{constructor(...args){super(...(args.length?args:[at]));}static now(){return Date.parse(at);}},
    AnnalsPublicDisplay:{historyPage:renderHistory},
    Utilities:{Charset:{UTF_8:'UTF-8'},computeHmacSha256Signature:(text,key)=>createHmac('sha256',key).update(text).digest()},
    UrlFetchApp:{fetch:url=>{
      const body=url.includes('annals-approved.json')?JSON.stringify(archive):
        url.endsWith('/history.html')?renderHistory(live)+'\n':
        url.includes('club-history.json')?JSON.stringify(url.includes('githubusercontent')?main:live):null;
      if(body===null)throw Error('Unexpected offline fetch');
      return {getResponseCode:()=>200,getContentText:()=>body};
    }}
  });
  for(const [name,code] of modules)vm.runInContext(code,cx,{filename:name});
  Object.assign(cx,{
    annalsHash_:sha,annalsHex_:bytes=>bytes.toString('hex'),
    annalsRoot_:()=>root,annalsFolder_:id=>folders.get(id),annalsPrivate_:value=>value,
    annalsProps_:()=>({getProperty:name=>props[name],deleteProperty:name=>delete props[name]}),
    annalsRead_:(f,name)=>f.files.get(name),annalsFile_:(f,name)=>f.files.has(name),
    annalsSavePrivate_:(f,name,value)=>f.files.set(name,value),
    annalsWriteOnce_:(f,name,value)=>{assert.equal(f.files.has(name),false);f.files.set(name,value);},
    annalsDispatchEvent_:(f,action,client_payload)=>{events.push({action,client_payload});return !rejected;}
  });
  const serial=cx.AnnalsProduction.serial;
  function add(i,{span=recall,category='cocktail',claims=[candidate(span)],subject='A club recollection',excerpt=span}={}){
    const id=String(i+1).repeat(64), entryId='annal-'+id.slice(0,24), files=new Map(), member=members[addresses[i]];
    folders.set(id,{files,getName:()=>id});
    const source={sourceId:id,senderAuthenticated:true,clubMemberAuthenticated:true,externalContributionAtReceipt:false,
      aiConsentActive:true,autoConsentAtReceipt:true,source:{sender:addresses[i],subject,excerpt,receivedAt:at}};
    const recipe=category==='cocktail'?{drinkIngredients:['1 oz fixture ingredient'],syrupIngredients:[],steps:['Stir the fixture drink.']}:
      {drinkIngredients:[],syrupIngredients:[],steps:[]};
    const draft={category,title:subject,summary:span,recipe,riskFlags:[],interpretation:{intent:'anecdote'},historyCandidates:claims};
    files.set('source-private.json',source);
    files.set('draft-private.json',draft);
    files.set('auto-live-verification-private.json',{state:'verified_live'});
    function approve(text,corrected=false){
      const entry={id:entryId,category,title:'A recollection in the Annals',summary:text,year:2026,dateLabel:'',
        sortDate:'',quoteVerbatim:'',recipe,credit:'Club member',contributorPortrait:portraits[i]};
      const receipt={entryId,approvedAt:at,reviewedBy:corrected?'fictional-owner':'standing-consent-automation-v1',
        consents:{publication:true,namedAttribution:true,photoPublication:false,quotePublication:false,recipeVerified:category==='cocktail'},
        contentSha256:sha(serial(entry))};
      receipt.signature=createHmac('sha256',props.ANNALS_APPROVAL_KEY).update(serial({entry,receipt})).digest('hex');
      const publication=plain(cx.annalsPublicApproval_(entry,receipt,props.ANNALS_PUBLISH_SIGNING_KEY));
      const saved={entry,receipt,publication,publicationState:'dispatch_accepted',approvalMode:publication.mode};
      files.set(corrected?'correction-approval-private.json':'approval-private.json',saved);
      const index=archive.entries.findIndex(e=>e.id===entryId);
      const offset=index<0?archive.entries.length:index;
      archive.entries[offset]=plain(entry);archive.approvals[offset]=plain(publication);
      return saved;
    }
    const approved=approve(span);
    function withdraw(){
      files.set('removal-private.json',{state:'dispatch_accepted'});
      const index=archive.entries.findIndex(e=>e.id===entryId);
      archive.entries.splice(index,1);archive.approvals.splice(index,1);
    }
    return {id,entryId,files,source,draft,member,approved,approve,withdraw};
  }
  const f={opening,rootFiles,archive,events,cx,props,add,
    signed:()=>events.at(-1).client_payload.document,
    tick:()=>cx.annalsVerifyAutomaticPublications_(3),
    serveNext:()=>{
      main=applyHistoryRevision({current:main,event:events.at(-1),secret:props.ANNALS_HISTORY_SIGNING_KEY,enabled:true,now:new Date(at)});
      live=main;
    },
    subtract:(serveMain=true)=>{
      live=subtractStaleHistory(live,archive.entries,archive.approvals,new Date(at));
      if(serveMain)main=live;
      return live;
    },
    serveMain:()=>{main=live;}
  };
  return f;
}
const passages=(document,chapter='traditions')=>document.chapters.find(c=>c.id===chapter).passages;
const keys=document=>historyCredits(document).map(x=>x.key);

test('the ordinary assessment extracts across categories while optional malformed claims leave recipe and Annals fields intact',()=>{
  const f=fixture(), core=f.cx.AnnalsProduction;
  const basic=core.request(recall,[]);
  const withHistory=core.request(recall,[],true);
  assert.deepEqual(plain(withHistory.input),plain(basic.input));
  assert.equal(withHistory.model,basic.model);
  assert.equal(withHistory.max_output_tokens,basic.max_output_tokens);
  assert.equal(basic.text.format.schema.properties.historyCandidates,undefined);
  assert.ok(withHistory.text.format.schema.required.includes('historyCandidates'));
  for(const category of ['cocktail','assembly','club_history','monthly_gathering','artefact','miscellany']){
    const item=fixture(), input=item.add(0,{category});
    const response={...input.draft,eventDate:'',quoteVerbatim:'',
      imageSafety:{kind:'none',safeToPublish:false,altText:''},
      interpretation:{intent:'anecdote',speakerId:'unknown',evidenceField:'body'},
      historyCandidates:[input.draft.historyCandidates[0],{chapter:'bogus'}]};
    const clean=core.candidate(response,false);
    assert.equal(clean.historyCandidates.length,1,category);
    assert.deepEqual(plain(clean.recipe),input.draft.recipe,category);
    item.tick();
    assert.equal(item.events.length,1,category);
    assert.equal(passages(item.signed()).at(-1).text,'As Justin remembers it, we sang after the year-end gathering.');
  }
});

test('the existing intake and signer change one chapter per revision and reconcile without duplicates',()=>{
  const f=fixture(), item=f.add(0,{claims:[candidate(),candidate(recall,{chapter:'gatherings'}),candidate(recall,{topic:'duplicate-topic'})]});
  const immutable=plain([...item.files]);
  f.tick(); f.tick();
  assert.equal(f.events.length,1);
  assert.deepEqual(plain(f.signed().chapters.slice(0,3)),f.opening.chapters.slice(0,3));
  assert.equal(passages(f.signed()).length,2);
  assert.doesNotMatch(JSON.stringify(f.events),/example\.test|claimTopics|year-end-gathering-song|openingPacket/i);
  f.serveNext(); f.tick();
  assert.equal(f.events.length,2);
  assert.equal(passages(f.signed(),'gatherings').length,2);
  assert.deepEqual(plain(passages(f.signed())),plain(passages(f.events[0].client_payload.document)));
  f.serveNext(); f.tick(); f.tick();
  assert.equal(f.events.length,2);
  assert.deepEqual(plain([...item.files]),immutable);
  assert.equal(f.rootFiles.get('history-pending-private.json').state,'verified_live');
});

test('independent conflicting memories sharing a topic sit together and retain separate provenance and active credits',()=>{
  const f=fixture(), first=f.add(0);
  f.tick(); f.serveNext();
  f.add(1,{span:'I remember that we folded the table linen together.',claims:[
    candidate('I remember that we folded the table linen together.',{topic:'table-linen'})]});
  f.tick(); f.serveNext();
  const other=f.add(2,{span:second});
  f.add(3,{span:'We set the table before the gathering.',claims:[]});
  f.tick();
  const doc=f.signed(), related=passages(doc).slice(1);
  assert.match(related[0].text,/sang after/);
  assert.match(related[1].text,/sang before/);
  assert.match(related[2].text,/table linen/);
  assert.notEqual(related[0].id,related[1].id);
  assert.equal(related[0].sources[0].entryId,first.entryId);
  assert.equal(related[1].sources[0].entryId,other.entryId);
  assert.deepEqual(keys(doc),['fish','marc','matt']);
  assert.equal(historyBacklinks(doc).get(other.entryId).size,1);
});

test('corrected and withdrawn signed Annals sources reconcile exactly without altering unrelated chapters or records',()=>{
  const f=fixture(), item=f.add(0,{excerpt:recall+' '+second,claims:[candidate(),candidate(second)]});
  f.tick(); f.serveNext(); f.tick();
  const originals=plain([...item.files]);
  item.approve(second,true);
  const sub=f.subtract(false);
  f.tick(); // A site result that disagrees with main cannot advance the ledger or sign.
  assert.equal(f.events.length,1);
  assert.equal(f.rootFiles.get('history-published-private.json').revision,2);
  f.serveMain(); f.tick();
  assert.equal(f.events.length,2);
  assert.equal(f.signed().revision,sub.revision+1);
  assert.deepEqual(plain(f.signed().chapters.slice(0,3)),f.opening.chapters.slice(0,3));
  assert.match(passages(f.signed()).at(-1).text,/sang before/);
  assert.equal(passages(f.signed()).at(-1).sources[0].digest,f.archive.approvals[0].contentSha256);
  f.serveNext(); f.tick();
  item.withdraw();
  const withdrawn=f.subtract();
  f.tick(); f.tick();
  assert.equal(f.events.length,2);
  assert.deepEqual(keys(withdrawn),[]);
  assert.deepEqual(plain(withdrawn.chapters),f.opening.chapters);
  assert.deepEqual(plain([...item.files].slice(0,originals.length)),originals);
  assert.equal(historyBacklinks(withdrawn).has(item.entryId),false);
});

test('a portrait revocation removes the last artwork and attribution, and standing text revocation removes the recollection',()=>{
  const f=fixture(), item=f.add(0);
  f.tick(); f.serveNext(); f.tick();
  item.member.contributorPortraitPublication.revokedAt=at;
  f.tick();
  assert.equal(f.events.length,2);
  assert.deepEqual(keys(f.signed()),[]);
  assert.match(passages(f.signed()).at(-1).text,/As one member remembers it/);
  f.serveNext(); f.tick();
  item.member.autoPublication.revokedAt=at;
  f.tick();
  assert.equal(f.events.length,3);
  assert.deepEqual(plain(f.signed().chapters),f.opening.chapters);
});

test('unsafe, unsupported, staged, altered, conflicting or revoked evidence cannot sign a History addition',()=>{
  const cases=[
    ['feature disabled',({f})=>f.props.ANNALS_HISTORY_PUBLICATION_ENABLED='false'],
    ['unreconciled opening ledger',({f})=>f.rootFiles.get('history-bound-ledger-private.json').chapters=[]],
    ['authenticated sender required',({item})=>item.source.senderAuthenticated=false],
    ['nonmember',({item})=>item.source.clubMemberAuthenticated=false],
    ['mismatched source identity',({item})=>item.source.sourceId='c'.repeat(64)],
    ['synthetic flag',({item})=>item.source.syntheticFixture=true],
    ['staged example framing',({item})=>item.source.source.subject='This is a hypothetical test fixture.'],
    ['clipped clause',({item})=>item.source.source.excerpt='Whether or not '+recall],
    ['fictional span',({item})=>item.source.source.excerpt='For example: '+recall],
    ['forward context',({item})=>item.source.source.excerpt='From: Another person\n'+recall],
    ['source not in signed copy',({item})=>item.approve('A different recollection in the public record.')],
    ['reported speech',({item})=>item.draft.interpretation.intent='reported_speech'],
    ['protected CoL',({item})=>item.source.source.subject='Could we change the Celebration of Life rules?'],
    ['source truncated',({item})=>item.source.source.sourceTruncated=true],
    ['private signed approval altered',({item})=>item.approved.receipt.signature='b'.repeat(64)],
    ['public receipt edited under the same signature',({f})=>f.archive.approvals[0].consents.namedAttribution=false],
    ['archive digest disagreement',({f})=>f.archive.approvals[0].contentSha256='b'.repeat(64)],
    ['quarantined',({item})=>item.files.set('quarantine-private.json',{})],
    ['owner-maintained source',({f,item})=>f.rootFiles.get('history-bound-ledger-private.json').ownerMaintainedSourceVersions={
      [item.entryId+':'+item.approved.receipt.contentSha256]:true}],
    ['standing consent revoked',({item})=>item.member.autoPublication.revokedAt=at],
    ['withdrawn',({item})=>item.withdraw()]
  ];
  for(const [reason,edit] of cases){
    const f=fixture(), item=f.add(0);
    edit({f,item});
    f.tick();
    assert.equal(f.events.length,0,reason);
    assert.equal(f.rootFiles.has('history-pending-private.json'),false,reason);
  }
});

test('an uncertain dispatch has one attempt and leaves the verified opening in place',()=>{
  const f=fixture({rejected:true});f.add(0);
  f.tick(); f.tick(); f.tick();
  assert.equal(f.events.length,1);
  assert.equal(f.rootFiles.get('history-pending-private.json').state,'uncertain_or_rejected_no_retry');
  assert.equal(f.rootFiles.get('history-published-private.json'),f.opening);
});
