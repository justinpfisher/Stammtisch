/* Offline Apps Script load-order fixtures. No services, credentials or I/O. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const names=['PilotCore.js','ProductionCore.js','AutoCore.js','MediaCore.js','MediaPolicy.js','Production.gs','HistoryCore.js','GovernanceCore.js','HistoryProduction.gs','PublicDisplay.js','PhotoContracts.js','PhotoProduction.gs','PhotoQualification.gs','RulesCore.js','RulesProduction.gs','JpegCodec.js','PhotoDerivative.js'];
const source=name=>readFileSync(new URL('../scripts/annals/'+name,import.meta.url),'utf8');
const historySource={senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,source:{subject:'A ledger recollection',excerpt:'The blank ledger appeared in 2021.',receivedAt:'2026-10-15T12:00:00Z'}};
const claim={id:'a'.repeat(64),sourceId:'b'.repeat(64),field:'excerpt',statement:historySource.source.excerpt,factKey:'ledger-arrival',chapter:'origins',period:'2021',status:'recollection',uncertainty:'',evidenceNote:'Offline fixture source inspection.',order:100};
const imageSource={senderAuthenticated:true,autoConsentAtReceipt:true,imageConsentAtReceipt:true,source:{subject:'A blank glass',excerpt:'',receivedAt:'2026-10-15T12:00:00Z'}};
const imageCandidate={category:'cocktail',riskFlags:[],imageSafety:{kind:'drink_or_object',safeToPublish:true}};
const photo={sha256:'a'.repeat(64),size:10};
function load(order){const c=vm.createContext({});for(const name of order)vm.runInContext(source(name),c,{filename:name});return c;}
test('complete private production modules initialise and resolve policy in any cyclic or reverse file order',()=>{
  for(const order of [names,[...names].reverse(),...names.map((_,i)=>names.slice(i).concat(names.slice(0,i)))]){
    const c=load(order),grounded=c.AnnalsHistory.claim(historySource,claim);
    assert.equal(grounded.statement,claim.statement);
    const media=c.AnnalsMediaPolicy.enrich(imageSource,imageCandidate,'c'.repeat(64),{eligible:false,reason:'recipe_measure_or_step_uncertain'},photo);
    assert.equal(media.eligible,true);assert.equal(media.entry.title,'A blank glass');
    assert.equal(typeof c.annalsProductionPreflight,'function');
  }
});
test('missing editorial module holds dependent operations without crashing script initialisation',()=>{
  const c=load(['HistoryCore.js','MediaPolicy.js']);
  assert.throws(()=>c.AnnalsHistory.claim(historySource,claim),/Editorial policy unavailable/);
  assert.throws(()=>c.AnnalsMediaPolicy.enrich(imageSource,imageCandidate,'c'.repeat(64),{eligible:false,reason:'recipe_measure_or_step_uncertain'},photo),/Editorial policy unavailable/);
});

