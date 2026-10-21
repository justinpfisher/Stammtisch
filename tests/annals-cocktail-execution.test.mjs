/* CLI-level safeguards. No live provider calls or protected credentials. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readdir,rm,readFile} from 'node:fs/promises';
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
    ['--entry',entry,'--budget-ledger','owner-private-ledger.json'],
    ['--entry',entry,'--execute']
  ]){
    const run=cli(args);
    assert.notEqual(run.status,0);
    assert.doesNotMatch(run.stderr,/private.*(image|key|credential)|OPENAI_API_KEY/i);
  }
});

test('every successful paid edit is retained owner-privately before another paid visual review',async()=>{
  const source=await readFile(script,'utf8');
  const edit=source.indexOf('const edited=await requestSunburstEdit(');
  const saved=source.indexOf("'"+'-generated-private.jpg'+"'");
  const meta=source.indexOf("'"+'-generation-private.json'+"'");
  const review=source.indexOf('const judgement=await assessSunburstEdit(');
  assert.ok(edit>0&&saved>edit&&meta>saved&&review>meta);
  assert.match(source,/generated-private\.jpg'[\s\S]*flag:'wx',mode:0o600/);
  assert.match(source,/publicRelease:false,visualQualified:false/);
  assert.match(source,/reserved-no-retry/);
});

test('one-shot CLI consumes the owner-issued ledger without a second reservation writer',async()=>{
  const source=await readFile(script,'utf8');
  assert.match(source,/verifyIssuedCocktailBudget\s*\(/);
  assert.match(source,/privateFile\(options\['budget-ledger'\]\)/);
  assert.doesNotMatch(source,/reserveCocktailBudget\s*\(/);
  assert.match(source,/Conflicting local image spending ledger/);
  assert.match(source,/Previously attempted editorial source/);
  assert.match(source,/cocktail-'\+subject\.sourceSha256\+'-attempt-private\.json'/);
  assert.match(source,/writeFile\(marker,[\s\S]*flag:'wx',mode:0o600/);
});
test('reference signature binds the exact original approved private bytes',async()=>{
  const source=await readFile(script,'utf8');
  assert.match(source,/referenceSha256:referenceBytes\?sourceDigest\(referenceBytes\):''/);
  assert.doesNotMatch(source,/referenceSha256:referenceBytes\?sourceDigest\(stripJpegMetadata/);
  // This does not relax actual JPEG decoding before a billable request.
  assert.match(source,/makeSunburstEditRequest\(\{subject,referenceBytes\}\)/);
});
test('a costly generated image does not automatically trigger a second billed assessment',async()=>{
  const source=await readFile(script,'utf8');
  const edit=source.indexOf('const edited=await requestSunburstEdit(');
  const hold=source.indexOf('enforceTotalSpend({editCents:generationCents,reviewCents:50})');
  const review=source.indexOf('const judgement=await assessSunburstEdit(');
  assert.ok(edit>=0&&hold>edit&&review>hold);
});
