import assert from 'node:assert/strict';
import {createHash, createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import {historyBacklinks, historyCredits, subtractStaleHistory} from '../scripts/annals/BoundHistory.mjs';
import {applyHistoryRevision, historyDigest, renderHistory} from '../scripts/annals/HistoryPublisher.mjs';

const modules=['PilotCore.js','ProductionCore.js','AutoCore.js','Production.gs','HistoryProduction.gs','HistoryNarrative.js','LivingHistoryIntake.gs']
  .map(name=>[name,readFileSync(new URL('../scripts/annals/'+name,import.meta.url),'utf8')]);
const sha=text=>createHash('sha256').update(text).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const at='2026-11-20T21:00:00.000Z';
const guide=readFileSync(new URL('../docs/brand-editorial-style-guide.md',import.meta.url),'utf8').replaceAll('\r\n','\n');
const approvedVoice=guide.split('#### Canonical Club-authored editorial example\n\n')[1]
  .split('\n\nUse this example')[0].split('\n\n');
const recall='I remember that we sang after the year-end gathering.';
const second='I remember that we sang before the year-end gathering.';
const lamps='The lamps were still burning as the furniture was put away.';
const chapterIds=['origins','gatherings','assemblies','traditions'];
const portraits=['fish','marc','matt','ken','jamie','jerome'];
const claim=(id,span,order)=>({id,field:'excerpt',span,order,dispute:'',variant:'',uncertain:false,poignant:false});
function proposal(span=recall,{chapter='traditions',extra=false,voice=0}={}){
  const spoken=span===second?'One account places the singing before the company assembled.':
    ['One account places the company’s singing after the gathering.',
      'The record places the song after the proceedings had ended.',
      'By a later recollection, the company sang once the gathering was over.'][voice%3];
  const lighting=['The lamps stayed lit during the clearing of the room.',
    'The company moved the furniture while the lights were still burning.',
    'The room remained lit while the company put away the furniture.'][voice%3];
  const fact=(text,id)=>({kind:'record',text,claims:[id]});
  const claims=[claim('singing',span,1),claim('lamps',lamps,2)];
  const paragraphs=[[fact(spoken,'singing'),fact(lighting,'lamps')]];
  if(extra){
    claims.push(claim('closing',extra,3));
    paragraphs.push([fact('The lights were still alight when the furniture was moved.','lamps'),
      fact('The record also places the signing of the inventory at the close of the evening.','closing')]);
  }
  return {chapter,claims,paragraphs};
}
const completion=raw=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(raw)}]}]});

function fixture({disabled=false,rejected=false,editOpening=()=>{}}={}){
  const opening={schemaVersion:2,revision:1,updatedAt:at,chapters:chapterIds.map(id=>({
    id,heading:'Opening '+id,passages:[{id:'opening-1',text:'Existing opening prose about '+id+'.',
      sources:[{kind:'record',ref:'opening-record'}]}]}))};
  editOpening(opening);
  let live=opening, main=opening, failOnSave, publicHistoryAvailable=true;
  const events=[], archive={schemaVersion:1,entries:[],approvals:[],retiredIds:[]};
  const rootFiles=new Map(), folders=new Map(), publications=[], commitParents=[], providerRequests=[], providerBodies=[], publicReads=[];
  let contextProofReads=0;
  const preparedDrafts=new Set();
  let providerResponse, archiveBeforeMutation=plain(archive);
  function recordMain(value, parentArchive=archive){
    const parent={sha:sha('fictional parent '+publications.length).slice(0,40),document:plain(main),archive:plain(parentArchive)};
    commitParents.push(parent);
    main=value;
    publications.unshift({sha:sha('fictional release '+publications.length).slice(0,40),
      parents:[{sha:parent.sha}],document:plain(value),archive:plain(archive)});
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
  rootFiles.set('history-context-live-private.json',{revision:opening.revision,digest:historyDigest(opening),verifiedAt:at});
  rootFiles.set('history-bound-ledger-private.json',{schemaVersion:1,privateOpeningPacketSha256:'b'.repeat(64),chapters:opening.chapters});
  const iterate=values=>{
    let index=0;
    return {hasNext:()=>index<values.length,next:()=>values[index++]};
  };
  const root={files:rootFiles,getFolders:()=>iterate([...folders.values()]),
    searchFolders:query=>{
      const [,prefix]=/^trashed = false and title contains '([a-f0-9]{24})'$/.exec(query);
      return iterate([...folders.values()].filter(folder=>folder.getName().startsWith(prefix)));
    }};
  const cx=vm.createContext({
    Date:class extends Date{constructor(...args){super(...(args.length?args:[at]));}static now(){return Date.parse(at);}},
    AnnalsPublicDisplay:{historyPage:renderHistory},
    Utilities:{Charset:{UTF_8:'UTF-8'},formatDate:()=>'2026-11',
      computeHmacSha256Signature:(text,key)=>createHmac('sha256',key).update(text).digest()},
    UrlFetchApp:{fetch:(url,options)=>{
      if(url==='https://api.openai.com/v1/responses'){
        assert.ok(providerResponse,'unexpected provider attempt');
        providerBodies.push(options.payload);
        providerRequests.push(JSON.parse(options.payload));
        return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(providerResponse)};
      }
      publicReads.push(url);
      if(!publicHistoryAvailable&&url==='https://stammtischbrewery.com/data/club-history.json')
        return {getResponseCode:()=>404};
      const pinned=publications.find(record=>url.includes('/'+record.sha+'/'))||
        commitParents.find(record=>url.includes('/'+record.sha+'/'));
      const body=url.startsWith('https://api.github.com/')?
        JSON.stringify(publications.slice(0,Number(new URL(url).searchParams.get('per_page'))).map(({sha,parents})=>({sha,parents}))):
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
    annalsRead_:(f,name)=>{
      if(f===root&&name==='history-context-live-private.json')contextProofReads++;
      return f.files.get(name);
    },annalsFile_:(f,name)=>f.files.has(name),
    annalsSavePrivate_:(f,name,value)=>{
      if(f===root&&name===failOnSave){failOnSave=undefined;throw Error('Fictional interrupted write');}
      f.files.set(name,plain(value));
    },
    annalsWriteOnce_:(f,name,value)=>{assert.equal(f.files.has(name),false);f.files.set(name,plain(value));},
    annalsDispatchEvent_:(f,action,client_payload)=>{events.push({action,client_payload});return !rejected;}
  });
  const serial=cx.AnnalsProduction.serial;
  function add(i,{span=recall,category='cocktail',narrative=proposal(span,{voice:i}),subject='A club recollection',
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
    let approvalTime=Date.parse(at)-10000;
    function approve(text,corrected=false,photo){
      archiveBeforeMutation=plain(archive);
      const entry={id:entryId,category,title:'A recollection in the Annals',summary:text,year:2026,dateLabel:'',
        sortDate:'',quoteVerbatim:'',recipe,credit:'anonymous',contributorPortrait:portraits[i],...(photo?{photo}:{})};
      const receipt={entryId,approvedAt:new Date(approvalTime+=1000).toISOString(),
        reviewedBy:corrected?'fictional-owner':'standing-consent-automation-v1',
        consents:{publication:true,namedAttribution:true,photoPublication:!!photo,quotePublication:false,recipeVerified:category==='cocktail'},
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
      const index=archive.entries.findIndex(e=>e.id===entryId);
      if(index<0)return;
      archiveBeforeMutation=plain(archive);
      const entry=archive.entries[index], approvedAt=new Date(Date.parse(at)-1000).toISOString();
      const proof=plain(cx.annalsPublicRemoval_(entry,approvedAt,props.ANNALS_PUBLISH_SIGNING_KEY));
      files.set('removal-private.json',{state:'dispatch_accepted',entry:plain(entry),proof,approvedAt});
      files.set('removal-dispatch-private.json',{state:'accepted',at:approvedAt,completedAt:at});
      archive.entries.splice(index,1);archive.approvals.splice(index,1);archive.retiredIds.push(entryId);
    }
    return {id,entryId,files,source,draft,raw,member,approved,approve,withdraw};
  }
  function preview(item,{chapter=item.draft.historyNarrative?.chapter||'traditions',after='opening-1'}={}){
    const {digest}=cx.annalsListHistoryMaintenance('fictional-owner');
    if(!preparedDrafts.has(item.id)){
      // Set up synthetic pre-assessed drafts against the state at first use.
      const historyContext=cx.annalsHistoryIntakeContext_();
      if(historyContext){
        const proposed=item.files.get('draft-private.json').historyNarrative;
        const responseText=JSON.stringify(completion({...item.raw,historyNarrative:proposed?[proposed]:[]}));
        const model=cx.AnnalsProduction.MODEL, submittedText=item.source.source.excerpt;
        const requestBody=JSON.stringify(cx.AnnalsProduction.request(submittedText,[],historyContext.reference));
        const attempt={model,imageInputCount:0,historyContext,submittedText,historyRequestSha256:sha(requestBody)};
        item.files.set('ai-attempt-private.json',attempt);
        item.files.set('ai-response-private.json',{model,httpStatus:200,responseText,
          historyAssessmentSignature:cx.annalsHistoryAssessmentSignature_(item.id,item.source,attempt,responseText,proposed)});
      }
      preparedDrafts.add(item.id);
    }
    return cx.annalsPrepareHistoryMaintenance('fictional-owner',digest,chapter,after,'compose','',
      'Each fictional paragraph was checked against the exact evidence.',item.id);
  }
  const publish=(review,confirmed=true)=>cx.annalsPublishHistoryMaintenance('fictional-owner',review.hash,confirmed);
  function assess(item,images,context){
    preparedDrafts.add(item.id);
    item.files.delete('draft-private.json');
    providerResponse=completion(item.raw);
    return cx.annalsPrepareDraftCore_(item.id,item.source.source.excerpt,[],true,true,images,context);
  }
  const f={opening,rootFiles,archive,events,cx,props,add,publications,commitParents,providerRequests,providerBodies,publicReads,preview,publish,
    proofReads:()=>contextProofReads,
    assess:(item,images=[])=>assess(item,images,cx.annalsHistoryIntakeContext_()),
    assessQueue:items=>{
      items.forEach(item=>item.files.delete('draft-private.json'));
      cx.annalsProcessConsentedText_=(id,context)=>assess(items.find(item=>item.id===id),[],context).drafted;
      return cx.annalsResumeConsentedDrafts_(items.length);
    },
    hidePublicHistory:()=>{publicHistoryAvailable=false;},
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
      if(serveMain&&live!==main)recordMain(live,archiveBeforeMutation);
      return live;
    },
    serveMain:()=>{if(live!==main)recordMain(live,archiveBeforeMutation);}
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
  assert.deepEqual(assessment.input.slice(1),plain(ordinary.input));
  assert.equal(assessment.input[0].role,'user');
  const packet=JSON.parse(assessment.input[0].content[0].text);
  assert.deepEqual(Object.keys(packet),['voiceOnly','chapterContinuity']);
  assert.deepEqual(packet.voiceOnly,{
    origins:approvedVoice[0],
    evening:approvedVoice[1],
    observances:approvedVoice[2],
    solemn:'This part of the evening belongs to the life being remembered.'
  });
  assert.deepEqual(packet.chapterContinuity,f.opening.chapters.map(chapter=>({
    chapter:chapter.id,heading:chapter.heading,prose:chapter.passages[0].text
  })));
  assert.match(assessment.instructions,/generous sentence cadence and dry, affectionate institutional grandeur/);
  assert.match(assessment.instructions,/solemn example illustrates the restraint due to Celebration of Life/);
  assert.match(assessment.instructions,/Use only the final message for all claims/);
  assert.match(assessment.instructions,/Ignore the packet when writing every field outside historyNarrative/);
  const {historyNarrative,...ordinaryProperties}=assessment.text.format.schema.properties;
  assert.deepEqual(ordinaryProperties,plain(ordinary.text.format.schema.properties));
  assert.equal(assessment.model,ordinary.model);
  assert.equal(assessment.max_output_tokens,ordinary.max_output_tokens);
  assert.equal(JSON.parse(f.props.ANNALS_BUDGET_LEDGER).reservedCents,10);
  assert.equal(ordinary.text.format.schema.properties.historyNarrative,undefined);
  assert.ok(assessment.text.format.schema.required.includes('historyNarrative'));
  const saved=item.files.get('draft-private.json');
  assert.ok(saved.historyNarrative);
  const attempt=item.files.get('ai-attempt-private.json'), proof=item.files.get('ai-response-private.json'), bound=attempt.historyContext;
  assert.equal(attempt.historyRequestSha256,sha(f.providerBodies[0]));
  assert.match(proof.historyAssessmentSignature,/^[a-f0-9]{64}$/);
  assert.equal(bound.reference,assessment.input[0].content[0].text);
  assert.equal(bound.revision,f.opening.revision);
  assert.equal(bound.chapterDigests.traditions,sha(core.serial(f.opening.chapters.at(-1))));
  f.tick();
  assert.equal(f.events.length,0,'an assessment is never release authority');
  const preview=f.preview(item);
  assert.throws(()=>f.publish(preview,false),/Review the exact change/);
  assert.equal(f.events.length,0);
  assert.equal(f.publish(preview).dispatchAccepted,true);
  assert.equal(f.providerRequests.length,1,'review and signing require no second assessment');
  assert.ok(!JSON.stringify(f.events).includes(proof.historyAssessmentSignature));
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

test('approved cadence and four chapter destinations fit the unchanged assessment budget',()=>{
  const f=fixture(), core=f.cx.AnnalsProduction, narrative=f.cx.AnnalsHistoryNarrative;
  const assemblyStart=approvedVoice[2].lastIndexOf(' The cottage weekend');
  assert.ok(assemblyStart>0);
  const passages={origins:approvedVoice[0],gatherings:approvedVoice[1],
    traditions:approvedVoice[2].slice(0,assemblyStart),assemblies:approvedVoice[2].slice(assemblyStart+1)};
  const history={revision:3,chapters:f.opening.chapters.map(chapter=>({
    ...chapter,passages:[{...chapter.passages[0],text:passages[chapter.id]}]
  }))};
  const context=narrative.generationContext(history,value=>sha(core.serial(value)),f.cx.AnnalsAuto.sensitiveText,core.HISTORY_REFERENCE_LIMIT);
  assert.ok(context.reference.length<=core.HISTORY_REFERENCE_LIMIT);
  const packet=JSON.parse(context.reference);
  assert.deepEqual(packet.chapterContinuity.map(sample=>sample.chapter),history.chapters.map(chapter=>chapter.id));
  for(const sample of packet.chapterContinuity){
    const original=history.chapters.find(chapter=>chapter.id===sample.chapter).passages[0].text;
    assert.ok(original===sample.prose||original.split(/(?<=[.!?])\s+/).includes(sample.prose));
    assert.ok(sample.prose.length<=160);
  }
});

test('already authenticated revision 2 voice packets still qualify for an owner preview',()=>{
  const f=fixture(), item=f.add(0), context=f.cx.annalsHistoryIntakeContext_();
  const packet=JSON.parse(context.reference);
  packet.voiceOnly={
    assembly:'The cottage had evidently been fit for purpose before it acquired a formal title.',
    solemn:'This part of the evening belongs to the life being remembered.'
  };
  context.reference=JSON.stringify(packet);
  f.cx.annalsHistoryIntakeContext_=()=>context;
  f.assess(item);
  assert.ok(item.files.get('ai-response-private.json').historyAssessmentSignature);
  assert.ok(f.preview(item).hash);
  assert.equal(f.providerRequests.length,1);
  assert.equal(f.events.length,0);
});

test('unavailable or mismatched verified History leaves the ordinary recipe and photo assessment unchanged',()=>{
  for(const unavailable of ['no prior proof','proof for a different edition']){
    const f=fixture(), item=f.add(0), core=f.cx.AnnalsProduction;
    f.hidePublicHistory();
    const proofFile='history-context-live-private.json';
    if(unavailable==='no prior proof')f.rootFiles.delete(proofFile);
    else f.rootFiles.get(proofFile).digest='c'.repeat(64);
    const images=[{mime:'image/jpeg',base64:'Zg=='}];
    item.raw.imageSafety={kind:'drink_or_object',safeToPublish:true,altText:'A glass on a fictional tray'};
    item.raw.imageReviews=[{kind:'drink_or_object',safeToPublish:true,privateDetails:false,thirdPartyMaterial:false,
      childrenOrGuests:false,altText:'A glass on a fictional tray',caption:'The tray was sufficient for the proceedings.'}];
    const ordinary={...item.raw};
    delete ordinary.historyNarrative;
    assert.equal(f.assess(item,images).drafted,true,unavailable);
    assert.deepEqual(f.providerRequests,[plain(core.request(item.source.source.excerpt,images))],unavailable);
    assert.deepEqual(item.files.get('draft-private.json'),plain(core.candidate(ordinary,true)),unavailable);
    assert.equal(item.files.get('ai-attempt-private.json').historyContext,undefined,unavailable);
    assert.equal(JSON.parse(f.props.ANNALS_BUDGET_LEDGER).reservedCents,10,unavailable);
    assert.deepEqual(f.publicReads,[],unavailable);
  }
});

test('the existing intake batch reuses one verified picture of History without any public reads',()=>{
  for(const available of [true,false]){
    const f=fixture(), first=f.add(0), secondItem=f.add(1,{span:second});
    f.hidePublicHistory();
    if(!available)f.rootFiles.delete('history-context-live-private.json');
    assert.equal(f.assessQueue([first,secondItem]),2);
    assert.equal(f.proofReads(),1);
    assert.deepEqual(f.publicReads,[]);
    assert.equal(f.providerRequests.length,2);
    assert.equal(f.providerRequests[0].input.length,available?2:1);
    assert.deepEqual(f.providerRequests[0].input[0],available?f.providerRequests[1].input[0]:
      plain(f.cx.AnnalsProduction.request(first.source.source.excerpt,[]).input[0]));
    assert.equal(!!first.files.get('draft-private.json').historyNarrative,available);
    assert.equal(!!secondItem.files.get('draft-private.json').historyNarrative,available);
  }
});

test('the existing exact publication receipt qualifies an earlier deployed signed edition',()=>{
  const f=fixture(), item=f.add(0), revision=f.opening.revision, digest=historyDigest(f.opening);
  f.rootFiles.delete('history-context-live-private.json');
  f.rootFiles.set('history-pending-private.json',{state:'verified_live',verificationKind:'exact_site',
    verifiedRevision:revision,document:f.opening,approval:{contentSha256:digest}});
  f.rootFiles.set('history-live-'+revision+'-private.json',{digest,verifiedAt:at});
  f.hidePublicHistory();
  f.assess(item);
  assert.deepEqual(f.publicReads,[]);
  assert.ok(item.files.get('draft-private.json').historyNarrative);
});

test('only safe bounded public prose reaches the same request, with recipe and photo fields intact',()=>{
  const f=fixture({editOpening:edition=>{
    edition.chapters[0].heading='Justin appears in this fictional fixture';
    edition.chapters[1].passages[0].text='The fictional example displays a contact at someone@example.test.';
    edition.chapters[2].passages.unshift({id:'large',text:'The proceedings were recorded. '.repeat(13).trim(),
      sources:[{kind:'record',ref:'fictional-source-detail'}]});
  }});
  f.rootFiles.get('history-bound-ledger-private.json').privateNote='fictional private ledger note';
  const item=f.add(0,{narrative:proposal(recall,{chapter:'origins'})});
  const images=[{mime:'image/jpeg',base64:'Zg=='}], core=f.cx.AnnalsProduction;
  item.raw.imageReviews=[{kind:'drink_or_object',safeToPublish:true,privateDetails:false,thirdPartyMaterial:false,
    childrenOrGuests:false,altText:'A glass in a fictional sketch',caption:'The glass received formal attention.'}];
  f.assess(item,images);
  assert.equal(f.providerRequests.length,1);
  const request=f.providerRequests[0], serialized=request.input[0].content[0].text;
  const packet=JSON.parse(serialized);
  assert.deepEqual(packet.chapterContinuity.map(sample=>sample.chapter),['assemblies','traditions']);
  assert.ok(packet.chapterContinuity.every(sample=>sample.prose.length<=320));
  assert.ok(serialized.length<=core.HISTORY_REFERENCE_LIMIT);
  assert.doesNotMatch(serialized,/Justin|example\\.test|private ledger note|fictional-source-detail|opening-1|chapterDigest/);
  assert.deepEqual(request.input.slice(1),plain(core.request(item.source.source.excerpt,images).input));
  const ordinary={...item.raw};
  delete ordinary.historyNarrative;
  assert.deepEqual(item.files.get('draft-private.json'),plain(core.candidate(ordinary,true)));
});

test('public reference wording is held when a model copies it into prose or proposes it as evidence',()=>{
  for(const kind of ['approved exemplar','chapter prose','solemn exemplar as evidence']){
    const f=fixture(), item=f.add(0), proposed=item.raw.historyNarrative[0];
    const {reference}=f.cx.annalsHistoryIntakeContext_(), packet=JSON.parse(reference);
    if(kind==='solemn exemplar as evidence')proposed.claims[0].span=packet.voiceOnly.solemn;
    else proposed.paragraphs[0][0].text=kind==='approved exemplar'?packet.voiceOnly.observances.match(/^[^.]+\./)[0]:packet.chapterContinuity.at(-1).prose;
    f.assess(item);
    const ordinary={...item.raw};
    delete ordinary.historyNarrative;
    assert.deepEqual(item.files.get('draft-private.json'),plain(f.cx.AnnalsProduction.candidate(ordinary,false)),kind);
    assert.equal(f.providerRequests.length,1,kind);
    assert.equal(f.events.length,0,kind);
  }
});

test('the exact original generation context must survive through preview and signing',()=>{
  const f=fixture(), item=f.add(0);
  f.assess(item);
  const attempt=item.files.get('ai-attempt-private.json');
  delete attempt.historyContext;
  assert.throws(()=>f.preview(item),/requires current signed chapter context/);
  assert.equal(f.events.length,0);
  assert.equal(f.providerRequests.length,1);

  const g=fixture(), fresh=g.add(0);
  g.assess(fresh);
  const reviewed=g.preview(fresh);
  const stamp=fresh.files.get('ai-attempt-private.json').historyContext;
  const packet=JSON.parse(stamp.reference);
  packet.voiceOnly.observances='The fictional Club had put away the ceremonial place cards by then.';
  stamp.reference=JSON.stringify(packet);
  assert.throws(()=>g.publish(reviewed),/requires current signed chapter context/);
  assert.equal(g.events.length,0);
  assert.equal(g.providerRequests.length,1);
});

test('pre-preview reference and proposal changes cannot replace the original assessment',()=>{
  const cases=[
    ['a valid but different chapter sample',({packet})=>{packet.chapterContinuity[0].prose='An altered fictional sample that would still be safe.';}],
    ['empty sample packet',({packet})=>{packet.chapterContinuity=[];}],
    ['different exemplar',({packet})=>{packet.voiceOnly.solemn='A wholly different fictional example.';}],
    ['different chapter target',({draft})=>{draft.historyNarrative.chapter='assemblies';}],
    ['different chapter digest',({attempt})=>{attempt.historyContext.chapterDigests.traditions='e'.repeat(64);}],
    ['different edition revision',({attempt})=>{attempt.historyContext.revision++;}],
    ['different sent request fingerprint',({attempt})=>{attempt.historyRequestSha256='e'.repeat(64);}],
    ['edited retained request text',({attempt})=>{attempt.submittedText+=' A different request.';}],
    ['source fingerprint changed despite unchanged used spans',({item})=>{item.source.source.excerpt+=' A separate note.';}],
    ['edited returned prose',({draft})=>{draft.historyNarrative.paragraphs[0][0].text='The Club considered a different version of the evening.';}],
    ['edited raw response with identical proposed prose',({response})=>{response.responseText+=' ';}]
  ];
  for(const [reason,alter] of cases){
    const f=fixture(), item=f.add(0);
    f.assess(item);
    const attempt=item.files.get('ai-attempt-private.json'), response=item.files.get('ai-response-private.json');
    const draft=item.files.get('draft-private.json'), packet=JSON.parse(attempt.historyContext.reference);
    alter({item,attempt,response,draft,packet});
    attempt.historyContext.reference=JSON.stringify(packet);
    assert.throws(()=>f.preview(item,{chapter:draft.historyNarrative.chapter}),/requires current signed chapter context/,reason);
    assert.equal(f.events.length,0,reason);
    assert.equal(f.providerRequests.length,1,reason);
  }
});

test('the response binding also rejects invalid packet shape and altered exemplar pins',()=>{
  for(const invalid of ['empty samples','duplicate chapter','unrecognized target','changed exemplar']){
    const f=fixture(), item=f.add(0);
    f.assess(item);
    const attempt=item.files.get('ai-attempt-private.json'), response=item.files.get('ai-response-private.json');
    const packet=JSON.parse(attempt.historyContext.reference);
    if(invalid==='empty samples')packet.chapterContinuity=[];
    if(invalid==='duplicate chapter')packet.chapterContinuity[1]=packet.chapterContinuity[0];
    if(invalid==='unrecognized target')packet.chapterContinuity.at(-1).chapter='hypothetical';
    if(invalid==='changed exemplar')packet.voiceOnly.origins='A different pinned example.';
    attempt.historyContext.reference=JSON.stringify(packet);
    assert.equal(f.cx.AnnalsHistoryNarrative.bindGeneration(item.raw.historyNarrative[0],
      attempt.historyContext,f.cx.AnnalsProduction.HISTORY_REFERENCE_LIMIT),null,invalid);
    assert.throws(()=>f.preview(item),/requires current signed chapter context/,invalid);
    assert.equal(f.events.length,0,invalid);
  }
});

test('a valid-shape substituted packet and recomputed ordinary hashes cannot authenticate an assessment',()=>{
  const f=fixture(), item=f.add(0);
  f.assess(item);
  const reviewed=f.preview(item);
  const core=f.cx.AnnalsProduction, attempt=item.files.get('ai-attempt-private.json');
  const response=item.files.get('ai-response-private.json'), proposal=item.files.get('draft-private.json').historyNarrative;
  const packet=JSON.parse(attempt.historyContext.reference);
  packet.chapterContinuity.find(sample=>sample.chapter===proposal.chapter).prose='The company arranged the fictional furniture with care.';
  attempt.historyContext.reference=JSON.stringify(packet);
  attempt.historyRequestSha256=sha(JSON.stringify(core.request(attempt.submittedText,[],attempt.historyContext.reference)));
  const unkeyed=sha(core.serial({context:attempt.historyContext,responseText:response.responseText}));
  response.historyAssessmentSha256=unkeyed;
  assert.ok(f.cx.AnnalsHistoryNarrative.bindGeneration(proposal,attempt.historyContext,core.HISTORY_REFERENCE_LIMIT));
  assert.throws(()=>f.preview(item),/requires current signed chapter context/);
  response.historyAssessmentSignature=unkeyed;
  assert.throws(()=>f.preview(item),/requires current signed chapter context/);
  assert.throws(()=>f.publish(reviewed),/requires current signed chapter context/);
  assert.equal(f.events.length,0);
  assert.equal(f.providerRequests.length,1);
});

test('authentic assessment proof cannot be moved to another contribution with the same request and response',()=>{
  const f=fixture(), first=f.add(0), secondItem=f.add(1,{narrative:plain(first.raw.historyNarrative[0])});
  secondItem.source.source.sender=first.source.source.sender;
  f.assess(first); f.assess(secondItem);
  const original=first.files.get('ai-response-private.json'), secondResponse=secondItem.files.get('ai-response-private.json');
  assert.equal(f.providerBodies[0],f.providerBodies[1]);
  assert.equal(original.responseText,secondResponse.responseText);
  assert.notEqual(original.historyAssessmentSignature,secondResponse.historyAssessmentSignature);
  assert.ok(f.preview(secondItem).hash);
  for(const file of ['ai-attempt-private.json','ai-response-private.json','draft-private.json'])
    secondItem.files.set(file,plain(first.files.get(file)));
  assert.throws(()=>f.preview(secondItem),/requires current signed chapter context/);
  assert.equal(f.events.length,0);
  assert.equal(f.providerRequests.length,2);
});

test('missing or aliased private signing authority holds History and preserves ordinary Annals',()=>{
  for(const risk of ['missing','same as public','same as History']){
    const f=fixture(), item=f.add(0), core=f.cx.AnnalsProduction, ordinary={...item.raw};
    delete ordinary.historyNarrative;
    f.props.ANNALS_APPROVAL_KEY=risk==='missing'?'':risk==='same as public'?
      f.props.ANNALS_PUBLISH_SIGNING_KEY:f.props.ANNALS_HISTORY_SIGNING_KEY;
    f.assess(item);
    assert.deepEqual(item.files.get('draft-private.json'),plain(core.candidate(ordinary,false)),risk);
    assert.equal(item.files.get('ai-response-private.json').historyAssessmentSignature,undefined,risk);
    assert.equal(f.providerRequests.length,1,risk);
    assert.deepEqual(f.publicReads,[],risk);
  }
});

test('a newer History edition only stales the draft when its selected chapter changes',()=>{
  for(const chapter of ['traditions','gatherings']){
    const f=fixture(), item=f.add(0), other=f.add(1,{narrative:proposal(second,{chapter,voice:1}),span:second});
    f.assess(item);
    const priorPreview=f.preview(item);
    f.compose(other); f.serveNext(); f.tick();
    assert.throws(()=>f.publish(priorPreview),/current History revision/);
    if(chapter==='traditions'){
      assert.throws(()=>f.preview(item),/requires current signed chapter context/);
      assert.equal(f.events.length,1);
    }else{
      const freshPreview=f.preview(item);
      assert.equal(f.publish(freshPreview).dispatchAccepted,true);
      assert.deepEqual(plain(f.signed().chapters.find(c=>c.id==='gatherings')),
        plain(f.rootFiles.get('history-published-private.json').chapters.find(c=>c.id==='gatherings')));
    }
    assert.equal(f.providerRequests.length,1);
  }
});

test('the existing sign-time read still holds when main advances before Pages',()=>{
  const f=fixture(), item=f.add(0);
  f.assess(item);
  const preview=f.preview(item);
  f.setMain({...f.opening,revision:f.opening.revision+1});
  assert.throws(()=>f.publish(preview),/requires current signed chapter context/);
  assert.equal(f.events.length,0);
  assert.equal(f.providerRequests.length,1);
});

test('the exact review and signer change only one chapter and reconcile without duplicate publication',()=>{
  const f=fixture(), item=f.add(0);
  const originals=plain([...item.files].filter(([name])=>!['draft-private.json','ai-attempt-private.json','ai-response-private.json'].includes(name)));
  f.tick(); f.tick();
  assert.equal(f.events.length,0);
  assert.throws(()=>f.preview(item,{chapter:'gatherings'}),/eligible current evidence/);
  const preview=f.preview(item);
  const assessed=plain(item.files.get('draft-private.json'));
  assert.equal(preview.claims.length,2);
  assert.equal(f.publish(preview).dispatchAccepted,true);
  assert.throws(()=>f.publish(preview),/Reconcile the prior History/);
  assert.deepEqual(plain(f.signed().chapters.slice(0,3)),f.opening.chapters.slice(0,3));
  assert.equal(passages(f.signed()).length,2);
  assert.doesNotMatch(JSON.stringify(f.events),/example\.test|claimTopics|I remember|bindingDigest|privateClaims|openingPacket/i);
  f.serveNext(); f.tick(); f.tick();
  assert.throws(()=>f.preview(item),/unused narrative source/);
  assert.equal(f.events.length,1);
  assert.deepEqual(plain([...item.files].filter(([name])=>!['draft-private.json','ai-attempt-private.json','ai-response-private.json'].includes(name))),originals);
  assert.deepEqual(plain(item.files.get('draft-private.json')),assessed);
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
  const flattened=fixture();
  item.draft.historyNarrative.paragraphs[0][0].text='Accounts differ, though one places the singing after the gathering.';
  const incomplete=flattened.add(0,{excerpt:evidence,publicText:evidence,narrative:item.draft.historyNarrative});
  assert.throws(()=>flattened.preview(incomplete),/composed History contract/);
  item.draft.historyNarrative=complete;
  complete.paragraphs[0].splice(1,0,{kind:'observation',text:'The furniture deserved no such interruption.',claims:[]});
  assert.throws(()=>f.preview(item),/requires current signed chapter context/);
  assert.equal(f.events.length,0);
  assert.equal(flattened.events.length,0);
});

test('placement under exact review preserves independently sourced accounts and active credits',()=>{
  const f=fixture(), first=f.add(0);
  f.compose(first); f.serveNext(); f.tick();
  const unrelated=f.add(1,{narrative:proposal(recall,{chapter:'gatherings',voice:1})});
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

test('the exact signed photo-only correction reconciles without a new History dispatch or editorial review',()=>{
  const f=fixture(), item=f.add(0), other=f.add(1,{span:second});
  f.compose(item); f.serveNext(); f.tick();
  f.compose(other); f.serveNext(); f.tick();
  const old=f.rootFiles.get('history-published-private.json');
  const correction=item.approve(item.approved.entry.summary,true,{sha256:'b'.repeat(64),alt:'A fictional drink'});
  const next=f.subtract();
  const corrected=plain(old.chapters);
  const binding=corrected.find(c=>c.id==='traditions').passages.find(p=>p.sources[0].entryId===item.entryId);
  binding.sources[0].digest=correction.receipt.contentSha256;
  assert.deepEqual(plain(next.chapters),corrected);
  assert.equal(next.revision,old.revision+1);
  assert.equal(f.events.length,2);

  const current=f.archive.approvals[0];
  f.archive.approvals[0]={...current,signature:'a'.repeat(64)};
  f.tick();
  assert.deepEqual(f.rootFiles.get('history-published-private.json'),old);
  f.archive.approvals[0]=current;

  f.failSnapshotWrite(); f.tick();
  assert.deepEqual(f.rootFiles.get('history-published-private.json'),old);
  assert.deepEqual(plain(f.rootFiles.get('history-bound-ledger-private.json').chapters),corrected);
  f.tick(); f.tick();
  assert.deepEqual(f.rootFiles.get('history-published-private.json'),plain(next));
  const proof=f.rootFiles.get('history-context-live-private.json');
  assert.equal(proof.revision,next.revision);
  assert.equal(proof.digest,historyDigest(next));
  const reads=f.publicReads.length;
  assert.equal(f.cx.annalsHistoryIntakeContext_().revision,next.revision);
  assert.equal(f.publicReads.length,reads);
  assert.equal(f.events.length,2);

  item.withdraw();
  const withdrawn=f.subtract(); f.tick();
  assert.equal(historyBacklinks(withdrawn).has(item.entryId),false);
  assert.equal(historyBacklinks(withdrawn).has(other.entryId),true);
  assert.deepEqual(f.rootFiles.get('history-published-private.json'),plain(withdrawn));
  assert.equal(f.events.length,2);
});

test('a withdrawal can overtake an interrupted photo-only update only through the verified checkpoint',()=>{
  const f=fixture(), item=f.add(0);
  f.compose(item); f.serveNext(); f.tick();
  const old=f.rootFiles.get('history-published-private.json');
  item.approve(item.approved.entry.summary,true,{sha256:'b'.repeat(64),alt:'A fictional drink'});
  const intermediate=f.subtract();
  f.failSnapshotWrite(); f.tick();
  assert.deepEqual(f.rootFiles.get('history-bound-ledger-private.json').chapters,plain(intermediate.chapters));
  item.withdraw();
  const final=f.subtract();

  const checkpoint=f.publications.find(p=>p.document.revision===intermediate.revision);
  const approval=checkpoint.archive.approvals[0];
  checkpoint.archive.approvals[0]={...approval,signature:'a'.repeat(64)};
  f.tick();
  assert.deepEqual(f.rootFiles.get('history-published-private.json'),old);
  checkpoint.archive.approvals[0]=approval;
  f.tick(); f.tick();
  assert.deepEqual(f.rootFiles.get('history-published-private.json'),plain(final));
  assert.deepEqual(plain(final.chapters),f.opening.chapters);
  assert.equal(f.events.length,1);
});

test('an automatic photo-only source update cannot restore an earlier History-only withdrawal',()=>{
  const f=fixture(), item=f.add(0);
  f.compose(item); f.serveNext(); f.tick();
  const {digest}=f.cx.annalsListHistoryMaintenance('fictional-owner');
  const {hash}=f.cx.annalsPrepareHistoryMaintenance('fictional-owner',digest,'traditions',passages(f.signed())[1].id,
    'withdraw','','The fictional recollection was withdrawn from History.');
  assert.equal(f.publish({hash}).dispatchAccepted,true);
  f.serveNext(); f.tick();
  item.approve(item.approved.entry.summary,true,{sha256:'b'.repeat(64),alt:'A fictional drink'});
  const after=f.subtract(); f.tick();
  assert.deepEqual(plain(after.chapters),f.opening.chapters);
  assert.throws(()=>f.preview(item),/withdrawn from Club History/);
  assert.equal(f.events.length,2);
});

test('a rebound History-only withdrawal survives a later signed correction of the same contribution',()=>{
  const f=fixture(), item=f.add(0), separate=f.add(1,{span:second});
  // Leave an unrelated narrative in place, without another portrait credit.
  separate.member.contributorPortraitPublication.revokedAt=at;
  f.compose(separate); f.serveNext(); f.tick();
  f.compose(item); f.serveNext(); f.tick();
  const approvedPhoto={sha256:'b'.repeat(64),alt:'An originally approved fictional drink photograph'};
  const first=item.approve(item.approved.entry.summary,true,approvedPhoto);
  const rebound=f.subtract(); f.tick();
  const used=passages(rebound).find(p=>p.sources[0].entryId===item.entryId);
  assert.equal(used.sources[0].digest,first.receipt.contentSha256);
  assert.deepEqual(keys(rebound),['fish']);

  const {digest}=f.cx.annalsListHistoryMaintenance('fictional-owner');
  const {hash}=f.cx.annalsPrepareHistoryMaintenance('fictional-owner',digest,'traditions',used.id,
    'withdraw','','The fictional member withdrew this contribution from History.');
  assert.equal(f.publish({hash}).dispatchAccepted,true);
  f.serveNext(); f.tick();
  const withdrawn=f.rootFiles.get('history-published-private.json');
  assert.deepEqual(keys(withdrawn),[]);
  assert.deepEqual(plain(passages(withdrawn)),plain(passages(rebound).filter(p=>p.id!==used.id)));
  const ledger=f.rootFiles.get('history-bound-ledger-private.json');
  assert.equal(ledger.ownerWithdrawnEntries[item.entryId],true);
  assert.deepEqual(Object.keys(ledger.ownerMaintainedSourceVersions),[item.entryId+':'+first.receipt.contentSha256]);

  const unrelated=item.approve(item.approved.entry.summary+' The curtain was repaired on a later date.',true,approvedPhoto);
  assert.notEqual(unrelated.receipt.contentSha256,first.receipt.contentSha256);
  f.subtract(); f.tick(); f.tick();
  assert.equal(f.events.length,3);
  assert.throws(()=>f.preview(item),/withdrawn from Club History/);
  assert.deepEqual(f.rootFiles.get('history-published-private.json'),withdrawn);
  assert.equal(historyBacklinks(withdrawn).has(separate.entryId),true);

  const newContribution=f.add(2,{narrative:proposal(recall,{chapter:'assemblies',voice:2})});
  assert.equal(f.compose(newContribution).dispatchAccepted,true);
  f.serveNext(); f.tick();
  assert.deepEqual(plain(passages(f.signed())),plain(passages(withdrawn)));
  assert.equal(historyBacklinks(f.signed()).has(item.entryId),false);
  assert.equal(historyBacklinks(f.signed()).has(newContribution.entryId),true);
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
    if(reason==='feature disabled')assert.throws(()=>f.compose(item),/requires current signed chapter context/);
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

test('publication verification does not spend a near-deadline tick on unrelated History markers',()=>{
  const f=fixture(), root=f.cx.annalsRoot_();
  const unrelated=Array.from({length:12},(_,index)=>({
    files:new Map(),getName:()=>index.toString(16).padStart(64,'a')
  }));
  let visited=0;
  root.getFolders=()=>({hasNext:()=>visited<unrelated.length,next:()=>unrelated[visited++]});
  const readFile=f.cx.annalsFile_;
  const markerNames=new Set(['quarantine-private.json','removal-private.json']);
  const priorElapsedMs=350_000, platformDeadlineMs=360_000;
  let elapsedMs=priorElapsedMs;
  f.cx.annalsFile_=(folder,name)=>{
    if(folder!==root&&markerNames.has(name))elapsedMs+=1_000; // Fictional Drive latency.
    return readFile(folder,name);
  };

  assert.equal(f.tick(),0);
  assert.equal(visited,unrelated.length);
  assert.ok(elapsedMs<platformDeadlineMs,`Fictional tick took ${elapsedMs} ms`);
  assert.equal(elapsedMs,priorElapsedMs,'Unrelated folders need no History marker lookups');
  assert.equal(f.events.length,0);
});

test('a linked History passage still honors removal and quarantine before applying a revocation',()=>{
  const f=fixture(), item=f.add(0);
  f.compose(item); f.serveNext(); f.tick();
  item.member.contributorPortraitPublication.revokedAt=at;

  const readFile=f.cx.annalsFile_, lookups=[];
  let unreadable=false;
  f.cx.annalsFile_=(folder,name)=>{
    if(folder.files===item.files&&['quarantine-private.json','removal-private.json'].includes(name)){
      lookups.push(name);
      if(unreadable&&name==='removal-private.json')throw new Error('Fictional Drive read failure');
    }
    return readFile(folder,name);
  };

  for(const [blocker,expected] of [
    ['quarantine-private.json',['quarantine-private.json']],
    ['removal-private.json',['quarantine-private.json','removal-private.json']]
  ]){
    item.files.set(blocker,{});
    f.tick();
    assert.deepEqual(lookups.splice(0),expected);
    assert.equal(f.events.length,1,'Blocked folders must not dispatch');
    item.files.delete(blocker);
  }

  unreadable=true;
  f.tick();
  assert.deepEqual(lookups.splice(0),['quarantine-private.json','removal-private.json']);
  assert.equal(f.events.length,1,'An unreadable marker must not authorize dispatch');
  unreadable=false;
  f.tick();
  assert.equal(f.events.length,2);
  assert.equal(passages(f.signed()).at(-1).sources[0].portrait,null);
  f.serveNext(); f.tick(); f.tick();
  assert.equal(f.events.length,2,'Settled revocation must not dispatch again');
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

function withdrawalsBeforeAcceptedReconciliation({betweenWithdrawals=false}={}){
  const f=fixture(), a=f.add(0), b=f.add(1,{span:second}), c=f.add(2,{narrative:proposal(recall,{chapter:'assemblies',voice:2})});
  c.member.contributorPortraitPublication.revokedAt=at;
  f.compose(a); f.serveNext(); f.tick(); f.compose(b); f.serveNext(); f.tick();
  const previous=f.rootFiles.get('history-published-private.json');
  assert.equal(f.compose(c).dispatchAccepted,true);
  f.serveNext(); // Its public successor arrives before the intake has reconciled this dispatch.
  a.withdraw();
  const middle=f.subtract();
  if(betweenWithdrawals)f.add(3,{narrative:null});
  b.withdraw();
  const final=f.subtract();
  return {f,a,b,c,previous,middle,final,accepted:f.signed()};
}

test('an accepted dispatch reconciles two signed withdrawals before its first reconciliation',()=>{
  const {f,c,previous,middle,final,accepted}=withdrawalsBeforeAcceptedReconciliation({betweenWithdrawals:true});
  const snapshot='history-published-private.json', ledger='history-bound-ledger-private.json';
  const pending='history-pending-private.json', evidence='history-live-'+accepted.revision+'-private.json';
  assert.equal(f.rootFiles.get(snapshot),previous);
  assert.equal(f.rootFiles.has(evidence),false);
  assert.equal(final.revision,accepted.revision+2);
  assert.deepEqual(keys(middle),['marc']);
  assert.deepEqual(keys(final),[]);
  assert.equal(historyBacklinks(final).has(c.entryId),true);
  assert.deepEqual(plain(final.chapters.find(ch=>ch.id==='assemblies')),plain(accepted.chapters.find(ch=>ch.id==='assemblies')));

  f.failSnapshotWrite(); f.tick();
  assert.deepEqual(f.rootFiles.get(snapshot),previous);
  assert.deepEqual(f.rootFiles.get(ledger).chapters,plain(final.chapters));
  assert.equal(f.rootFiles.get(evidence).supersededByRevision,final.revision);
  assert.equal(f.rootFiles.get(pending).state,'dispatch_accepted');
  f.tick(); f.tick();
  assert.deepEqual(f.rootFiles.get(snapshot),plain(final));
  assert.equal(f.rootFiles.get(pending).verifiedRevision,final.revision);
  assert.equal(f.events.length,3);
});

test('accepted reconciliation holds when the historical edge, signed edition or private journal is unverified',()=>{
  const cases=[
    ['unrelated intermediate Annals archive',({f,middle})=>{
      f.publications.find(row=>row.document.revision===middle.revision).archive=f.publications[0].archive;
    }],
    ['altered intermediate copy',({f,middle})=>{
      passages(f.publications.find(row=>row.document.revision===middle.revision).document)[0].text='Unrelated fictional wording.';
    }],
    ['missing intermediate commit',({f,middle})=>{
      f.publications.splice(f.publications.findIndex(row=>row.document.revision===middle.revision),1);
    }],
    ['nonmatching signed opening of the chain',({f,accepted})=>{
      passages(f.publications.find(row=>row.document.revision===accepted.revision).document)[0].text='Different fictional signed base.';
    }],
    ['altered reservation before first reconciliation',({f,accepted})=>{
      f.rootFiles.get('history-revision-'+accepted.revision+'-private.json').review.operation='unrelated';
    }],
    ['unrelated previous ledger metadata before first reconciliation',({f})=>{
      f.rootFiles.get('history-bound-ledger-private.json').ownerWithdrawnEntries={unrelated:true};
    }]
  ];
  for(const [reason,alter] of cases){
    const state=withdrawalsBeforeAcceptedReconciliation(), {f,previous,accepted}=state;
    alter(state); f.tick(); f.tick();
    assert.deepEqual(f.rootFiles.get('history-published-private.json'),previous,reason);
    assert.equal(f.rootFiles.get('history-pending-private.json').state,'dispatch_accepted',reason);
    assert.equal(f.rootFiles.has('history-live-'+accepted.revision+'-private.json'),false,reason);
    assert.equal(f.events.length,3,reason);
  }
});

test('an accepted reconciliation resumes an exact intermediate ledger after another withdrawal',()=>{
  const f=fixture(), a=f.add(0), b=f.add(1,{span:second});
  f.compose(a); f.serveNext(); f.tick();
  const snapshot='history-published-private.json', ledger='history-bound-ledger-private.json';
  const previous=f.rootFiles.get(snapshot);
  f.compose(b); f.serveNext();
  a.withdraw();
  const middle=f.subtract();
  f.failSnapshotWrite(); f.tick();
  const saved=f.rootFiles.get(ledger);
  assert.deepEqual(saved.chapters,plain(middle.chapters));
  assert.equal(f.rootFiles.get(snapshot),previous);
  b.withdraw();
  const final=f.subtract();
  const bad=plain(saved);
  passages(bad)[0].text='Unrelated private wording.';
  f.rootFiles.set(ledger,bad);
  f.tick();
  assert.equal(f.rootFiles.get(snapshot),previous);
  f.rootFiles.set(ledger,{...saved,ownerWithdrawnEntries:{unrelated:true}});
  f.tick();
  assert.equal(f.rootFiles.get(snapshot),previous);
  f.rootFiles.set(ledger,saved);
  f.tick(); f.tick();
  assert.deepEqual(f.rootFiles.get(snapshot),plain(final));
  assert.deepEqual(keys(final),[]);
  assert.equal(f.events.length,2);
});

test('an intermediate archive cannot simulate a withdrawal by keeping its entry without an approval',()=>{
  const {f,a,middle,previous,accepted}=withdrawalsBeforeAcceptedReconciliation();
  const committed=f.publications.find(row=>row.document.revision===middle.revision);
  committed.archive.entries.unshift(plain(a.approved.entry));
  committed.archive.retiredIds=[];
  const prediction=subtractStaleHistory(accepted,committed.archive.entries,committed.archive.approvals,new Date(at));
  assert.deepEqual(plain(prediction),plain(middle),'the unverified projection alone has the intended bytes');
  f.tick();
  assert.deepEqual(f.rootFiles.get('history-published-private.json'),previous);
  assert.equal(f.rootFiles.get('history-pending-private.json').state,'dispatch_accepted');
  assert.equal(f.events.length,3);
});

test('an intermediate changed entry with an invalid signed approval cannot remove History support',()=>{
  const {f,a,middle,previous,accepted}=withdrawalsBeforeAcceptedReconciliation();
  const committed=f.publications.find(row=>row.document.revision===middle.revision);
  const replacement={...plain(a.approved.entry),summary:'Revised fictional account.'};
  const serial=f.cx.AnnalsProduction.serial;
  const approval=f.cx.annalsPublicApproval_(replacement,{
    ...a.approved.receipt,approvedAt:new Date(Date.parse(at)-2000).toISOString(),reviewedBy:'fictional-owner',
    contentSha256:sha(serial(replacement))
  },f.props.ANNALS_PUBLISH_SIGNING_KEY);
  committed.archive.entries.unshift(replacement);
  committed.archive.approvals.unshift({...plain(approval),signature:'a'.repeat(64)});
  committed.archive.retiredIds=[];
  const prediction=subtractStaleHistory(accepted,committed.archive.entries,committed.archive.approvals,new Date(at));
  assert.deepEqual(plain(prediction),plain(middle),'changed bytes alone would remove the passage');
  f.tick();
  assert.deepEqual(f.rootFiles.get('history-published-private.json'),previous);
  assert.equal(f.rootFiles.get('history-pending-private.json').state,'dispatch_accepted');
  assert.equal(f.events.length,3);
});

test('a withdrawal edge requires its own contemporaneous signed receipt and no unrelated archive changes',()=>{
  const cases=[
    ['missing withdrawal receipt',({a})=>a.files.delete('removal-private.json')],
    ['wrong entry withdrawal',({a,b})=>a.files.set('removal-private.json',b.files.get('removal-private.json'))],
    ['valid signature for the wrong version of the same entry',({f,a})=>{
      const removal=a.files.get('removal-private.json');
      removal.entry={...removal.entry,summary:'A different fictional version of this account.'};
      removal.proof=f.cx.annalsPublicRemoval_(removal.entry,removal.approvedAt,f.props.ANNALS_PUBLISH_SIGNING_KEY);
    }],
    ['forged withdrawal signature',({a})=>{a.files.get('removal-private.json').proof.signature='a'.repeat(64);}],
    ['missing accepted dispatch',({a})=>a.files.delete('removal-dispatch-private.json')],
    ['real receipt signed after the claimed withdrawal commit',({f,a})=>{
      const removal=a.files.get('removal-private.json'), dispatch=a.files.get('removal-dispatch-private.json');
      const later=new Date(Date.parse(at)+1000).toISOString();
      removal.approvedAt=later;
      removal.proof=f.cx.annalsPublicRemoval_(removal.entry,later,f.props.ANNALS_PUBLISH_SIGNING_KEY);
      Object.assign(dispatch,{at:later,completedAt:later});
    }],
    ['withdrawal tombstones out of order',({f,final})=>{
      f.publications.find(row=>row.document.revision===final.revision).archive.retiredIds.reverse();
    }],
    ['live relevant approval differs from the final committed approval',({f,c})=>{
      f.archive.approvals.find(approval=>approval.entryId===c.entryId).signature='a'.repeat(64);
    }],
    ['live archive resurrects a source removed on an earlier edge',({f,a})=>{
      f.archive.retiredIds.shift();
      f.archive.entries.push(plain(a.approved.entry));
      f.archive.approvals.push(plain(a.approved.publication));
    }],
    ['an unrelated parent commit resurrects an earlier withdrawn entry',({f,a,b,final})=>{
      const last=f.publications.find(row=>row.document.revision===final.revision);
      const parent=f.commitParents.find(row=>row.sha===last.parents[0].sha);
      parent.archive.retiredIds=[];
      parent.archive.entries.unshift(plain(a.approved.entry));
      parent.archive.approvals.unshift(plain(a.approved.publication));
      last.archive.entries.unshift(plain(a.approved.entry));
      last.archive.approvals.unshift(plain(a.approved.publication));
      last.archive.retiredIds=[b.entryId];
      Object.assign(f.archive,plain(last.archive));
    }],
    ['separately signed unrelated addition in the same commit',({f,middle})=>{
      const other=f.add(3,{narrative:null});
      const archive=f.publications.find(row=>row.document.revision===middle.revision).archive;
      archive.entries.push(plain(other.approved.entry));
      archive.approvals.push(plain(other.approved.publication));
    }]
  ];
  for(const [reason,alter] of cases){
    const fixture=withdrawalsBeforeAcceptedReconciliation(), {f,previous,accepted}=fixture;
    alter(fixture); f.tick(); f.tick();
    assert.deepEqual(f.rootFiles.get('history-published-private.json'),previous,reason);
    assert.equal(f.rootFiles.get('history-pending-private.json').state,'dispatch_accepted',reason);
    assert.equal(f.rootFiles.has('history-live-'+accepted.revision+'-private.json'),false,reason);
    assert.equal(f.events.length,3,reason);
  }
});
