import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CHAPTER_IDS,historyCredits} from '../scripts/annals/BoundHistory.mjs';
import {emptyHistory} from '../scripts/annals/HistoryPublisher.mjs';
import {narrativeReviewDigest,stageHistoryNarrative} from '../scripts/annals/HistoryNarrative.mjs';

function fixture(mode='revision'){
  const current=mode==='opening'?emptyHistory():{schemaVersion:2,revision:7,updatedAt:'2030-01-01T00:00:00Z',
    chapters:CHAPTER_IDS.map(id=>({id,heading:'Published section',passages:[{id:'prior',text:'The prior record remains.',
      sources:[{kind:'record',ref:'prior-record'}]}]}))};
  const chapters=mode==='opening'?CHAPTER_IDS:['traditions'];
  const claims=chapters.flatMap(chapter=>[
    {id:chapter+'-note',chapter,status:'eligible',order:1,dispute:'',variant:'',uncertain:false,poignant:false,
      span:'A lantern was entered in the old exhibit inventory.',
      publicSource:{kind:'record',ref:'fictional-inventory'},portraitAllowed:false},
    {id:chapter+'-closure',chapter,status:'eligible',order:2,dispute:'',variant:'',uncertain:true,poignant:false,
      span:'The room possibly closed when the lamps ran low.',
      publicSource:{kind:'record',ref:'fictional-closing-note'},portraitAllowed:false}
  ]);
  const proposal={mode,chapter:mode==='revision'?chapters[0]:null,
    sections:chapters.map(chapter=>({id:chapter,heading:'The exhibit',paragraphs:[[
      {kind:'record',text:'The company added a lantern to its inventory.',claims:[chapter+'-note']},
      {kind:'observation',text:'The inventory thus acquired a little illumination.',claims:[]},
      {kind:'record',text:'The room may have closed as the lamps dimmed.',claims:[chapter+'-closure']}
    ]]}))};
  const evidence={aliases:['Tess','Téss Amber','The Lanternist'],claims};
  const reviewedDigest=narrativeReviewDigest(current,proposal,evidence);
  return {current,proposal,evidence,reviewedDigest};
}

const first=fixture=>fixture.proposal.sections[0].paragraphs[0];
const restamp=fixture=>({...fixture,reviewedDigest:narrativeReviewDigest(fixture.current,fixture.proposal,fixture.evidence)});

for(const mode of ['opening','revision']){
  test(mode+' accepts composed institutional staging with exact public bindings',()=>{
    const f=fixture(mode), snapshot=JSON.stringify(f);
    const draft=stageHistoryNarrative(f);
    assert.equal(draft.status,'staged');
    assert.equal(draft.chapters.length,4);
    const target=draft.chapters[mode==='opening'?0:3];
    assert.equal(target.passages[0].text,
      'The company added a lantern to its inventory. The inventory thus acquired a little illumination. The room may have closed as the lamps dimmed.');
    assert.deepEqual(target.passages[0].sources.map(source=>source.ref),['fictional-inventory','fictional-closing-note']);
    assert.doesNotMatch(JSON.stringify(draft),/Tess|Lanternist|possibly closed|old exhibit inventory|reviewedDigest/);
    if(mode==='revision')assert.deepEqual(draft.chapters.slice(0,3),f.current.chapters.slice(0,3));
    assert.equal(JSON.stringify(f),snapshot);
  });
}

test('unreviewed changes and any failed editorial check retain the exact last good projection',()=>{
  for(const mode of ['opening','revision']){
    const edits=[
      ['first-person institutional voice',f=>{first(f)[0].text='We added a lantern to the inventory.';}],
      ['first-person quoted voice',f=>{first(f)[0].text='The record begins with “I added a lantern.”';}],
      ['personal alias embedded in narration',f=>{first(f)[0].text='Tëss Amber added the lantern.';}],
      ['member nickname in a heading',f=>{f.proposal.sections[0].heading='The Lanternist';}],
      ['private source excerpt',f=>{first(f)[0].text=f.evidence.claims[0].span;}],
      ['attributed excerpt format',f=>{first(f)[0].text='A member recalls the lantern being added.';}],
      ['too many observations',f=>{first(f).splice(2,0,{kind:'observation',text:'The catalogue remained luminous.',claims:[]});}],
      ['poignant section with humour',f=>{f.evidence.claims[0].poignant=true;}],
      ['lost uncertainty',f=>{first(f)[2].text='The room closed as the lamps dimmed.';}],
      ['out of chronology',f=>{first(f).reverse();}],
      ['unbound factual clause',f=>{first(f)[0].claims=['unsupported-detail'];}],
      ['excluded trip claim',f=>{f.evidence.claims[0].status='excluded-origin-trip';}],
      ['excluded bylaws claim',f=>{f.evidence.claims[0].status='excluded-unadopted-bylaws';}],
      ['excluded trip copied into prose',f=>{first(f)[0].text='The company recorded a trip to Germany.';}],
      ['excluded bylaws copied into prose',f=>{first(f)[0].text='The company set out its draft bylaws.';}],
      ['roster injected into narrative scope',f=>{f.proposal.roster=[];}]
    ];
    for(const [reason,edit] of edits){
      const f=fixture(mode);edit(f);
      const held=stageHistoryNarrative(restamp(f));
      assert.equal(held.status,'held',mode+' '+reason);
      assert.equal(held.chapters,f.current.chapters,mode+' '+reason);
    }
  }

  const f=fixture();
  first(f)[0].text='The company added the lantern after the winter exhibition.';
  assert.equal(stageHistoryNarrative(f).status,'held','new facts not bound to the reviewed text');
  assert.equal(stageHistoryNarrative({...f,reviewedDigest:undefined}).status,'held','missing independent review digest');
  f.proposal.sections.push({...f.proposal.sections[0],id:'origins'});
  const wrongScope=stageHistoryNarrative(restamp(f));
  assert.equal(wrongScope.status,'held');
  assert.equal(wrongScope.chapters,f.current.chapters);
});

test('composition keeps incompatible evidence visible and strips only the revoked use of a portrait',()=>{
  const f=fixture(), [firstClaim,secondClaim]=f.evidence.claims;
  firstClaim.dispute='closing-time';
  firstClaim.variant='before the bell';
  firstClaim.span='The caretaker extinguished the lantern just before the final bell.';
  secondClaim.dispute='closing-time';
  secondClaim.variant='once the room had closed';
  secondClaim.span='The lantern still burned until the doors shut.';
  firstClaim.publicSource={kind:'annal',entryId:'annal-'+'a'.repeat(24),digest:'b'.repeat(64),
    label:'Supporting entry',portrait:'fish'};
  firstClaim.portraitAllowed=true;
  const paragraph=first(f);
  paragraph[0]={kind:'disagreement',text:'The accounts differ on whether the lantern went out before the bell or once the room had closed.',
    claims:[firstClaim.id,secondClaim.id]};
  firstClaim.uncertain=false;
  const later={...secondClaim,id:'later-fixture',dispute:'',variant:'',order:3,uncertain:false,
    span:'The caretaker put away the remaining display cards.',
    publicSource:{kind:'record',ref:'fictional-storage-note'}};
  f.evidence.claims.push(later);
  paragraph[2]={kind:'record',text:'The remaining cards went into storage.',claims:[later.id]};
  let draft=stageHistoryNarrative(restamp(f));
  assert.equal(draft.status,'staged');
  let projected={...f.current,chapters:draft.chapters};
  assert.deepEqual(historyCredits(projected).map(credit=>credit.key),['fish']);
  assert.equal(projected.chapters[3].passages[0].sources.length,3);
  firstClaim.portraitAllowed=false;
  draft=stageHistoryNarrative(restamp(f));
  assert.equal(draft.status,'staged');
  projected={...f.current,chapters:draft.chapters};
  assert.deepEqual(historyCredits(projected),[]);
  assert.equal(projected.chapters[3].passages[0].sources[0].portrait,null);
  assert.match(projected.chapters[3].passages[0].text,/accounts differ/);
  const completeCopy=paragraph[0].text;
  paragraph[0].text='The accounts differ, but the lantern went out before the bell.';
  assert.equal(stageHistoryNarrative(restamp(f)).status,'held','listing both sources does not preserve both accounts');
  paragraph[0].text=completeCopy;
  paragraph[0].claims.pop();
  assert.equal(stageHistoryNarrative(restamp(f)).status,'held','a competing account cannot be silently dropped');
});

test('poignant name-free prose can be staged without an observation',()=>{
  const f=fixture();
  f.evidence.claims[0].poignant=true;
  first(f).splice(1,1);
  assert.equal(stageHistoryNarrative(restamp(f)).status,'staged');
});
