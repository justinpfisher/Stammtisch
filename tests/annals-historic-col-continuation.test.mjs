/* Fictional private adapter fixtures only. No Gmail, provider, keys or publication. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const core=readFileSync(new URL('../scripts/annals/RulesCore.js',import.meta.url),'utf8');
const script=readFileSync(new URL('../scripts/annals/RulesProduction.gs',import.meta.url),'utf8');
const ui=readFileSync(new URL('../scripts/annals/ReviewUi.html',import.meta.url),'utf8');
const prod=readFileSync(new URL('../scripts/annals/Production.gs',import.meta.url),'utf8');
const current=JSON.parse(readFileSync(new URL('../data/col-rules-versions.json',import.meta.url),'utf8')).versions[0];
const from='fictional-member@example.invalid',id='b'.repeat(64),receivedAt='2026-10-17T00:33:37.000Z';
const body='Whoever had the oldest death in the year gets a steal. This is effective immediately';
const source=()=>({
  rulesAuthorityVersion:2,rulesActivationEligible:false,senderAuthenticated:true,
  aiConsentActive:true,autoConsentAtReceipt:true,protectiveRoute:'col_proposal',
  source:{sender:from,receivedAt,subject:'Fictional CoL request',excerpt:body,
    sourceTruncated:false,subjectTruncated:false,excerptTruncated:false}
});

function setup() {
  const folder='fictional-private-folder',map=new Map([['source-private.json',source()]]);
  const scope={annalsFolder_:()=>folder,annalsRoot_:()=> 'fictional-private-root',
    annalsFile_:(_f,name)=>map.has(name),
    annalsRead_:(_f,name)=>map.get(name)||null,
    annalsWriteOnce_:(_f,name,value)=>{if(map.has(name))throw Error('Consumed once');map.set(name,value);},
    annalsConsentActive_:()=>true,annalsStandingPublicationActive_:()=>true,
    annalsUiCall_:(nonce,fn)=>{assert.equal(nonce,'owner-only-fictitious-nonce');return fn();},
    annalsLocked_:fn=>fn(),annalsSpeakerIdentities_:()=>({[from]:'fish'}),
    annalsProps_:()=>({getProperty:name=>name==='ANNALS_RULES_V3_AUTO_OLDEST_ENABLED'?'true':null})
  };
  const context=vm.createContext(scope);
  vm.runInContext(core,context);vm.runInContext(script,context);
  context.annalsStagedRulesReady_=()=>true;
  context.annalsRuleContext_=()=>({base:structuredClone(current)});
  context.annalsStageOldestRule_=()=>({dispatchAccepted:true});
  return {context,map,folder};
}

test('pre-gate member original remains ineligible without separately reserved owner continuation',()=>{
  const {context,map,folder}=setup();
  assert.equal(context.annalsHistoricOldestContinuationReady_(folder,map.get('source-private.json')),true);
  assert.throws(()=>context.annalsRuleFreshSource_(id),/Current authenticated private request/);
  map.set('col-oldest-continuation-private.json',{kind:'historic-owner-oldest-v1',schemaVersion:1,sourceId:'c'.repeat(64),receivedAt,state:'reserved'});
  assert.throws(()=>context.annalsRuleFreshSource_(id),/Current authenticated private request/);
});

test('one owner-authenticated continuation retains original receipt, saves one request and never claims live publication',()=>{
  const {context,map}=setup();
  const before=JSON.stringify(map.get('source-private.json'));
  const result=context.annalsContinueHistoricOldestRule('owner-only-fictitious-nonce',id);
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{continuationRecorded:true,dispatchAccepted:true,published:false,retryAllowed:false});
  assert.equal(JSON.stringify(map.get('source-private.json')),before);
  assert.equal(map.get('col-oldest-continuation-private.json').receivedAt,receivedAt);
  assert.equal(map.get('col-oldest-continuation-private.json').sourceId,id);
  assert.equal(map.get('col-rule-request-private.json').state,'awaiting_implementation');
  assert.equal(map.get('col-rule-request-private.json').submittedAt,receivedAt);
  assert.equal(map.get('col-rule-request-private.json').effectiveAt,null);
  assert.equal(context.annalsRuleFreshSource_(id).request.id,'col-'+id.slice(0,24));
  assert.throws(()=>context.annalsContinueHistoricOldestRule('owner-only-fictitious-nonce',id),/Only one unconsumed/);
});

test('historic continuation refuses quarantines, consumed attempts, revoked standing grants and altered intent',()=>{
  for(const marker of ['quarantine-private.json','ai-attempt-private.json','col-proposal-private.json','col-rule-request-private.json','col-v3-stage-dispatch-private.json']){
    const {context,map,folder}=setup();map.set(marker,{state:'existing'});
    assert.equal(context.annalsHistoricOldestContinuationReady_(folder,map.get('source-private.json')),false,marker);
    assert.throws(()=>context.annalsContinueHistoricOldestRule('owner-only-fictitious-nonce',id),/Only one unconsumed/);
  }
  for(const field of ['senderAuthenticated','aiConsentActive','autoConsentAtReceipt']){
    const {context,map,folder}=setup();map.get('source-private.json')[field]=false;
    assert.equal(context.annalsHistoricOldestContinuationReady_(folder,map.get('source-private.json')),false,field);
  }
  const {context,map,folder}=setup();
  map.get('source-private.json').source.excerpt='I wonder whether the oldest death deserves a Steal?';
  assert.equal(context.annalsHistoricOldestContinuationReady_(folder,map.get('source-private.json')),false);
});

test('template and signed-release gates cannot be bypassed by the owner continuation',()=>{
  const {context,map}=setup();
  context.annalsStagedRulesReady_=()=>false;
  assert.throws(()=>context.annalsContinueHistoricOldestRule('owner-only-fictitious-nonce',id),/qualification required/);
  assert.equal(map.has('col-oldest-continuation-private.json'),false);
  context.annalsStagedRulesReady_=()=>true;
  context.annalsProps_=()=>({getProperty:()=>null});
  assert.throws(()=>context.annalsContinueHistoricOldestRule('owner-only-fictitious-nonce',id),/qualification required/);
  assert.equal(map.has('col-rule-request-private.json'),false);
});

test('private desk preserves v30 quarantine-safe signing verifier and offers the one-shot rule continuation',()=>{
  assert.match(prod,/signedRotationEvidenceAvailable: !!\(originalApproval/);
  assert.match(prod,/historicOldestContinuationReady:/);
  assert.match(ui,/id="continueHistoricOldestRule"/);
  assert.match(ui,/annalsContinueHistoricOldestRule/);
  assert.match(ui,/el\('checkSigningRotation'\)\.disabled=!current\.signedRotationEvidenceAvailable/);
  assert.match(ui,/el\('continueHistoricOldestRule'\)\.disabled=!current\.historicOldestContinuationReady/);
});
