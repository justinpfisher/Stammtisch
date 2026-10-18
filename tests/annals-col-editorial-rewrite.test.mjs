/* Fictional, local-only editorial rewrite qualification. No Gmail, AI or dispatch. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,createHmac} from 'node:crypto';
import Rules from '../scripts/annals/RulesCore.js';
import {EMPTY_STATE,MODES,EDITORIAL_EXPLANATION,snapshotHashes,stageCandidate} from '../scripts/annals/RulesStaged.mjs';
import {COL_RULE_PUBLIC_FILES} from '../scripts/annals/observe-hosted-col.mjs';
import {canonical,digest} from '../scripts/annals/RulesPublisher.mjs';
const date='2026-10-18T18:30:00.000Z',key='fictional-test-only-key-of-sufficient-length-000001',impl='c'.repeat(40),behavior='d'.repeat(64);
const files=Object.fromEntries(COL_RULE_PUBLIC_FILES.map(path=>[path,readFileSync(new URL('../'+path,import.meta.url),'utf8')]));
const versions=JSON.parse(files['data/col-rules-versions.json']);
const base=Rules.select(versions.versions,date);
const beforePoints=base.provisions.POINTS;
const beforePrize=base.provisions.PRIZE;
const afterPoints=beforePoints.replace('number of points','number  of points');
const afterPrize=beforePrize.replace('highest score','highest  score');
function fixture(){
  const request='Here are the updated CoL rules';
  const full=request+'\n'+afterPoints.split('\n').slice(1).join('\n').trim()+
    '\n'+afterPrize.split('\n').slice(1).join('\n').trim();
  const source={senderAuthenticated:true,member:'marc',freshOperativeWindow:true,replayed:false,truncated:false,
    text:full,receivedAt:date};
  const changes=[
    {provision:'POINTS',before:beforePoints,after:afterPoints,sourceExcerpt:'number  of points'},
    {provision:'PRIZE',before:beforePrize,after:afterPrize,sourceExcerpt:'highest  score'}
  ];
  const assessment={intent:'operative',requestExcerpt:request,changes,
    explanation:'Fictional editorial revision only.',clarification:'',effectiveAt:'',
    retrospective:{requested:false,period:'',results:'',clubAgreementExcerpt:''},correctionOf:''};
  const requestRecord=Rules.intake(source,assessment,base,'col-editorial-fictional-1');
  return {source,requestRecord,changes};
}
function signed(content){
  const approval={mode:MODES.stage,baseStateDigest:digest(EMPTY_STATE),issuedAt:date};
  const signature=createHmac('sha256',key).update(JSON.stringify(canonical({content,approval}))).digest('hex');
  return {content,approval:{...approval,signature}};
}
const witness={sourceDigest:'e'.repeat(64),observedAt:date,repoCommit:impl,workflowRun:'123456'};
function packageArgs(revision){
  const clean=Rules.publicRecord(revision);clean.baseDigest=revision.baseDigest;clean.explanation=EDITORIAL_EXPLANATION;
  const content={revision:clean,qualification:'editorial-rewrite-v1',baseFiles:snapshotHashes(files),
    implementationCommit:impl,behaviorDigest:behavior,source:null};
  return {state:EMPTY_STATE,files,envelope:signed(content),secret:key,enabled:true,
    now:new Date(date),implementationCommit:impl,behaviorDigest:behavior,
    sourceWitness:witness};
}
test('multi-section pure formatting rewrite is authenticated and bound to actual member words',()=>{
  const f=fixture();
  assert.equal(f.requestRecord.state,'awaiting_implementation');
  const qualified=Rules.editorialRewrite(f.source,f.requestRecord,base);
  assert.equal(qualified.kind,'editorial-rewrite-v1');
  assert.deepEqual(qualified.provisions,['POINTS','PRIZE']);
});
test('an independently signed hosted candidate preserves unchanged rules and every previous award parameter',()=>{
  const f=fixture();const args=packageArgs(f.requestRecord);
  const result=stageCandidate(args);
  assert.equal(result.candidate.kind,'non-operative-col-candidate');
  assert.equal(result.candidate.files['docs/celebration-of-life-rules.md'].includes(afterPoints),true);
  assert.equal(result.candidate.files['docs/celebration-of-life-rules.md'].includes(afterPrize),true);
  const candidateVersions=JSON.parse(result.candidate.files['data/col-rules-versions.json']).versions;
  assert.equal(candidateVersions.at(-1).verified,false);
  assert.equal(candidateVersions.at(-1).effectiveAt,null);
  assert.deepEqual(candidateVersions.at(-1).parameters,versions.versions[0].parameters);
  const changed=candidateVersions.at(-1).provisions;
  assert.equal(changed.POINTS,afterPoints);
  assert.equal(changed.PRIZE,afterPrize);
  for(const [name,body] of Object.entries(base.provisions))if(!['POINTS','PRIZE'].includes(name))assert.equal(changed[name],body);
  assert.equal(JSON.stringify(result.candidate).includes(f.source.text),false);
});
test('a changed scoring number, negation, punctuation or absent authored words cannot enter automatic rules',()=>{
  const f=fixture();
  const alterations=[
    afterPoints.replace('100 minus','101 minus'),
    afterPoints.replace('you lose points','you do not lose points'),
    afterPoints.replace('age at time','age, at time')
  ];
  for(const after of alterations){
    const record={...f.requestRecord,changes:[{...f.changes[0],after},f.changes[1]]};
    assert.throws(()=>Rules.editorialRewrite(f.source,record,base));
    assert.throws(()=>stageCandidate(packageArgs(record)),/rewrit|words|punctuation|param|editorial/i);
  }
  assert.throws(()=>Rules.editorialRewrite({...f.source,text:'Here are the updated CoL rules, but no section text.'},f.requestRecord,base));
});
test('jokes, unverified authors, retrospection, ambiguous intent and stale bases cannot auto-adopt',()=>{
  const f=fixture();
  for(const change of [{senderAuthenticated:false},{freshOperativeWindow:false},{replayed:true},{truncated:true},
    {text:'This is an historical quotation: '+f.source.text}]){
    assert.throws(()=>Rules.editorialRewrite({...f.source,...change},f.requestRecord,base));
  }
  for(const change of [{state:'discussion'},{effectiveAt:'2025-01-01T00:00:00Z'},
    {retrospective:{requested:true}},{baseDigest:'f'.repeat(64)},{correctionOf:'col-fake-reversal'}]){
    assert.throws(()=>Rules.editorialRewrite(f.source,{...f.requestRecord,...change},base));
  }
});
