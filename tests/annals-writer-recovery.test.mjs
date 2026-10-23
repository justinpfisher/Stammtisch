import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pushApprovedCommit,canRecover} from '../scripts/annals/push-approved-commit.mjs';
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function fixture(t){
  const dir=mkdtempSync(join(tmpdir(),'stammtisch-writer-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const remote=join(dir,'remote.git'),a=join(dir,'a'),b=join(dir,'b');
  git(dir,'init','--bare','--initial-branch=main',remote);git(dir,'clone',remote,a);
  for(const cwd of [a]){git(cwd,'config','user.name','Fictional Test');git(cwd,'config','user.email','fixture@example.invalid');git(cwd,'config','core.autocrlf','false');}
  mkdirSync(join(a,'data'));writeFileSync(join(a,'annals.html'),'original\n');writeFileSync(join(a,'index.html'),'home\n');
  writeFileSync(join(a,'data','annals-approved.json'),'{}\n');
  git(a,'add','.');git(a,'commit','-m','fixture');git(a,'push','origin','main');git(dir,'clone','-c','core.autocrlf=false',remote,b);
  git(b,'config','user.name','Fictional Test');git(b,'config','user.email','fixture@example.invalid');git(b,'config','core.autocrlf','false');
  writeFileSync(join(a,'annals.html'),'signed-render-fixture\n');git(a,'add','annals.html');git(a,'commit','-m','approved fixture');
  return {dir,remote,a,b};
}
test('unrelated main update recovers original exact publication bytes without a forced push',t=>{
  const {a,b,remote}=fixture(t);writeFileSync(join(b,'index.html'),'concurrent home\n');git(b,'add','.');git(b,'commit','-m','home');git(b,'push','origin','main');
  const r=pushApprovedCommit({cwd:a});assert.equal(r.status,'pushed');assert.equal(r.attempts,2);
  assert.equal(git(remote,'show','main:annals.html'),'signed-render-fixture');assert.equal(git(remote,'show','main:index.html'),'concurrent home');
});
test('archive race holds, preserving remote state and original signed local commit',t=>{
  const {a,b,remote}=fixture(t),head=git(a,'rev-parse','HEAD');writeFileSync(join(b,'data','annals-approved.json'),'changed\n');git(b,'add','.');git(b,'commit','-m','another entry');git(b,'push','origin','main');
  assert.throws(()=>pushApprovedCommit({cwd:a}),/exact-source/);assert.equal(git(a,'rev-parse','HEAD'),head);assert.equal(git(remote,'show','main:annals.html'),'original');
});
test('unknown push response checks actual remote receipt and never republishes',t=>{
  const {a,remote}=fixture(t);let pushes=0;
  const r=pushApprovedCommit({cwd:a,gitImpl:(...args)=>{const out=git(a,...args);if(args[0]==='push'){pushes++;throw Error('lost response');}return out;}});
  assert.equal(r.status,'already-received');assert.equal(pushes,1);assert.equal(git(remote,'rev-list','--count','main'),'2');
});
test('changed signature/source dependencies, workflows and unknown paths cannot recover',()=>{
  for(const p of ['scripts/annals/ApprovedRenderer.mjs','AGENTS.md','docs/annals-publication-guidelines.md','data/club-history.json','data/annals-approved.json','.github/workflows/annals-publish.yml','assets/annals/source.jpg'])assert.equal(canRecover(['annals.html'],[p]),false);
  assert.equal(canRecover(['scripts/arbitrary.mjs'],['index.html']),false);
  assert.equal(canRecover(['annals.html'],[]),false);
});
