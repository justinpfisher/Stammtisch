/* CLI-level safeguards. No live provider calls or protected credentials. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const script=path.join(root,'scripts/annals/prepare-cocktail-editorial.mjs');
const entry='annal-96b5ae266a36793c6a203033';
function cli(args,env={}){
  return spawnSync(process.execPath,[script,...args],{
    cwd:root,encoding:'utf8',env:{...process.env,
      ANNALS_EDITORIAL_IMAGE_ENABLED:'false',
      ANNALS_EDITORIAL_IMAGE_API_KEY:'',
      ANNALS_PUBLISH_SIGNING_KEY:'',...env},
    timeout:15000});
}
test('default CLI verifies only the exact original source, never a paid provider request',()=>{
  const run=cli(['--entry',entry]);
  assert.equal(run.status,0,run.stderr);
  assert.deepEqual(JSON.parse(run.stdout),{
    state:'preflight-source-digest-only',
    sourceSha256:'ee47c45a0d84121fdd761df6fb9f08e04b276a3504ab5922dd040101b2ac8b44',
    publisherVerified:false,providerCalled:false,generationEnabled:false});
});
test('even --execute cannot call a paid provider without separate activation and private authority',async()=>{
  const out=await mkdtemp(path.join(tmpdir(),'stammtisch-editorial-test-'));
  try{
    const run=cli(['--entry',entry,'--execute','--private-output',out],{
      ANNALS_EDITORIAL_IMAGE_ENABLED:'false',
      ANNALS_EDITORIAL_IMAGE_API_KEY:'deliberate-fake-fixture-key'});
    assert.notEqual(run.status,0);
    assert.equal(await readdir(out).then(x=>x.length),0);
    assert.doesNotMatch(run.stderr,/deliberate-fake|Bearer |public title|private source/i);
  }finally{await rm(out,{recursive:true,force:true})}
});
test('no caller-selected source URL or environment key is supported by the CLI',()=>{
  for(const args of [
    ['--entry',entry,'--source','http://malicious.example/image.jpg'],
    ['--entry',entry,'--permit','secret.json'],
    ['--entry',entry,'--execute']
  ]){
    const run=cli(args);
    assert.notEqual(run.status,0);
    assert.doesNotMatch(run.stderr,/private.*(image|key|credential)|OPENAI_API_KEY/i);
  }
});
