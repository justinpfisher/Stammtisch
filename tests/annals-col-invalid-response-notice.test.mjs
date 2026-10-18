/* Fictional CoL failure handling: no live mail, provider, Drive or signed release. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const production = readFileSync(new URL('../scripts/annals/RulesProduction.gs',import.meta.url),'utf8');
const core = readFileSync(new URL('../scripts/annals/RulesCore.js',import.meta.url),'utf8');
const messageId = 'a'.repeat(64);
const address = 'fictional.member@example.test';
const originalText = 'Updated fictional CoL rules: the actual original wording remains private.';
const source = {sourceId:messageId,senderAuthenticated:true,rulesAuthorityVersion:2,
  rulesActivationEligible:true,aiConsentActive:true,source:{
    sender:address,subject:'Fictional CoL update',excerpt:originalText,
    receivedAt:'2026-10-18T17:00:00Z',sourceTruncated:false,
    subjectTruncated:false,excerptTruncated:false}};
const base = {id:'col-fixture-base',digest:'f'.repeat(64),provisions:{
  POINTS:'## POINTS\n\nOriginal fictional calculation.'}};
const assessment = {intent:'operative',requestExcerpt:'AI paraphrase absent from source',
  changes:[{provision:'POINTS',before:base.provisions.POINTS,
    after:'## POINTS\n\nAI-generated fictional calculation.',
    sourceExcerpt:'AI-generated text absent from member message'}],
  explanation:'A fictional request.',clarification:'',effectiveAt:'',
  retrospective:{requested:false,period:'',results:'',clubAgreementExcerpt:''},correctionOf:''};
const response = {status:'completed',output:[{type:'message',content:[
  {type:'output_text',text:JSON.stringify(assessment)}]}]};

function fixture(ownerNoticeFails=false){
  const props={ANNALS_RULES_ACCEPT_FROM:'2026-10-01T00:00:00Z',
    ANNALS_AI_ENABLED:'true',ANNALS_OWNER_EMAIL:'owner@example.test',
    ANNALS_REVIEW_URL:'https://example.test/private',
    ANNALS_BUDGET_LEDGER:JSON.stringify({reservedCents:0})};
  const written=new Map(),notices=[],outcomes=[],calls=[];
  const ctx=vm.createContext({Utilities:{formatDate:()=> '2026-10'}});
  vm.runInContext(core,ctx);
  vm.runInContext(production,ctx);
  Object.assign(ctx,{
    annalsProps_:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=v;}}),
    annalsFolder_:()=>({}),annalsRoot_:()=>({}),
    annalsRead_:(_,name)=>name==='source-private.json'?source:null,
    annalsRulesReady_:()=>true,annalsConsentActive_:()=>true,
    annalsStandingPublicationActive_:()=>true,
    annalsPublisherDispatchReady_:()=>true,
    annalsStagedRulesReady_:()=>false,
    annalsFile_:(_,name)=>written.get(name)||null,
    annalsWriteOnce_:(_,name,value)=>{
      if(written.has(name))throw Error('A one-shot record would be overwritten');
      written.set(name,value);
    },
    annalsRecordAttemptOutcome_:(_,reason,httpStatus)=>outcomes.push({reason,httpStatus}),
    annalsRuleNotice_:(_,to,kind,body)=>{
      if(ownerNoticeFails&&kind==='invalid-response-owner')throw Error('fictional notification fault');
      notices.push({to,kind,body});return true;
    },
    annalsAiSourceText_:s=>s.source.subject+'\n'+s.source.excerpt,
    annalsSpeakerIdentities_:()=>({[address]:'fish'}),
    AnnalsProduction:{MODEL:'fictional-test-model',reserve:x=>x},
    UrlFetchApp:{fetch:url=>{
      calls.push(url);
      if(url.includes('col-rules-versions.json'))return{
        getResponseCode:()=>200,getContentText:()=>JSON.stringify({versions:[base]})};
      if(url.includes('/v1/responses'))return{
        getResponseCode:()=>200,getContentText:()=>JSON.stringify(response)};
      throw Error('Unexpected external request');
    }}
  });
  return {ctx,written,notices,outcomes,calls};
}

test('unmapped AI prose is held without publication or a second provider attempt and alerts owner',()=>{
  const f=fixture();
  assert.equal(f.ctx.annalsProcessRuleRequest_(messageId),false);
  assert.deepEqual(f.outcomes,[{reason:'invalid_response',httpStatus:200}]);
  assert.equal(f.written.has('ai-attempt-private.json'),true);
  assert.equal(f.written.has('ai-response-private.json'),true);
  assert.equal(f.written.has('col-rule-request-private.json'),false);
  assert.deepEqual(f.notices.map(v=>v.kind),
    ['received','outcome','invalid-response-owner']);
  assert.equal(f.notices.at(-1).to,'owner@example.test');
  assert.doesNotMatch(f.notices.at(-1).body,/AI paraphrase absent|AI-generated fictional|fictional calculation/);
  assert.equal(f.calls.filter(url=>url.includes('/v1/responses')).length,1);
  assert.equal(f.ctx.annalsProcessRuleRequest_(messageId),false);
  assert.equal(f.calls.filter(url=>url.includes('/v1/responses')).length,1);
  assert.equal(f.notices.length,3);
});

test('failed owner notification does not undo the one-shot CoL response hold',()=>{
  const f=fixture(true);
  assert.equal(f.ctx.annalsProcessRuleRequest_(messageId),false);
  assert.equal(f.written.has('ai-attempt-private.json'),true);
  assert.equal(f.written.has('ai-response-private.json'),true);
  assert.equal(f.written.has('col-rule-request-private.json'),false);
  assert.deepEqual(f.outcomes,[{reason:'invalid_response',httpStatus:200}]);
  assert.equal(f.calls.filter(url=>url.includes('/v1/responses')).length,1);
});
