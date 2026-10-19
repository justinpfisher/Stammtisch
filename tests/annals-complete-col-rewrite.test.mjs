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
  // Interpretation is editorially autonomous, but still source grounded.
  assert.match(request.instructions,/select and explain the most defensible/i);
  assert.match(request.instructions,/no further vote or approval/i);
  assert.match(request.instructions,/mock-institutional style/i);
  assert.match(request.instructions,/label ceremonial asides and examples non-operative/i);
  assert.match(request.instructions,/never invent an exact date/i);
  assert.match(request.instructions,/EXACT CONTIGUOUS VERBATIM SUBSTRING/i);
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

test('full rewritten rule documents remain source-bound engineering work after unmapped AI output',()=>{
  const Rules=require('../scripts/annals/RulesCore.js');
  const member={
    senderAuthenticated:true,member:'jerome',freshOperativeWindow:true,replayed:false,truncated:false,
    receivedAt:'2026-10-18T17:00:00Z',
    text:'Celebration of Life Pool rules\nHere are the complete updated rules.\n\nCELEBRATION OF LIFE POOL\n\nPOINTS\nA fictional new formula.\n\nDIAMONDS\nA fictional new benefit.\n\nWINNING\nA fictional revised period.'
  };
  const baseline={id:'col-fictional-base',digest:'f'.repeat(64)};
  const outline=Rules.fullRewriteOutline(member,baseline,'col-'+'a'.repeat(24));
  assert.equal(outline.state,'awaiting_implementation');
  assert.equal(outline.meaningVerified,false);
  assert.equal(outline.published,false);
  assert.equal(outline.providerCalled,false);
  assert.deepEqual(outline.sections.map(v=>v.heading),['CELEBRATION OF LIFE POOL','POINTS','DIAMONDS','WINNING']);
  assert.equal(JSON.stringify(outline).includes('A fictional new formula'),false);
  assert.throws(()=>Rules.fullRewriteOutline({...member,senderAuthenticated:false},baseline,'col-'+'a'.repeat(24)),/authenticated/i);
  assert.throws(()=>Rules.fullRewriteOutline({...member,text:'This is a quoted reference document.\n'+member.text.replace('Here are the complete updated rules.','For reference only.')},baseline,'col-'+'a'.repeat(24)),/intent/i);
});
test('exact source mapping permits CRLF versus LF but never accepts paraphrases',()=>{
  const Rules=require('../scripts/annals/RulesCore.js');
  const base={id:'col-fictional-base',digest:'f'.repeat(64),provisions:{
    POINTS:'## POINTS\n\nAn original fictional clause.'
  }};
  const source={senderAuthenticated:true,member:'marc',freshOperativeWindow:true,replayed:false,truncated:false,
    receivedAt:'2026-10-18T17:00:00Z',text:'Please revise this rule.\r\n## POINTS\r\nA fictional new clause.'};
  const assessment={intent:'operative',requestExcerpt:'Please revise this rule.\n## POINTS',
    changes:[{provision:'POINTS',before:base.provisions.POINTS,
      after:'## POINTS\n\nA fictional new clause.',sourceExcerpt:'## POINTS\nA fictional new clause.'}],
    explanation:'A fictional forward-only change.',clarification:'',effectiveAt:'',correctionOf:'',
    retrospective:{requested:false,period:'',results:'',clubAgreementExcerpt:''}};
  assert.equal(Rules.intake(source,assessment,base,'col-'+'a'.repeat(24)).state,'awaiting_implementation');
  assert.throws(()=>Rules.intake(source,{...assessment,requestExcerpt:'Invented summary of the source'},base,'col-'+'a'.repeat(24)),/match original source/i);
  assert.throws(()=>Rules.intake(source,{...assessment,changes:[{...assessment.changes[0],sourceExcerpt:'Invented source quote'}]},base,'col-'+'a'.repeat(24)),/Exact source/i);
});
