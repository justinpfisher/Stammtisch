import { readFileSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import vm from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyHistoryRevision, emptyHistory, historyDigest, renderHistory } from '../scripts/annals/HistoryPublisher.mjs';
import { historyBacklinks, subtractStaleHistory } from '../scripts/annals/BoundHistory.mjs';

const modules=['PilotCore.js','ProductionCore.js','AutoCore.js','Production.gs','HistoryProduction.gs']
  .map(name=>[name,readFileSync(new URL('../scripts/annals/'+name,import.meta.url),'utf8')]);
const at='2026-11-21T17:00:00.000Z';
const historicalApprovalAt='2026-10-09T13:00:00.000Z';
const canon=x=>Array.isArray(x)?x.map(canon):x&&typeof x==='object'?Object.fromEntries(
  Object.keys(x).sort().map(k=>[k,canon(x[k])])):x;
const serial=x=>JSON.stringify(canon(x));
const digest=x=>createHash('sha256').update(x).digest('hex');
const fixture=(options={})=>{
  const today=options.currentHistory??emptyHistory(), store=new Map(), files=new Map(), events=[];
  const key='fictional test-only History authority'.repeat(2);
  const privateKey='fictional test-only Annals approval authority';
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
  const portraits=['marc','fish','matt','ken','jamie','jerome'];
  const allowed=portraits.map((_,index)=>'fictional-member'+index+'@example.test');
  const sender=allowed[0];
  const membership={clubMemberAuthenticated:true,externalContributionAtReceipt:false};
  const source={sourceId:id,senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,
    source:{sender,receivedAt:options.legacy?'2026-10-08T13:00:00.000Z':at,
      subject:'Fixture drink',excerpt:'A fictional recipe.\nServe chilled.'},...(options.legacy?{}:membership)};
  const grantAt='2026-10-01T00:00:00.000Z';
  const member={status:options.revoked?'revoked':'active',scope:'future_text_ai_drafting',consentedAt:grantAt,
    autoPublication:{status:'active',scope:'future_source_grounded_text_publication',consentedAt:grantAt},
    contributorPortraitPublication:{status:options.portraitRevoked?'revoked':'active',
      scope:'future_illustrated_contributor_identification',consentedAt:grantAt}};
  store.set('consent-registry-private.json',{schemaVersion:1,members:{[sender]:member}});
  files.set('source-private.json',source);
  const originalEntry={...archive.entries[0],title:'Original fictional title'};
  const unsignedProof={entryId,approvedAt:historicalApprovalAt,contentSha256:digest(serial(originalEntry)),
    mode:'standing-consent-text-v1',consents:{publication:true,namedAttribution:true}};
  const publication={...unsignedProof,signature:createHmac('sha256','fictional previous publication key')
    .update(serial({entry:originalEntry,approval:unsignedProof})).digest('hex')};
  const {mode,...receiptFields}=unsignedProof;
  const unsignedReceipt={...receiptFields,reviewedBy:'standing-consent-automation-v1'};
  const receipt={...unsignedReceipt,signature:createHmac('sha256',privateKey)
    .update(serial({entry:originalEntry,receipt:unsignedReceipt})).digest('hex')};
  const original={entry:originalEntry,publication,receipt,approvalMode:mode,publicationState:'dispatch_accepted'};
  const eligibility={state:'eligible',policy:mode,contentSha256:unsignedProof.contentSha256,
    sourceDigest:digest(source.source.subject+'\n'+source.source.excerpt),consentCheckedAt:historicalApprovalAt};
  if(options.legacy){
    files.set('approval-private.json',original);
    files.set('auto-decision-private.json',options.reassessed?{state:'held'}:eligibility);
    if(options.reassessed)files.set('auto-reassessment-private.json',eligibility);
  }
  let publicHistory=today, tick=new Date(at);
  const props={ANNALS_HISTORY_PUBLICATION_ENABLED:'true',ANNALS_SIGNING_REMEDIATED_AT:at,ANNALS_HISTORY_SIGNING_KEY:key,
    ANNALS_APPROVAL_KEY:privateKey,ANNALS_ALLOWED_SENDERS:allowed.join(','),
    ANNALS_SPEAKER_IDENTITIES:JSON.stringify(Object.fromEntries(allowed.map((address,i)=>[address,portraits[i]])))};
  const c=vm.createContext({
    Date:class extends Date{constructor(...a){super(...(a.length?a:[tick.toISOString()]));}},
    Utilities:{Charset:{UTF_8:'UTF-8'},computeHmacSha256Signature:(message,key)=>createHmac('sha256',key).update(message).digest()},
    AnnalsPublicDisplay:{historyPage:renderHistory},
    UrlFetchApp:{fetch:url=>({getResponseCode:()=>200,getContentText:()=>url.endsWith('annals-approved.json')?
      JSON.stringify(archive):url.endsWith('history.html')?renderHistory(publicHistory)+'\n':JSON.stringify(publicHistory)})}
  });
  for(const [name,code] of modules)vm.runInContext(code,c,{filename:name});
  Object.assign(c,{
    annalsHash_:digest,annalsHex_:b=>b.toString('hex'),
    annalsRoot_:()=> 'private',annalsProps_:()=>({getProperty:k=>props[k]}),
    annalsFolder_:value=>{if(value!==id)throw Error('Bad source binding');return value;},
    annalsRead_:(f,n)=>(f===id?files:store).get(n),
    annalsFile_:(f,n)=>(f===id?files:store).has(n),
    annalsUiCall_:(nonce,fn)=>{if(nonce!=='owner')throw Error('Not owner');return fn();},
    annalsLocked_:fn=>fn(),
    annalsWriteOnce_:(f,n,v)=>{const target=f===id?files:store;if(target.has(n))throw Error('Already exists');target.set(n,v);},
    annalsSavePrivate_:(f,n,v)=>(f===id?files:store).set(n,v),
    annalsDispatchEvent_:(f,action,payload)=>{events.push({action,client_payload:payload});return !options.dispatchFailed;},
  });
  c.ANNALS_HISTORY_OPENING_COPY_SHA_=digest(serial(chapters));
  c.ANNALS_HISTORY_OPENING_SOURCES_={'gatherings/opening-1':[
    ['record','fictional-record'],['annal',entryId,'Fixture drink','marc']]};
  c.ANNALS_HISTORY_OPENING_ANNALS_SHA_={[entryId]:archive.approvals[0].contentSha256};
  c.ANNALS_HISTORY_OPENING_LEGACY_PROOF_SHA_=options.legacy?{[entryId]:digest(serial(publication))}:{};
  const readback=()=>{publicHistory=applyHistoryRevision({current:today,event:events[0],secret:key,enabled:true,now:tick});};
  return {c,archive,packet,events,props,store,files,source,original,eligibility,member,allowed,readback};
};

test('opening signed via the existing owner-only route; ledger advances only after exact served bytes',()=>{
  const f=fixture(),c=f.c;
  assert.throws(()=>c.annalsPreviewHistoryOpening('other'),/Not owner/);
  const p=c.annalsPreviewHistoryOpening('owner');
  assert.equal(p.portraitCount,1);
  assert.equal(p.chapterCount,1);
  assert.equal(c.annalsPublishHistoryOpening('owner',p.previewDigest,true).dispatchAccepted,true);
  assert.doesNotMatch(JSON.stringify(f.events),/example\.test|private-pointer|fixture-only|privateOpeningPacket/);
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

test('opening accepts the matching historical decision and preserves the private evidence and signatures',()=>{
  const modernPreview=fixture().c.annalsPreviewHistoryOpening('owner').previewDigest;
  for(const reassessed of [false,true]){
    const f=fixture({legacy:true,reassessed}), c=f.c, before=serial([...f.files]);
    assert.throws(()=>c.annalsOrdinarySourceGate_(f.source),/Authenticated member source/);
    const p=c.annalsPreviewHistoryOpening('owner');
    assert.equal(p.previewDigest,modernPreview);
    assert.equal(serial([...f.files]),before);
    assert.equal(c.annalsPublishHistoryOpening('owner',p.previewDigest,true).dispatchAccepted,true);
    assert.equal(serial([...f.files]),before);
    assert.equal(c.annalsPrivateReceiptValid_(f.original.entry,f.original.receipt),true);
    const payload=JSON.stringify(f.events);
    assert.doesNotMatch(payload,/example\.test|Original fictional title|standing-consent-text-v1|privateOpeningPacket|A fictional recipe\./);
    assert.equal(payload.includes(f.eligibility.sourceDigest),false);
  }
});

test('opening holds when the historical membership evidence is absent, wrong or contradictory',()=>{
  const cases=[
    ['missing original',f=>f.files.delete('approval-private.json')],
    ['unexpected legacy entry',f=>f.c.ANNALS_HISTORY_OPENING_LEGACY_PROOF_SHA_={}],
    ['wrong proof signature',f=>f.original.publication.signature='b'.repeat(64)],
    ['wrong signed content',f=>f.original.entry.title='Changed after signing'],
    ['wrong source id',f=>f.source.sourceId='a'.repeat(24)+'b'.repeat(40)],
    ['mismatched receipt time',f=>f.source.source.receivedAt=at],
    ['unverified sender',f=>f.source.senderAuthenticated=false],
    ['nonmember address',f=>f.source.source.sender='outsider@example.test'],
    ['different member',f=>{f.store.get('consent-registry-private.json').members[f.allowed[1]]=f.member;
      f.source.source.sender=f.allowed[1];}],
    ['synthetic source',f=>f.source.syntheticFixture=true],
    ['unauthorized source route',f=>f.source.protectiveRoute='col_proposal'],
    ['truncated source',f=>f.source.source.sourceTruncated=true],
    ['partial member fields',f=>f.source.clubMemberAuthenticated=true],
    ['explicit nonmember',f=>f.source.clubMemberAuthenticated=false],
    ['explicit external contributor',f=>f.source.externalContributionAtReceipt=true],
    ['missing receipt-time grant',f=>delete f.source.autoConsentAtReceipt]
  ];
  for(const [reason,edit] of cases){
    const f=fixture({legacy:true}); edit(f);
    assert.throws(()=>f.c.annalsPreviewHistoryOpening('owner'),
      /provenance or permission|legacy membership evidence|Authenticated member source/,reason);
    assert.equal(f.events.length,0,reason);
  }
});

test('opening requires the exact retained subject and excerpt bound to the original signed content',()=>{
  const cases=[
    ['different subject',f=>f.source.source.subject='Another fictional drink'],
    ['different excerpt',f=>f.source.source.excerpt='A different fictional recipe.'],
    ['changed excerpt with modern membership fields',f=>{
      Object.assign(f.source,{clubMemberAuthenticated:true,externalContributionAtReceipt:false});
      f.source.source.excerpt='A different fictional recipe.';
    }],
    ['missing subject',f=>delete f.source.source.subject],
    ['missing excerpt',f=>delete f.source.source.excerpt],
    ['missing decision',f=>f.files.delete('auto-decision-private.json')],
    ['ineligible decision',f=>f.eligibility.state='held'],
    ['wrong policy',f=>f.eligibility.policy='standing-consent-quote-v1'],
    ['wrong original approval mode',f=>f.original.approvalMode='standing-consent-quote-v1'],
    ['missing source digest',f=>delete f.eligibility.sourceDigest],
    ['wrong source digest',f=>f.eligibility.sourceDigest='b'.repeat(64)],
    ['missing signed content digest',f=>delete f.eligibility.contentSha256],
    ['current rather than original signed content',f=>f.eligibility.contentSha256=f.archive.approvals[0].contentSha256],
    ['conflicting eligible reassessment',f=>f.files.set('auto-reassessment-private.json',{...f.eligibility})],
    ['malformed subject boundary',f=>{
      const [firstLine,rest]=f.source.source.excerpt.split('\n');
      f.source.source.subject+='\n'+firstLine;
      f.source.source.excerpt=rest;
      assert.equal(digest(f.source.source.subject+'\n'+f.source.source.excerpt),f.eligibility.sourceDigest);
    }],
  ];
  for(const [reason,edit] of cases){
    const f=fixture({legacy:true});
    const {previewDigest}=f.c.annalsPreviewHistoryOpening('owner');
    edit(f);
    const error=/legacy source-to-approval evidence/;
    assert.throws(()=>f.c.annalsPreviewHistoryOpening('owner'),error,reason);
    assert.throws(()=>f.c.annalsPublishHistoryOpening('owner',previewDigest,true),error,reason);
    assert.equal(f.events.length,0,reason);
  }
});

test('opening requires a matching reassessment after a historical hold',()=>{
  const cases=[
    ['missing initial hold',f=>f.files.delete('auto-decision-private.json')],
    ['missing reassessment',f=>f.files.delete('auto-reassessment-private.json')],
    ['mismatched reassessment',f=>f.eligibility.contentSha256='b'.repeat(64)],
  ];
  for(const [reason,edit] of cases){
    const f=fixture({legacy:true,reassessed:true}); edit(f);
    assert.throws(()=>f.c.annalsPreviewHistoryOpening('owner'),/legacy source-to-approval evidence/,reason);
    assert.equal(f.events.length,0,reason);
  }
});

test('opening rechecks revocation and private withdrawal at the release boundary',()=>{
  const cases=[
    ['AI consent',f=>f.member.revokedAt=at],
    ['standing publication',f=>f.member.autoPublication.revokedAt=at],
    ['portrait consent',f=>f.member.contributorPortraitPublication.revokedAt=at],
    ['member removed from registry',f=>f.props.ANNALS_ALLOWED_SENDERS=f.allowed.slice(1).join(',')],
    ['quarantine',f=>f.files.set('quarantine-private.json',{})],
    ['pending removal',f=>f.files.set('removal-private.json',{state:'approved_removal_pending'})]
  ];
  for(const [reason,revoke] of cases){
    const f=fixture({legacy:true});
    const {previewDigest}=f.c.annalsPreviewHistoryOpening('owner');
    revoke(f);
    assert.throws(()=>f.c.annalsPublishHistoryOpening('owner',previewDigest,true),/provenance or permission/,reason);
    assert.equal(f.events.length,0,reason);
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

test('the editorial refresh atomically signs exact approved copy, preserves evidence and renders the crest separately',()=>{
  const current=JSON.parse(readFileSync(new URL('../data/club-history.json',import.meta.url),'utf8'));
  const currentHtml=readFileSync(new URL('../history.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  assert.equal(renderHistory(current)+'\n',currentHtml);
  // Keep the one-time operation testable after the real revision advances.
  const record={kind:'record',ref:'club-record'};
  const source=(id,label,portrait)=>({kind:'annal',entryId:'annal-'+id,label,portrait,digest:'b'.repeat(64)});
  const passage=(id,sources)=>({id,text:'Fictional opening evidence.',sources});
  const opening=current.revision===1?current:{schemaVersion:2,revision:1,updatedAt:at,chapters:[
    {id:'origins',heading:'Fictional origins',passages:[passage('opening-1',[record])]},
    {id:'gatherings',heading:'Fictional gatherings',passages:[
      passage('opening-1',[record]),passage('opening-2',[record,
        source('96b5ae266a36793c6a203033','Kingston Windfall','marc'),
        source('5e0607c7dc924fb5663c40e0','Daq in Black','marc')])]},
    {id:'assemblies',heading:'Fictional assemblies',passages:[passage('opening-1',[record])]},
    {id:'traditions',heading:'Fictional traditions',passages:[passage('opening-1',[record]),
      passage('opening-2',[source('f463f9566e3d9c3fe09465de','Christisch','fish')])]}
  ]};
  const f=fixture({currentHistory:opening}), c=f.c;
  if(current.revision!==1)c.ANNALS_HISTORY_EDITORIAL_BASE_=historyDigest(opening);
  const packet=f.store.get('history-opening-authorized-private.json');
  const provenance={schemaVersion:1,privateOpeningPacketSha256:digest(serial(packet)),chapters:opening.chapters};
  f.store.set('history-bound-ledger-private.json',provenance);
  f.store.set('history-published-private.json',opening);
  assert.equal(c.ANNALS_HISTORY_EDITORIAL_BASE_,historyDigest(opening));
  let verifiedChapters=opening.chapters;
  c.annalsOpeningEdition_=(staged,archive,allowUncredited)=>{
    assert.equal(staged,packet);
    assert.equal(archive.entries[0].id,f.archive.entries[0].id);
    assert.equal(allowUncredited,true);
    return verifiedChapters;
  };
  const normalize=value=>JSON.parse(JSON.stringify(value));
  const evidence=chapters=>Object.fromEntries(chapters.flatMap(ch=>ch.passages.map(p=>[
    ch.id+'/'+p.id,p.sources.map(s=>s.kind==='annal'?{entryId:s.entryId,digest:s.digest}:s)
  ])));
  assert.throws(()=>c.annalsPreviewHistoryEditorial('other'),/Not owner/);
  const preview=c.annalsPreviewHistoryEditorial('owner'), chapters=normalize(preview.chapters);
  assert.deepEqual(chapters.map(ch=>ch.heading),[
    'The name','The appointed evening','The Annual Gentlemen’s Assembly','The Club’s observances'
  ]);
  assert.deepEqual(evidence(chapters),evidence(opening.chapters));
  assert.deepEqual(chapters[3].passages.map(p=>p.id),['opening-2','opening-1']);
  assert.doesNotMatch(JSON.stringify(chapters.map(c=>c.passages.map(p=>[p.text,p.sources.map(s=>s.label)]))),
    /\b(?:Justin|Fish|Marc|Matt|Ken|Jamie|Jerome|Germany|constitution|bylaws|we)\b/i);
  assert.throws(()=>c.annalsPublishHistoryEditorial('owner',preview.previewDigest,false),/Confirm/);
  packet.records['fictional-record'].reviewedMeaning='changed';
  assert.throws(()=>c.annalsPublishHistoryEditorial('owner',preview.previewDigest,true),/Opening evidence changed/);
  packet.records['fictional-record'].reviewedMeaning='fixture-only';
  verifiedChapters=opening.chapters.map(ch=>({...ch,passages:ch.passages.map(p=>({...p,sources:p.sources.map(s=>
    s.kind==='annal'&&s.portrait==='fish'?{...s,portrait:null}:s)}))}));
  assert.throws(()=>c.annalsPublishHistoryEditorial('owner',preview.previewDigest,true),/Editorial preview changed/);
  const updated=c.annalsPreviewHistoryEditorial('owner');
  assert.notEqual(updated.previewDigest,preview.previewDigest);
  const before=serial([...f.files]);
  assert.equal(c.annalsPublishHistoryEditorial('owner',updated.previewDigest,true).dispatchAccepted,true);
  const {document}=f.events[0].client_payload;
  assert.equal(document.revision,2);
  assert.equal(f.store.get('history-published-private.json'),opening);
  assert.equal(serial([...f.files]),before);
  assert.doesNotMatch(serial(f.events),/privateOpeningPacket|fixture-only|example\.test/);
  assert.deepEqual([...historyBacklinks(document).get('annal-f463f9566e3d9c3fe09465de')],[['traditions','The Club’s observances']]);
  const html=renderHistory(document);
  assert.match(html,/<section class="history-company"><h2>The company<\/h2><img src="assets\/crest\.webp"/);
  assert.match(html,/<section class="history-contributors"><h2>Contributors to Club History<\/h2>/);
  assert.doesNotMatch(html,/fish-annals\.webp/);
  assert.match(html,/annals\.html#annal-f463f9566e3d9c3fe09465de">Christisch in the Annals<\/a>/);
  for(const id of ['origins','gatherings','assemblies','traditions'])assert.match(html,new RegExp('id="chapter-'+id+'"'));
  f.readback();
  assert.equal(c.annalsReconcileHistory('owner').revision,2);
  assert.equal(f.store.get('history-bound-ledger-private.json').privateOpeningPacketSha256,provenance.privateOpeningPacketSha256);
  assert.throws(()=>c.annalsPublishHistoryEditorial('owner',updated.previewDigest,true),/exact reconciled opening edition/);
  assert.equal(f.events.length,1);

  const annals=chapters.flatMap(ch=>ch.passages.flatMap(p=>p.sources.filter(s=>s.kind==='annal')));
  const keep=annals.filter(s=>s.label!=='Kingston Windfall');
  const entries=keep.map(s=>({id:s.entryId,contributorPortrait:s.portrait}));
  const approvals=keep.map(s=>({entryId:s.entryId,contentSha256:s.digest,consents:{namedAttribution:true}}));
  const projection=subtractStaleHistory(document,entries,approvals,new Date(at));
  assert.deepEqual(normalize(c.annalsPredictHistorySubtraction_(document,entries,approvals,new Date(at))),normalize(projection));
  const remaining=projection.chapters.find(ch=>ch.id==='gatherings').passages[1].text;
  assert.match(remaining,/Daq in Black is in the Annals\. The Club has also fielded a Mud Hero team/);
  assert.doesNotMatch(remaining,/Kingston Windfall/);
});

test('the editorial evidence check can omit a revoked portrait but never waives standing publication',()=>{
  const f=fixture({legacy:true,portraitRevoked:true});
  assert.throws(()=>f.c.annalsOpeningEdition_(f.packet,f.archive),/provenance or permission/);
  assert.equal(f.c.annalsOpeningEdition_(f.packet,f.archive,true)[0].passages[0].sources[1].portrait,null);
  f.member.autoPublication.revokedAt=at;
  assert.throws(()=>f.c.annalsOpeningEdition_(f.packet,f.archive,true),/provenance or permission/);
});
