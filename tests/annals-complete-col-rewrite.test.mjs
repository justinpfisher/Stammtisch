/* Offline and fictional full-document CoL intake coverage. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Pilot=require('../scripts/annals/PilotCore.js');
const rulesSource=readFileSync(new URL('../scripts/annals/RulesProduction.gs',import.meta.url),'utf8');
const original={sourceId:'a'.repeat(64),from:'fictional.member@example.test',
  subject:'Celebration of Life Pool rules',receivedAt:'2026-10-18T17:00:00Z',
  attachments:[]};
const section='## POINTS\n\nA fictional rule describes a game point.\n';
const longDocument=('RULES\n'+section.repeat(420)).slice(0,28000);
test('complete rules source larger than ordinary Annals excerpt remains intact and private',()=>{
  const full=Pilot.privateProposal({...original,body:longDocument});
  assert.equal(full.source.excerpt,longDocument);
  assert.equal(full.source.sourceTruncated,false);
  assert.equal(full.requiresClarification,false);
  assert.ok(longDocument.length>Pilot.MAX_SOURCE_CHARS);
  assert.ok(full.source.excerpt.length<=Pilot.MAX_RULE_BODY_CHARS);
});
test('large ordinary submissions retain the established smaller text window',()=>{
  const ordinary=Pilot.privateProposal({...original,subject:'A fictional cocktail',body:longDocument});
  assert.equal(ordinary.source.sourceTruncated,true);
  assert.equal(ordinary.source.excerpt.length,Pilot.MAX_BODY_CHARS);
});
test('oversize rules sources remain explicitly held rather than silently clipped and adopted',()=>{
  const full=Pilot.privateProposal({...original,body:'R'.repeat(Pilot.MAX_RULE_BODY_CHARS+1)});
  assert.equal(full.source.sourceTruncated,true);
  assert.equal(full.requiresClarification,true);
  assert.equal(full.source.excerpt.length,Pilot.MAX_RULE_BODY_CHARS);
});
test('large complete rules email and complete baseline fit the one-shot bounded interpretation request',()=>{
  const ctx=vm.createContext({
    AnnalsProduction:{MODEL:'fictional-test-model'},
    annalsAiSourceText_:s=>'EMAIL SUBJECT:\n'+s.source.subject+'\nEMAIL BODY:\n'+s.source.excerpt
  });
  vm.runInContext(rulesSource,ctx);
  const source=Pilot.privateProposal({...original,body:longDocument});
  const request=ctx.annalsRuleRequest_(source,{provisions:{POINTS:section.repeat(60)}});
  assert.ok(request.input[0].content[0].text.length>12000);
  assert.ok(request.input[0].content[0].text.length<=54000);
  assert.equal(request.max_output_tokens,8000);
  assert.equal(request.store,false);
  assert.equal(request.tools,undefined);
  assert.equal(request.text.format.strict,true);
});
test('very large source-plus-baseline stays held before any provider reservation',()=>{
  const ctx=vm.createContext({
    AnnalsProduction:{MODEL:'fictional-test-model'},
    annalsAiSourceText_:s=>s.source.subject+'\n'+s.source.excerpt
  });
  vm.runInContext(rulesSource,ctx);
  const source=Pilot.privateProposal({...original,body:longDocument});
  assert.throws(()=>ctx.annalsRuleRequest_(source,{provisions:{POINTS:section.repeat(900)}}),/bound/i);
});
