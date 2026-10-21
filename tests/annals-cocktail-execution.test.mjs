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

test('private handoff check is non-spending and refuses absent private authority without writes',async()=>{
 const out=await mkdtemp(path.join(tmpdir(),'stammtisch-handoff-no-spend-'));
 try{
   const run=cli(['--entry',entry,'--check-handoff','--private-output',out],{
     ANNALS_EDITORIAL_IMAGE_ENABLED:'false',
     ANNALS_EDITORIAL_IMAGE_API_KEY:'should-not-use-this-key'
   });
   assert.notEqual(run.status,0);
   assert.equal((await readdir(out)).length,0);
   assert.doesNotMatch(run.stdout+run.stderr,/should-not-use-this-key|Bearer |source email|private token/i);
 }finally{await rm(out,{recursive:true,force:true})}
});
test('check-handoff is exclusively no-spend and cannot be combined with paid mode',()=>{
 for(const args of [
   ['--entry',entry,'--execute','--check-handoff'],
   ['--entry',entry,'--check-handoff','--execute'],
   ['--entry',entry,'--check-handoff','--check-handoff'],
   ['--entry',entry,'--execute','--execute']
 ]){
   const r=cli(args);
   assert.notEqual(r.status,0);
 }
});
test('source receipt and replay checks run before provider activation or private writes',async()=>{
 const source=await readFile(script,'utf8');
 const receipt=source.indexOf('extractUnspentEditorialPermit(JSON.parse(');
 const proof=source.indexOf('const proof=verifyEditorialPermit(');
 const previous=source.indexOf("if(saved?.sourceSha256===subject.sourceSha256)");
 const dry=source.indexOf("if(options.checkHandoff){");
 const paid=source.indexOf("if(process.env.ANNALS_EDITORIAL_IMAGE_ENABLED!=='true'",dry);
 const mark=source.indexOf("await writeFile(marker,JSON.stringify(attempt",dry);
 const edit=source.indexOf("const edited=await requestSunburstEdit(",dry);
 assert.ok(receipt>=0&&receipt<proof&&proof<previous&&previous<dry&&
    dry<paid&&paid<mark&&mark<edit);
 assert.match(source,/state:'private-handoff-verified-offline'/);
 assert.match(source,/providerCalled:false,paidRequestMade:false,markerCreated:false/);
 assert.doesNotMatch(source,/verifyIssuedCocktailBudget\s*\(|enforceTotalSpend\s*\(/);
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

test('one source attempt marker prevents duplicate billing without a private money ledger',async()=>{
  const source=await readFile(script,'utf8');
  assert.doesNotMatch(source,/privateFile\(options\['budget-ledger'\]\)/);
  assert.doesNotMatch(source,/enforceTotalSpend|PHOTO_CENTS|MONTHLY_CENTS/);
  assert.match(source,/Previously attempted editorial source/);
  assert.match(source,/cocktail-'+subject\.sourceSha256+'-attempt-private\.json'/);
  assert.match(source,/writeFile\(marker,[\s\S]*flag:'wx',mode:0o600/);
});
test('reference signature binds the exact original approved private bytes',async()=>{
  const source=await readFile(script,'utf8');
  assert.match(source,/referenceSha256:referenceBytes\?sourceDigest\(referenceBytes\):''/);
  assert.doesNotMatch(source,/referenceSha256:referenceBytes\?sourceDigest\(stripJpegMetadata/);
  // This does not relax actual JPEG decoding before a billable request.
  assert.match(source,/makeSunburstEditRequest\(\{subject,referenceBytes\}\)/);
});
test('provider-enforced monthly cap replaces obsolete per-photo local spending estimates',async()=>{
 const source=await readFile(script,'utf8');
 const edit=source.indexOf('const edited=await requestSunburstEdit(');
 const saved=source.indexOf('-generated-private.jpg',edit);
 const review=source.indexOf('const judgement=await assessSunburstEdit(',edit);
 assert.ok(edit>=0&&saved>edit&&review>saved);
 assert.match(source,/ANNALS_EDITORIAL_PROJECT_HARD_LIMIT_VERIFIED/);
 assert.doesNotMatch(source,/imageSpendCents|reviewSpendCents|enforceTotalSpend/);
});
