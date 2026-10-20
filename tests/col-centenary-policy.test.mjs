import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import Rules from '../scripts/annals/RulesCore.js';
import {verifiedAwardPolicy} from '../col-award-policy.mjs';
import {EMPTY_STATE,MODES,snapshotHashes,stageCandidate,validateCandidate} from '../scripts/annals/RulesStaged.mjs';
import {COL_RULE_PUBLIC_FILES} from '../scripts/annals/observe-hosted-col.mjs';
import {canonical,digest} from '../scripts/annals/RulesPublisher.mjs';

const now=Date.parse('2026-11-01T12:00:00Z');
const operative=JSON.parse(readFileSync(new URL('../data/col-rules-versions.json',import.meta.url),'utf8'));
const base=Rules.select(operative.versions,'2026-10-20T12:00:00Z');

function witnessed(overrides={}) {
  const changes=Rules.age100RetirementChanges(base);
  const provisions={...base.provisions};
  changes.forEach(change=>{provisions[change.provision]=change.after;});
  return {candidateDigest:'a'.repeat(64),version:{id:'col-test-centenary',protocol:3,verified:true,
    effectiveAt:'2026-10-20T12:00:00Z',digest:'b'.repeat(64),parameters:base.parameters,
    januaryGap:base.januaryGap,provisions,...overrides}};
}

test('age-100 retirement remains dormant until an independently witnessed v3 version is effective',()=>{
  assert.equal(verifiedAwardPolicy(null,now).age100PrivilegeEndsAt,null);
  assert.equal(verifiedAwardPolicy({version:witnessed().version},now).age100PrivilegeEndsAt,null);
  assert.equal(verifiedAwardPolicy(witnessed({verified:false}),now).age100PrivilegeEndsAt,null);
  assert.equal(verifiedAwardPolicy(witnessed({effectiveAt:'2026-12-01T12:00:00Z'}),now).age100PrivilegeEndsAt,null);
  assert.equal(verifiedAwardPolicy(witnessed(),now).age100PrivilegeEndsAt,'2026-10-20T12:00:00Z');
});

test('non-operative Matters are retained and unsupported or incomplete versions cannot activate retirement',()=>{
  const unsupported=witnessed();
  unsupported.version.provisions['DRAFTING']=base.provisions.DRAFTING;
  assert.equal(verifiedAwardPolicy(unsupported,now).age100PrivilegeEndsAt,null);
  const incomplete=witnessed();
  delete incomplete.version.januaryGap;
  assert.equal(verifiedAwardPolicy(incomplete,now).age100PrivilegeEndsAt,null);
});

test('complete replacement produces only the bounded seven-provision non-operative candidate',()=>{
  const files=Object.fromEntries(COL_RULE_PUBLIC_FILES.map(path=>[path,readFileSync(new URL('../'+path,import.meta.url),'utf8')]));
  const baseFiles=JSON.parse(files['data/col-rules-versions.json']);
  const activeBase=Rules.select(baseFiles.versions,'2026-10-20T12:00:00Z');
  const receivedAt='2026-10-20T12:00:00.000Z';
  const text=['Here are the complete updated rules for our Celebration of Life Pool.','CELEBRATION OF LIFE POOL',
    'POINTS','If your celebrity dies at 100, you win 10 points.','BLUE DIAMOND','When your Blue Diamond dies, you win a Steal.',
    'BROWN DIAMOND','When your Brown Diamond dies, you win a Protection.','PRIZE','Renewal Stammtisch',
    'BIRTHDAY BUFFET','Birthday Buffet is based on when the death is reported in our group chat',
    'DRAFTING','Every player can draft five or more celebrities each year.',
    'DRAFT - ORDER OF BUSINESS','Protections cannot be transferred or cancelled.','Coronation of Diamonds is the final stage.'].join('\n');
  const source={senderAuthenticated:true,member:'jerome',freshOperativeWindow:true,replayed:false,truncated:false,text,receivedAt};
  const revision=Rules.age100Retirement(source,activeBase,'col-test-centenary');
  const key='fictional-centenary-test-signing-key-00000001',commit='c'.repeat(40),behavior='d'.repeat(64);
  const clean=Rules.publicRecord(revision);clean.baseDigest=revision.baseDigest;
  const content={revision:clean,qualification:Rules.AGE100_RETIREMENT_QUALIFICATION,
    baseFiles:snapshotHashes(files),implementationCommit:commit,behaviorDigest:behavior,source:null};
  const approval={mode:MODES.stage,baseStateDigest:digest(EMPTY_STATE),issuedAt:receivedAt};
  const signature=createHmac('sha256',key).update(JSON.stringify(canonical({content,approval}))).digest('hex');
  const sourceWitness={sourceDigest:'e'.repeat(64),observedAt:receivedAt,repoCommit:commit,workflowRun:'123456'};
  const staged=stageCandidate({state:EMPTY_STATE,files,envelope:{content,approval:{...approval,signature}},secret:key,
    enabled:true,now:new Date(receivedAt),implementationCommit:commit,behaviorDigest:behavior,sourceWitness});
  validateCandidate(staged.candidate,staged.candidateDigest);
  assert.equal(staged.candidate.kind,'non-operative-col-candidate');
  const candidateVersion=JSON.parse(staged.candidate.files['data/col-rules-versions.json']).versions.at(-1);
  assert.equal(candidateVersion.verified,false);
  assert.equal(candidateVersion.effectiveAt,null);
  assert.deepEqual(candidateVersion.parameters,activeBase.parameters);
  assert.equal(candidateVersion.januaryGap,activeBase.januaryGap);
  assert.equal(staged.candidate.files['data/col-rules-register.json'].includes('Here are the complete updated rules'),false);
});
