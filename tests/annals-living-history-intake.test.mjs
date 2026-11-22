import assert from 'node:assert/strict';
import {createHash, createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import {historyBacklinks, historyCredits, subtractStaleHistory} from '../scripts/annals/BoundHistory.mjs';
import {applyHistoryRevision, renderHistory} from '../scripts/annals/HistoryPublisher.mjs';

const modules=['PilotCore.js','ProductionCore.js','AutoCore.js','Production.gs','HistoryProduction.gs','HistoryNarrative.js','LivingHistoryIntake.gs']
  .map(name=>[name,readFileSync(new URL('../scripts/annals/'+name,import.meta.url),'utf8')]);
const sha=text=>createHash('sha256').update(text).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const at='2026-11-20T21:00:00.000Z';
const recall='I remember that we sang after the year-end gathering.';
const second='I remember that we sang before the year-end gathering.';
const lamps='The lamps were still burning as the furniture was put away.';
const chapterIds=['origins','gatherings','assemblies','traditions'];
const portraits=['fish','marc','matt','ken','jamie','jerome'];
const claim=(id,span,order)=>({id,field:'excerpt',span,order,dispute:'',variant:'',uncertain:false,poignant:false});
function proposal(span=recall,{chapter='traditions',extra=false}={}){
  const spoken=span===second?'One account places the singing before the company assembled.':
    'One account places the company’s singing after the gathering.';
  const fact=(text,id)=>({kind:'record',text,claims:[id]});
  const claims=[claim('singing',span,1),claim('lamps',lamps,2)];
  const paragraphs=[[fact(spoken,'singing'),fact('The lamps stayed lit during the clearing of the room.','lamps')]];
  if(extra){
    claims.push(claim('closing',extra,3));
    paragraphs.push([fact('The lights were still alight when the furniture was moved.','lamps'),
      fact('The record also places the signing of the inventory at the close of the evening.','closing')]);
  }
  return {chapter,claims,paragraphs};
}
const completion=raw=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(raw)}]}]});

function fixture({disabled=false,rejected=false}={}){
  const opening={schemaVersion:2,revision:1,updatedAt:at,chapters:chapterIds.map(id=>({
    id,heading:'Opening '+id,passages:[{id:'opening-1',text:'Existing opening prose about '+id+'.',
      sources:[{kind:'record',ref:'opening-record'}]}]}))};
  let live=opening, main=opening, failOnSave;
  const events=[], archive={entries:[],approvals:[]}, rootFiles=new Map(), folders=new Map(), publications=[], providerRequests=[];
  let providerResponse;
  function recordMain(value){
    main=value;
    publications.unshift({sha:sha('fictional release '+publications.length).slice(0,40),
      document:plain(value),archive:plain(archive)});
  }
  recordMain(opening);
  const members={}, addresses=portraits.map((_,i)=>'member'+i+'@example.test');
  for(const address of addresses)members[address]={
    status:'active',scope:'future_text_ai_drafting',consentedAt:'2026-10-01T00:00:00Z',
    autoPublication:{status:'active',scope:'future_source_grounded_text_publication',consentedAt:'2026-10-01T00:00:00Z'},
    contributorPortraitPublication:{status:'active',scope:'future_illustrated_contributor_identification',consentedAt:'2026-10-01T00:00:00Z'}
  };
  const props={
    ANNALS_HISTORY_PUBLICATION_ENABLED:disabled?'false':'true',
    ANNALS_AUTO_PUBLICATION_ENABLED:'true',ANNALS_SIGNING_REMEDIATED_AT:at,
    ANNALS_AI_ENABLED:'true',ANNALS_OPENAI_API_KEY:'offline provider stub',
    ANNALS_GITHUB_TOKEN_EXPIRES_AT:'2026-12-31T00:00:00Z',
    ANNALS_BUDGET_LEDGER:JSON.stringify({schemaVersion:1,month:'2026-11',reservedCents:0}),
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
    Utilities:{Charset:{UTF_8:'UTF-8'},formatDate:()=>'2026-11',
      computeHmacSha256Signature:(text,key)=>createHmac('sha256',key).update(text).digest()},
    UrlFetchApp:{fetch:(url,options)=>{
      if(url==='https://api.openai.com/v1/responses'){
        assert.ok(providerResponse,'unexpected provider attempt');
        providerRequests.push(JSON.parse(options.payload));
        return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(providerResponse)};
      }
      const pinned=publications.find(record=>url.includes('/'+record.sha+'/'));
      const body=url.startsWith('https://api.github.com/')?
        JSON.stringify(publications.slice(0,Number(new URL(url).searchParams.get('per_page'))).map(({sha})=>({sha}))):
        url.includes('annals-approved.json')?JSON.stringify(pinned?pinned.archive:archive):
        url.endsWith('/history.html')?renderHistory(live)+'\n':
        url.includes('club-history.json')?JSON.stringify(pinned?pinned.document:url.includes('githubusercontent')?main:live):null;
      if(body===null)throw Error('Unexpected offline fetch');
      return {getResponseCode:()=>200,getContentText:()=>body};
    }}
  });
  for(const [name,code] of modules)vm.runInContext(code,cx,{filename:name});
  Object.assign(cx,{
    annalsHash_:sha,annalsHex_:bytes=>bytes.toString('hex'),
    annalsUiCall_:(nonce,fn)=>{assert.equal(nonce,'fictional-owner');return fn();},annalsLocked_:fn=>fn(),
    annalsRoot_:()=>root,annalsFolder_:id=>folders.get(id),annalsPrivate_:value=>value,
    annalsProps_:()=>({getProperty:name=>props[name],deleteProperty:name=>delete props[name],
      setProperty:(name,value)=>{props[name]=value;}}),
    annalsServiceOwner_:()=> 'fictional-owner',
    annalsRead_:(f,name)=>f.files.get(name),annalsFile_:(f,name)=>f.files.has(name),
    annalsSavePrivate_:(f,name,value)=>{
      if(f===root&&name===failOnSave){failOnSave=undefined;throw Error('Fictional interrupted write');}
      f.files.set(name,plain(value));
    },
    annalsWriteOnce_:(f,name,value)=>{assert.equal(f.files.has(name),false);f.files.set(name,plain(value));},
    annalsDispatchEvent_:(f,action,client_payload)=>{events.push({action,client_payload});return !rejected;}
  });
  const serial=cx.AnnalsProduction.serial;
  function add(i,{span=recall,category='cocktail',narrative=proposal(span),subject='A club recollection',
    excerpt=span+' '+lamps,publicText=span+' '+lamps}={}){
    const id=String(i+1).repeat(64), entryId='annal-'+id.slice(0,24), files=new Map(), member=members[addresses[i]];
    folders.set(id,{files,getName:()=>id});
    const source={sourceId:id,senderAuthenticated:true,clubMemberAuthenticated:true,externalContributionAtReceipt:false,
      aiConsentActive:true,autoConsentAtReceipt:true,source:{sender:addresses[i],subject,excerpt,receivedAt:at}};
    const recipe=category==='cocktail'?{drinkIngredients:['1 oz fixture ingredient'],syrupIngredients:[],steps:['Stir the fixture drink.']}:
      {drinkIngredients:[],syrupIngredients:[],steps:[]};
    const raw={category,title:subject,summary:span,recipe,eventDate:'',quoteVerbatim:'',riskFlags:[],
      imageSafety:{kind:'none',safeToPublish:false,altText:''},
      interpretation:{intent:'anecdote',speakerId:'unknown',evidenceField:'body'},historyNarrative:narrative?[narrative]:[]};
    const draft=cx.AnnalsProduction.response(completion(raw),false);
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
    const approved=approve(publicText);
    function withdraw(){
      files.set('removal-private.json',{state:'dispatch_accepted'});
      const index=archive.entries.findIndex(e=>e.id===entryId);
      archive.entries.splice(index,1);archive.approvals.splice(index,1);
    }
    return {id,entryId,files,source,draft,raw,member,approved,approve,withdraw};
  }
  function preview(item,{chapter=item.draft.historyNarrative?.chapter||'traditions',after='opening-1'}={}){
    const {digest}=cx.annalsListHistoryMaintenance('fictional-owner');
    return cx.annalsPrepareHistoryMaintenance('fictional-owner',digest,chapter,after,'compose','',
      'Each fictional paragraph was checked against the exact evidence.',item.id);
  }
  const publish=(review,confirmed=true)=>cx.annalsPublishHistoryMaintenance('fictional-owner',review.hash,confirmed);
  const f={opening,rootFiles,archive,events,cx,props,add,publications,providerRequests,preview,publish,
    assess:item=>{
      item.files.delete('draft-private.json');
      providerResponse=completion(item.raw);
      return cx.annalsPrepareDraftCore_(item.id,item.source.source.excerpt,[],true,true,[]);
    },
    compose:(item,options)=>publish(preview(item,options)),
    failSnapshotWrite:()=>{failOnSave='history-published-private.json';},
    setMain:value=>{main=value;},
    signed:()=>events.at(-1).client_payload.document,
    tick:()=>cx.annalsVerifyAutomaticPublications_(3),
    serveNext:()=>{
      live=applyHistoryRevision({current:main,event:events.at(-1),secret:props.ANNALS_HISTORY_SIGNING_KEY,enabled:true,now:new Date(at)});
      recordMain(live);
    },
    subtract:(serveMain=true)=>{
      live=subtractStaleHistory(live,archive.entries,archive.approvals,new Date(at));
      if(serveMain&&live!==main)recordMain(live);
      return live;
    },
    serveMain:()=>{if(live!==main)recordMain(live);}
  };
  return f;
}
const passages=(document,chapter='traditions')=>document.chapters.find(c=>c.id===chapter).passages;
const keys=document=>historyCredits(document).map(x=>x.key);

test('one mocked assessment proposes composed copy without raising model, token or request limits',()=>{
  const f=fixture(), core=f.cx.AnnalsProduction, item=f.add(0);
  const ordinary=core.request(item.source.source.excerpt,[]);
  assert.equal(f.assess(item).drafted,true);
  assert.equal(f.providerRequests.length,1);
  const assessment=f.providerRequests[0];
  assert.deepEqual(assessment.input,plain(ordinary.input));
  assert.equal(assessment.model,ordinary.model);
  assert.equal(assessment.max_output_tokens,ordinary.max_output_tokens);
  assert.equal(JSON.parse(f.props.ANNALS_BUDGET_LEDGER).reservedCents,10);
  assert.equal(ordinary.text.format.schema.properties.historyNarrative,undefined);
  assert.ok(assessment.text.format.schema.required.includes('historyNarrative'));
  assert.ok(item.files.get('draft-private.json').historyNarrative);
  f.tick();
  assert.equal(f.events.length,0,'an assessment is never release authority');
  const preview=f.preview(item);
  assert.throws(()=>f.publish(preview,false),/Review the exact change/);
  assert.equal(f.events.length,0);
  assert.equal(f.publish(preview).dispatchAccepted,true);
  assert.equal(f.providerRequests.length,1,'review and signing require no second assessment');
  assert.equal(passages(f.signed()).at(-1).text,
    'One account places the company’s singing after the gathering. The lamps stayed lit during the clearing of the room.');
  for(const category of ['cocktail','assembly','club_history','monthly_gathering','artefact','miscellany']){
    const example=fixture(), input=example.add(0,{category});
    assert.ok(input.draft.historyNarrative,category);
    const badProposal=core.response(completion({...input.raw,historyNarrative:[{chapter:'bogus'}]}),false);
    assert.equal(badProposal.historyNarrative,undefined,category);
    assert.deepEqual(plain(badProposal.recipe),input.raw.recipe,category);
  }
});

test('the exact review and signer change only one chapter and reconcile without duplicate publication',()=>{
  const f=fixture(), item=f.add(0);
  const immutable=plain([...item.files]);
  f.tick(); f.tick();
  assert.equal(f.events.length,0);
  assert.throws(()=>f.preview(item,{chapter:'gatherings'}),/eligible current evidence/);
  const preview=f.preview(item);
  assert.equal(preview.claims.length,2);
  assert.equal(f.publish(preview).dispatchAccepted,true);
  assert.throws(()=>f.publish(preview),/Reconcile the prior History/);
  assert.deepEqual(plain(f.signed().chapters.slice(0,3)),f.opening.chapters.slice(0,3));
  assert.equal(passages(f.signed()).length,2);
  assert.doesNotMatch(JSON.stringify(f.events),/example\.test|claimTopics|I remember|bindingDigest|privateClaims|openingPacket/i);
  f.serveNext(); f.tick(); f.tick();
  assert.throws(()=>f.preview(item),/unused narrative source/);
  assert.equal(f.events.length,1);
  assert.deepEqual(plain([...item.files]),immutable);
  assert.equal(f.rootFiles.get('history-pending-private.json').state,'verified_live');
});

test('model claims and old excerpt drafts do not bypass the private composed review',()=>{
  const f=fixture(), item=f.add(0);
  // The source binds both spans, but the model alone cannot corroborate the invented ceremony.
  item.draft.historyNarrative.paragraphs[0][0].text='The company formally voted to sing after the gathering.';
  f.tick();
  assert.equal(f.events.length,0);
  const unsupported=f.preview(item);
  assert.match(passages(unsupported).at(-1).text,/formally voted/);
  assert.throws(()=>f.publish(unsupported,false),/Review the exact change/);
  assert.equal(f.rootFiles.get('history-published-private.json'),f.opening);
  assert.equal(f.events.length,0);

  delete item.draft.historyNarrative;
  item.draft.historyCandidates=[{chapter:'traditions',field:'excerpt',span:recall}];
  f.tick();
  assert.throws(()=>f.preview(item),/eligible current evidence/);
  assert.throws(()=>f.cx.annalsSaveHistoryClaim('fictional-owner',item.id,{},'add','Fictional legacy proposal.'),
    /Maintain published Club History/);
  assert.equal(f.events.length,0);
});

test('the signer checks exact source bytes, proof, draft and current rights again after preview',()=>{
  const changes=[
    ['original still contains spans but differs',item=>{item.source.source.excerpt+=' Another line.';}],
    ['new consent record version',item=>{item.member.autoPublication.consentedAt='2026-10-02T00:00:00Z';}],
    ['portrait revoked after preview',item=>{item.member.contributorPortraitPublication.revokedAt=at;}],
    ['standing text revoked after preview',item=>{item.member.autoPublication.revokedAt=at;}],
    ['narrative copy changed',item=>{item.draft.historyNarrative.paragraphs[0][0].text='Another account places the singing after the gathering.';}],
    ['signed Annals version changed with the same eligible spans',item=>item.approve(recall+' '+lamps+' The room was quiet.',true)]
  ];
  for(const [reason,change] of changes){
    const f=fixture(), item=f.add(0), preview=f.preview(item);
    change(item);
    assert.throws(()=>f.publish(preview),undefined,reason);
    assert.equal(f.events.length,0,reason);
    assert.equal(f.rootFiles.get('history-published-private.json'),f.opening,reason);
  }
});

test('exact source uncertainty and excluded origin evidence hold even if the model labels them usable',()=>{
  const uncertain='The lamp may have been put away during the closing of the room.';
  const excluded='The company returned from Germany and wrote down its memories.';
  for(const span of [uncertain,excluded]){
    const f=fixture(), item=f.add(0,{span});
    // The fixture model describes the singing with certainty and marks this claim usable.
    assert.throws(()=>f.preview(item),/composed History contract/);
    assert.equal(f.events.length,0);
    assert.equal(f.rootFiles.get('history-published-private.json'),f.opening);
  }
});

test('the private preview keeps supported disagreements and holds flattened accounts or extra commentary',()=>{
  const f=fixture(), draft=proposal();
  Object.assign(draft.claims[0],{dispute:'singing-time',variant:'after the gathering'});
  draft.claims.push({...claim('other-time',second,1),dispute:'singing-time',variant:'before the gathering'});
  draft.paragraphs[0][0]={kind:'disagreement',text:'Accounts differ over whether the company sang before the gathering or after the gathering.',
    claims:['singing','other-time']};
  const complete=plain(draft);
  const evidence=[recall,second,lamps].join(' ');
  const item=f.add(0,{excerpt:evidence,publicText:evidence,narrative:draft});
  assert.match(f.preview(item).chapters.find(c=>c.id==='traditions').passages.at(-1).text,/before.*after/);
  item.draft.historyNarrative.paragraphs[0][0].text='Accounts differ, though one places the singing after the gathering.';
  assert.throws(()=>f.preview(item),/composed History contract/);
  item.draft.historyNarrative=complete;
  complete.paragraphs[0].splice(1,0,{kind:'observation',text:'The furniture deserved no such interruption.',claims:[]});
  assert.throws(()=>f.preview(item),/cannot add an observation/);
  assert.equal(f.events.length,0);
});

test('placement under exact review preserves independently sourced accounts and active credits',()=>{
  const f=fixture(), first=f.add(0);
  f.compose(first); f.serveNext(); f.tick();
  const unrelated=f.add(1,{narrative:proposal(recall,{chapter:'gatherings'})});
  f.compose(unrelated); f.serveNext(); f.tick();
  const other=f.add(2,{span:second});
  const earlier=passages(f.signed())[1];
  const preservedGatherings=f.signed().chapters.find(c=>c.id==='gatherings');
  f.add(3,{narrative:null});
  f.compose(other,{after:earlier.id});
  const doc=f.signed(), related=passages(doc).slice(1);
  assert.match(related[0].text,/after the gathering/);
  assert.match(related[1].text,/before the company assembled/);
  assert.notEqual(related[0].id,related[1].id);
  assert.equal(related[0].sources[0].entryId,first.entryId);
  assert.equal(related[1].sources[0].entryId,other.entryId);
  assert.deepEqual(plain(doc.chapters.find(c=>c.id==='gatherings')),plain(preservedGatherings));
  assert.deepEqual(keys(doc),['fish','marc','matt']);
  assert.equal(historyBacklinks(doc).get(other.entryId).size,1);
});

test('corrected and withdrawn signed Annals sources reconcile exactly without altering unrelated chapters or records',()=>{
  const f=fixture(), item=f.add(0,{excerpt:recall+' '+lamps+' '+second});
  f.compose(item); f.serveNext(); f.tick();
  const originals=plain([...item.files]);
  item.approve(second+' '+lamps,true);
  const sub=f.subtract(false);
  f.tick(); // A site result that disagrees with main cannot advance the ledger or sign.
  assert.equal(f.events.length,1);
  assert.equal(f.rootFiles.get('history-published-private.json').revision,2);
  f.serveMain(); f.tick();
  assert.equal(f.events.length,1);
  assert.equal(f.rootFiles.get('history-published-private.json').revision,sub.revision);
  assert.throws(()=>f.preview(item),/exact used and signed Annals evidence/);
  assert.deepEqual(plain(sub.chapters),f.opening.chapters);
  item.withdraw();
  const withdrawn=f.subtract();
  f.tick(); f.tick();
  assert.equal(f.events.length,1);
  assert.deepEqual(keys(withdrawn),[]);
  assert.deepEqual(plain(withdrawn.chapters),f.opening.chapters);
  assert.deepEqual(plain([...item.files].slice(0,originals.length)),originals);
  assert.equal(historyBacklinks(withdrawn).has(item.entryId),false);
});

test('a portrait revocation removes the last artwork and attribution, and standing text revocation removes the recollection',()=>{
  const f=fixture(), item=f.add(0);
  f.compose(item); f.serveNext(); f.tick();
  const composed=passages(f.signed()).at(-1).text;
  item.member.contributorPortraitPublication.revokedAt=at;
  f.tick();
  assert.equal(f.events.length,2);
  assert.deepEqual(keys(f.signed()),[]);
  assert.equal(passages(f.signed()).at(-1).text,composed);
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
    ['staged sample outside the span',({item})=>item.source.source.subject='A staged example for the desk'],
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
    ['owner-maintained source with an unrelated Annals correction',({f,item})=>{
      f.rootFiles.get('history-bound-ledger-private.json').ownerMaintainedSourceVersions={
        [item.entryId+':'+item.approved.receipt.contentSha256]:true};
      item.approve(recall+' Another already supported sentence.',true);
    }],
    ['standing consent revoked',({item})=>item.member.autoPublication.revokedAt=at],
    ['withdrawn',({item})=>item.withdraw()]
  ];
  for(const [reason,edit] of cases){
    const f=fixture(), item=f.add(0);
    edit({f,item});
    if(reason==='feature disabled')assert.throws(()=>f.compose(item),/signing remediation/);
    else assert.throws(()=>f.preview(item),undefined,reason);
    f.tick();
    assert.equal(f.events.length,0,reason);
    assert.equal(f.rootFiles.has('history-pending-private.json'),false,reason);
  }
});

test('an uncertain dispatch has one attempt and leaves the verified opening in place',()=>{
  const f=fixture({rejected:true}), item=f.add(0);
  assert.equal(f.compose(item).dispatchAccepted,false);
  f.tick(); f.tick(); f.tick();
  assert.equal(f.events.length,1);
  assert.equal(f.rootFiles.get('history-pending-private.json').state,'uncertain_or_rejected_no_retry');
  assert.equal(f.rootFiles.get('history-published-private.json'),f.opening);
});

test('an interrupted signed reconciliation resumes only its verified ledger and snapshot without dispatching again',()=>{
  const f=fixture(), item=f.add(0);
  const ledger='history-bound-ledger-private.json', snapshot='history-published-private.json',
    pending='history-pending-private.json';
  f.compose(item); f.serveNext();
  f.failSnapshotWrite(); f.tick();
  const partial=f.rootFiles.get(ledger);
  assert.deepEqual(plain(partial.chapters),plain(f.signed().chapters));
  assert.equal(f.rootFiles.get(snapshot).revision,1);
  assert.equal(f.rootFiles.get(pending).state,'dispatch_accepted');
  assert.ok(f.rootFiles.has('history-live-2-private.json'));

  f.rootFiles.set(ledger,{...partial,claimTopics:{unrelated:'wrong-topic'}});
  f.tick();
  assert.equal(f.rootFiles.get(snapshot).revision,1);
  assert.equal(f.rootFiles.get(pending).state,'dispatch_accepted');
  f.rootFiles.set(ledger,partial);
  const journalName='history-revision-2-private.json', journal=f.rootFiles.get(journalName);
  f.rootFiles.set(journalName,{...journal,review:{...journal.review,operation:'unrelated'}});
  f.tick();
  assert.equal(f.rootFiles.get(snapshot).revision,1);
  f.rootFiles.set(journalName,journal);
  f.setMain(f.opening);
  f.tick();
  assert.equal(f.rootFiles.get(snapshot).revision,1);
  f.serveMain();
  f.tick(); f.tick();
  assert.equal(f.events.length,1);
  assert.deepEqual(plain(f.rootFiles.get(snapshot)),plain(f.signed()));
  assert.equal(f.rootFiles.get(pending).state,'verified_live');
});

test('an interrupted Annals withdrawal rebase resumes only from the exact signed subtraction',()=>{
  const f=fixture(), item=f.add(0);
  const ledger='history-bound-ledger-private.json', snapshot='history-published-private.json';
  f.compose(item); f.serveNext(); f.tick();
  item.withdraw();
  const withdrawn=f.subtract();
  f.failSnapshotWrite(); f.tick();
  const partial=f.rootFiles.get(ledger);
  assert.deepEqual(plain(partial.chapters),plain(withdrawn.chapters));
  assert.equal(f.rootFiles.get(snapshot).revision,2);

  f.rootFiles.set(ledger,{...partial,chapters:f.opening.chapters.slice(1)});
  f.tick();
  assert.equal(f.rootFiles.get(snapshot).revision,2);
  f.rootFiles.set(ledger,{...partial,claimTopics:{unrelated:'wrong-topic'}});
  f.tick();
  assert.equal(f.rootFiles.get(snapshot).revision,2);
  f.rootFiles.set(ledger,partial);
  f.tick(); f.tick();
  assert.equal(f.events.length,1);
  assert.deepEqual(plain(f.rootFiles.get(snapshot)),plain(withdrawn));
  assert.deepEqual(keys(f.rootFiles.get(snapshot)),[]);
});

test('a History-only withdrawal cannot keep a revoked portrait on a surviving passage from that entry',()=>{
  const f=fixture(), closing='At the end of the evening the company signed the inventory.';
  const full=recall+' '+lamps+' '+closing;
  const item=f.add(0,{excerpt:full,publicText:full,narrative:proposal(recall,{extra:closing})});
  f.compose(item); f.serveNext(); f.tick();
  const [removed,retained]=passages(f.signed()).slice(1);
  const {digest}=f.cx.annalsListHistoryMaintenance('fictional-owner');
  const {hash}=f.cx.annalsPrepareHistoryMaintenance('fictional-owner',digest,'traditions',removed.id,
    'withdraw','','The first fictional recollection was withdrawn.');
  assert.equal(f.cx.annalsPublishHistoryMaintenance('fictional-owner',hash,true).dispatchAccepted,true);
  f.serveNext(); f.tick();
  assert.deepEqual(plain(passages(f.signed()).slice(1)),[plain(retained)]);
  item.member.contributorPortraitPublication.revokedAt=at;
  f.tick();
  assert.equal(f.events.length,3);
  const [remaining]=passages(f.signed()).slice(1);
  assert.equal(remaining.id,retained.id);
  assert.equal(remaining.text,retained.text);
  assert.equal(remaining.sources[0].portrait,null);
  assert.deepEqual(keys(f.signed()),[]);
  assert.equal(passages(f.signed()).some(p=>p.id===removed.id),false);
  f.serveNext(); f.tick(); f.tick();
  assert.equal(f.events.length,3);
});

function twoWithdrawals(){
  const f=fixture(), a=f.add(0), b=f.add(1,{span:second});
  f.compose(a); f.serveNext(); f.tick(); f.compose(b); f.serveNext(); f.tick();
  const ledger='history-bound-ledger-private.json', snapshot='history-published-private.json';
  assert.equal(f.rootFiles.get(snapshot).revision,3);
  a.withdraw();
  const intermediate=f.subtract();
  f.failSnapshotWrite(); f.tick();
  assert.equal(intermediate.revision,4);
  assert.deepEqual(plain(f.rootFiles.get(ledger).chapters),plain(intermediate.chapters));
  assert.equal(f.rootFiles.get(snapshot).revision,3);
  b.withdraw();
  const final=f.subtract();
  assert.equal(final.revision,5);
  return {f,ledger,snapshot,final};
}

test('a second signed withdrawal can overtake the persisted ledger before snapshot recovery',()=>{
  const {f,ledger,snapshot,final}=twoWithdrawals();
  f.tick(); f.tick();
  assert.equal(f.events.length,2);
  assert.deepEqual(plain(f.rootFiles.get(snapshot)),plain(final));
  assert.deepEqual(plain(f.rootFiles.get(ledger).chapters),f.opening.chapters);
  assert.deepEqual(keys(f.rootFiles.get(snapshot)),[]);
  assert.equal(f.rootFiles.get('history-pending-private.json').state,'verified_live');
});

test('the two-withdrawal catch-up holds when any intermediate or private binding differs',()=>{
  const cases=[
    ['unrelated private ledger metadata',({f,ledger})=>{f.rootFiles.get(ledger).claimTopics={alien:'topic'};}],
    ['unrelated private ledger copy',({f,ledger})=>{passages(f.rootFiles.get(ledger))[0].text='Unrelated fictional prose.';}],
    ['intermediate archive cannot explain its History subtraction',({f})=>{
      f.publications.find(item=>item.document.revision===4).archive=f.publications[0].archive;
    }],
    ['intermediate committed History copy differs',({f})=>{
      passages(f.publications.find(item=>item.document.revision===4).document)[0].text='Unrelated fictional prose.';
    }],
    ['intermediate commit is missing',({f})=>{f.publications.splice(1,1);}]
  ];
  for(const [reason,edit] of cases){
    const state=twoWithdrawals();edit(state);
    state.f.tick();
    assert.equal(state.f.rootFiles.get(state.snapshot).revision,3,reason);
    assert.equal(state.f.events.length,2,reason);
  }
});
