/* Fictional, offline intake coverage. Never accesses live email, Drive or AI. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const production = readFileSync(new URL('../scripts/annals/Production.gs', import.meta.url), 'utf8');
const rules = readFileSync(new URL('../scripts/annals/RulesProduction.gs', import.meta.url), 'utf8');
const message = id => ({ getId: () => id });
const thread = (id, ids) => ({
  getId: () => id, getMessages: () => ids.map(message)
});

function intakeFixture(threads, offset = 0) {
  const props = {
    ANNALS_OWNER_EMAIL: 'owner@example.test',
    ANNALS_PRODUCTION_INTAKE_ENABLED: 'true',
    ANNALS_AI_ENABLED: 'true',
    ANNALS_OPENAI_API_KEY: 'FICTIONAL',
    ANNALS_BUDGET_LEDGER: '{"schemaVersion":1,"month":"2026-10","reservedCents":0}',
    ANNALS_GITHUB_TOKEN: 'FICTIONAL',
    ANNALS_PUBLISH_SIGNING_KEY: 's'.repeat(40),
    ANNALS_GITHUB_REPOSITORY: 'justinpfisher/Stammtisch',
    ANNALS_REVIEW_URL: 'https://example.test/private',
    ANNALS_ACTIVATED_AT: '2026-10-01T00:00:00Z',
    ANNALS_ALLOWED_SENDERS: 'fictional@example.test,member@example.test,member2@example.test,member3@example.test,member4@example.test,member5@example.test',
    ANNALS_INBOX_CURSOR: JSON.stringify({offset, message: 0, threadId: null})
  };
  const seen = new Set(), calls = [];
  const ctx = vm.createContext({
    console: { log: () => {} },
    AnnalsPilot: { allowedSenders: value => value.split(',').filter(Boolean) },
    Session: { getEffectiveUser: () => ({getEmail: () => props.ANNALS_OWNER_EMAIL}) },
    GmailApp: {
      getInboxThreads(start, count) { return threads.slice(start, start + count); },
      getThreadById(id) { return threads.find(t => t.getId() === id) || null; }
    }
  });
  // Test-only error transparency: the deployed handler conceals private faults.
  // These fixtures contain no real member data or credentials.
  const inspected = production.replace("  } catch (e) { throw new Error('Private intake stopped; review account configuration privately'); }",
    '  } catch (e) { throw e; }');
  assert.notEqual(inspected, production);
  vm.runInContext(inspected, ctx);
  Object.assign(ctx, {
    annalsProps_: () => ({
      getProperty: k => props[k] ?? null,
      setProperty: (k,v) => { props[k] = v; },
      deleteProperty: k => { delete props[k]; }
    }),
    annalsLocked_: fn => fn(),
    annalsRoot_: () => ({}),
    annalsStageProduction_: m => {
      const id = m.getId();
      calls.push(id);
      if (seen.has(id)) return 'duplicates';
      seen.add(id);
      return 'staged';
    },
    annalsResumeConsentedDrafts_: () => 0,
    annalsVerifyAutomaticPublications_: () => 0
  });
  return { ctx, props, calls, threads, seen };
}

test('new inbox arrivals are scanned in the next cycle without resetting the older-thread cursor', () => {
  const threads = Array.from({length: 9}, (_,i) => thread('t' + i, ['msg-' + i]));
  const f = intakeFixture(threads, 7);
  const summary = JSON.parse(JSON.stringify(f.ctx.runAnnalsProductionIntake()));
  assert.equal(summary.enabled, true);
  assert.equal(summary.staged, 4);
  assert.deepEqual(f.calls, ['msg-0', 'msg-1', 'msg-2', 'msg-7']);
  assert.equal(JSON.parse(f.props.ANNALS_INBOX_CURSOR).offset, 8);
  f.threads.unshift(thread('new-message', ['just-arrived']));
  const later = JSON.parse(JSON.stringify(f.ctx.runAnnalsProductionIntake()));
  assert.equal(later.staged, 1);
  assert.ok(f.calls.includes('just-arrived'));
  assert.equal(JSON.parse(f.props.ANNALS_INBOX_CURSOR).offset, 9);
});

test('overlapping newest and round-robin windows process a message only once per run', () => {
  const f = intakeFixture([thread('conversation',
    ['old-0','old-1','old-2','new-3','new-4']),thread('next', ['other'])]);
  const summary = JSON.parse(JSON.stringify(f.ctx.runAnnalsProductionIntake()));
  assert.equal(summary.staged, 6);
  assert.equal(f.calls.length, 6);
  assert.equal(new Set(f.calls).size, 6);
  assert.ok(f.calls.indexOf('new-4') < f.calls.indexOf('old-0'));
});

test('newest-window processing remains bounded even for long conversations', () => {
  const f = intakeFixture([
    thread('long', Array.from({length: 40},(_,i)=>'long-' + i)),
    thread('second',['other']),
    thread('third',['third']),
    thread('fourth',['old'])
  ],3);
  const summary = JSON.parse(JSON.stringify(f.ctx.runAnnalsProductionIntake()));
  assert.equal(summary.staged, 6); // 3 from newest, 1 + 1, plus historical cursor
  assert.ok(f.calls.includes('long-39'));
  assert.ok(!f.calls.includes('long-0'));
  assert.equal(f.calls.length,6);
});

test('clipped authenticated CoL rules are held with one private member and owner notice, no AI call', () => {
  const ctx = vm.createContext({});
  vm.runInContext(rules,ctx);
  const notices = [], source = {senderAuthenticated:true,rulesAuthorityVersion:2,
    source:{sender:'fictional@example.test',subject:'CoL rules',excerpt:'fictional',
      sourceTruncated:true,subjectTruncated:false,excerptTruncated:false}};
  Object.assign(ctx,{
    annalsProps_:()=>({getProperty:k=>k==='ANNALS_OWNER_EMAIL'?'owner@example.test':'https://example.test/private'}),
    annalsFolder_:()=>({}),annalsRead_:(_,n)=>n==='source-private.json'?source:null,
    annalsRuleNotice_:(_,to,kind,body)=>{notices.push({to,kind,body});return true;},
    annalsRulesReady_:()=>assert.fail('Truncated source reached the rule release gate'),
    UrlFetchApp:{fetch:()=>assert.fail('Truncated source reached provider or GitHub')}
  });
  assert.equal(ctx.annalsProcessRuleRequest_('a'.repeat(64)),false);
  assert.equal(notices.length,2);
  assert.deepEqual(notices.map(n=>n.kind),['full-source-held','full-source-owner']);
  assert.ok(notices.every(n=>!n.body.includes('fictional@example.test')));
});

test('oversize combined interpretation request is visible but never charged or published', () => {
  const ctx = vm.createContext({});
  vm.runInContext(rules,ctx);
  const notices=[],source={senderAuthenticated:true,rulesAuthorityVersion:2,
    rulesActivationEligible:true,aiConsentActive:true,source:{sender:'fictional@example.test',
      subject:'CoL rules',excerpt:'invented '.repeat(1100),
      receivedAt:'2026-10-18T17:00:00Z',
      sourceTruncated:false,subjectTruncated:false,excerptTruncated:false}};
  const base={provisions:{POINTS:'p'.repeat(6000)}};
  const props={
    ANNALS_RULES_ACCEPT_FROM:'2026-10-15T00:00:00Z',
    ANNALS_AI_ENABLED:'true',
    ANNALS_OWNER_EMAIL:'owner@example.test',
    ANNALS_REVIEW_URL:'https://example.test/private',
    ANNALS_BUDGET_LEDGER:'{"reservedCents":0}'
  };
  Object.assign(ctx,{
    annalsProps_:()=>({getProperty:k=>props[k]??null,setProperty:()=>assert.fail('Billed AI')}),
    annalsFolder_:()=>({}),annalsRoot_:()=>({}),
    annalsRead_:(_,n)=>n==='source-private.json'?source:null,
    annalsRulesReady_:()=>true,annalsConsentActive_:()=>true,
    annalsStandingPublicationActive_:()=>true,annalsPublisherDispatchReady_:()=>true,
    annalsFile_:()=>null,annalsStagedRulesReady_:()=>false,
    annalsAiSourceText_:s=>s.source.subject+'\n'+s.source.excerpt,
    AnnalsRules:{select:()=>base},
    UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({versions:[base]})})},
    annalsRuleNotice_:(_,to,kind,body)=>{notices.push({to,kind,body});return true;}
  });
  assert.equal(ctx.annalsProcessRuleRequest_('b'.repeat(64)),false);
  assert.equal(notices.some(n=>n.kind==='input-bound-held'),true);
  assert.equal(notices.some(n=>n.kind==='input-bound-owner'),true);
});


test('fresh authenticated CoL mail is interpreted on the same scheduled intake without repeated AI',()=>{
  const f=intakeFixture([thread('new',['rule-message']),thread('older',['old-message'])]);
  const reviews=[],alreadyProcessed=new Set();
  f.ctx.annalsStageProduction_=m=>{
    if(alreadyProcessed.has(m.getId()))return 'duplicates';
    alreadyProcessed.add(m.getId());return m.getId()==='rule-message'?'held':'staged';
  };
  f.ctx.annalsHash_=id=>'hash-'+id;
  f.ctx.annalsFolder_=id=>({id});
  f.ctx.annalsRead_=(folder,name)=>name==='source-private.json'&&folder.id==='hash-rule-message'?
    {senderAuthenticated:true,protectiveRoute:'col_proposal'}:null;
  f.ctx.annalsProcessRuleRequest_=id=>{reviews.push(id);return true;};
  const first=JSON.parse(JSON.stringify(f.ctx.runAnnalsProductionIntake()));
  assert.equal(first.held,1);
  assert.deepEqual(reviews,['hash-rule-message']);
  f.ctx.runAnnalsProductionIntake();
  assert.deepEqual(reviews,['hash-rule-message'],'no duplicate interpretation on another cycle');
});
test('unauthenticated CoL-looking mail is never fast-tracked into amendment processing',()=>{
  const f=intakeFixture([thread('new',['unverified-rule'])]);
  const reviews=[];
  f.ctx.annalsStageProduction_=()=> 'held';
  f.ctx.annalsHash_=_=>'hash-unverified';
  f.ctx.annalsFolder_=id=>({id});
  f.ctx.annalsRead_=()=>({senderAuthenticated:false,protectiveRoute:'col_proposal'});
  f.ctx.annalsProcessRuleRequest_=id=>reviews.push(id);
  f.ctx.runAnnalsProductionIntake();
  assert.deepEqual(reviews,[]);
});


test('one malformed message cannot prevent other member messages from being staged',()=>{
  const f=intakeFixture([thread('new',['faulty-message']),thread('other',['legitimate-message'])]);
  const recorded=new Map(),sent=[],visited=[];
  f.ctx.annalsStageProduction_=msg=>{
    visited.push(msg.getId());
    if(msg.getId()==='faulty-message')throw Error('fictional raw body must not be logged');
    return 'staged';
  };
  f.ctx.annalsHash_=id=>'hash-'+id;
  f.ctx.annalsFolder_=id=>({id,getUrl:()=> 'https://drive.google.com/drive/folders/fictional'});
  f.ctx.annalsFile_=(folder,name)=>recorded.get(folder.id+'/'+name)||null;
  f.ctx.annalsWriteOnce_=(folder,name,value)=>{
    assert.equal(recorded.has(folder.id+'/'+name),false);
    recorded.set(folder.id+'/'+name,value);
  };
  f.ctx.GmailApp.sendEmail=(...args)=>sent.push(args);
  const first=JSON.parse(JSON.stringify(f.ctx.runAnnalsProductionIntake()));
  assert.equal(first.staged,1);
  assert.equal(first.staging_errors,1);
  assert.deepEqual(visited,['faulty-message','legitimate-message']);
  assert.equal(JSON.parse(f.props.ANNALS_INBOX_CURSOR).offset,1);
  assert.equal(sent.length,1);
  assert.ok(recorded.has('hash-faulty-message/intake-staging-error-private.json'));
  assert.equal(sent[0][0],f.props.ANNALS_OWNER_EMAIL);
  assert.doesNotMatch(JSON.stringify(sent),/fictional raw body must not be logged/);
  f.ctx.runAnnalsProductionIntake();
  assert.equal(sent.length,1,'one-shot exception notice is not resent');
});
test('a stored staging failure holds subsequent attempts before original body or attachments are read',()=>{
  const ctx=vm.createContext({
    AnnalsPilot:{senderAddress:raw=>raw},
    annalsHash_:id=>'hash-'+id,
    annalsFolder_:()=>({}),
    annalsFile_:(_,name)=>name==='intake-staging-error-private.json'?{}:null,
    annalsRead_:()=>assert.fail('Read original was not needed'),
    annalsAuthentication_:()=>assert.fail('Authentication was not repeated')
  });
  vm.runInContext(production,ctx);
  ctx.annalsHash_=id=>'hash-'+id;
  ctx.annalsFolder_=_=>({});
  ctx.annalsFile_=(_,name)=>name==='intake-staging-error-private.json'?{}:null;
  let bodyReads=0;
  const msg={getFrom:()=> 'member@example.test',getDate:()=>new Date('2026-10-18T17:00:00Z'),
    getSubject:()=> 'Fictional CoL amendment',getId:()=> 'fixture',
    getPlainBody:()=>{bodyReads++;return 'do not read';}};
  assert.equal(ctx.annalsStageProduction_(msg,Date.parse('2026-10-17T00:00:00Z'),['member@example.test']),'held');
  assert.equal(bodyReads,0);
});
test('a complete private source is never overwritten or marked as a failed staging attempt',()=>{
  const f=intakeFixture([thread('new',['existing-source','next'])]),written=[],sent=[];
  f.ctx.annalsHash_=id=>'hash-'+id;
  f.ctx.annalsFolder_=id=>({id});
  f.ctx.annalsFile_=(folder,name)=>folder.id==='hash-existing-source'&&name==='source-private.json'?{}:null;
  f.ctx.annalsWriteOnce_=(folder,name)=>written.push({id:folder.id,name});
  f.ctx.GmailApp.sendEmail=(...args)=>sent.push(args);
  f.ctx.annalsStageProduction_=m=>m.getId()==='existing-source'?
    (()=>{throw Error('fictional post-capture error');})():'staged';
  const result=JSON.parse(JSON.stringify(f.ctx.runAnnalsProductionIntake()));
  assert.equal(result.staged,1);
  assert.equal(result.staging_errors,1);
  assert.deepEqual(written,[]);
  assert.equal(sent.length,0);
});
test('an unreadable message ID is isolated and does not block a subsequent message',()=>{
  const f=intakeFixture([thread('bad', ['bad']),thread('good',['good'])]);
  f.threads[0]={getId:()=> 'bad',getMessages:()=>[{getId(){throw Error('fictional unreadable metadata');}}]};
  const res=JSON.parse(JSON.stringify(f.ctx.runAnnalsProductionIntake()));
  assert.equal(res.staging_errors,2,'the same inaccessible item is observed in both scanner windows');
  assert.equal(res.staged,1);
  assert.deepEqual(f.calls,['good']);
});
