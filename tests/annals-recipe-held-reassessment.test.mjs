/* Fictional, local-only verification of one-shot recipe recovery guards. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../scripts/annals/Production.gs',import.meta.url),'utf8');
const id='e'.repeat(64),sender='invented.member@example.test';
function fixture({eligible=true,consent=true,dispatch=false}={}){
  const source={sourceId:id,senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,
    source:{sender,subject:'Fictional Spice Glass',excerpt:'1 oz invented liquid. Stir.',
      receivedAt:'2026-10-18T17:00:00Z',sourceTruncated:false,subjectTruncated:false,excerptTruncated:false}};
  const records=new Map([
    ['source-private.json',source],
    ['draft-private.json',{category:'cocktail',recipe:{drinkIngredients:['1 oz invented liquid'],syrupIngredients:[],steps:['Stir.']}}],
    ['auto-decision-private.json',{state:'held',reason:'recipe_measure_or_step_uncertain'}],
    ['ai-attempt-private.json',{state:'attempt_reserved',model:'fictional'}]
  ]);
  if(dispatch)records.set('publication-dispatch-private.json',{state:'accepted'});
  const calls=[],overrides={
    annalsUiCall_:(_nonce,fn)=>fn(),annalsLocked_:fn=>fn(),annalsOwner_:()=>sender,
    annalsProps_:()=>({getProperty:k=>({ANNALS_ALLOWED_SENDERS:sender,ANNALS_ACTIVATED_AT:'2026-10-01T00:00:00Z'}[k]||'')}),
    annalsFolder_:()=>({}),
    annalsRead_:(_folder,name)=>records.get(name)||null,
    annalsFile_:(_folder,name)=>records.has(name)?{setContent:s=>records.set(name,JSON.parse(s))}:null,
    annalsWriteOnce_:(_folder,name,value)=>{if(records.has(name))throw Error('Immutable evidence overwritten');records.set(name,value);},
    annalsHash_:()=> 'f'.repeat(64),AnnalsProduction:{serial:JSON.stringify},
    AnnalsPilot:{allowedSenders:s=>s.split(',')},AnnalsAuto:{propose:()=>({eligible})},
    annalsConsentActive_:()=>consent,annalsStandingPublicationActive_:()=>consent,
    annalsAutoPublishCandidate_:(item,heldRecovery)=>{
      calls.push({item,heldRecovery});
      records.set('auto-reassessment-private.json',{state:'held',reason:'fictional_dispatch_unavailable'});
      return false;
    }
  };
  const ctx=vm.createContext({});
  vm.runInContext(script,ctx);
  Object.assign(ctx,overrides);
  return {ctx,records,calls};
}
test('one-time recipe exception preserves original decision, does not call AI and forbids replay',()=>{
  const f=fixture();
  const result=f.ctx.annalsReassessHeldRecipe('fictional-session',id,true);
  assert.equal(result.aiCall,false);
  assert.equal(result.dispatchAccepted,false);
  assert.equal(result.status,'fictional_dispatch_unavailable');
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].heldRecovery,true);
  assert.equal(f.records.get('reassessment-attempt-private.json').aiCall,false);
  assert.equal(f.records.get('reassessment-attempt-private.json').dispatchWasAbsent,true);
  assert.deepEqual(f.records.get('auto-decision-private.json'),{state:'held',reason:'recipe_measure_or_step_uncertain'});
  assert.deepEqual(f.records.get('ai-attempt-private.json'),{state:'attempt_reserved',model:'fictional'});
  assert.throws(()=>f.ctx.annalsReassessHeldRecipe('fictional-session',id,true),/not eligible/);
  assert.equal(f.calls.length,1);
});
test('recipe reassessment holds for missing confirmation, revoked consent, ungrouded draft and prior dispatch',()=>{
  for(const opts of [{consent:false},{eligible:false},{dispatch:true}]){
    const f=fixture(opts);
    assert.throws(()=>f.ctx.annalsReassessHeldRecipe('fictional-session',id,true),/not eligible/);
    assert.equal(f.calls.length,0);
    assert.equal(f.records.has('reassessment-attempt-private.json'),false);
  }
  const f=fixture();
  assert.throws(()=>f.ctx.annalsReassessHeldRecipe('fictional-session',id,false),/confirmation required/);
  assert.equal(f.records.has('reassessment-attempt-private.json'),false);
});
