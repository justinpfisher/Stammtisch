/* Self-contained source-transfer helper tests. Offline, fictional and without private data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';

const html=readFileSync(new URL('../scripts/annals/private-source-transfer-offline.html',import.meta.url),'utf8');
const expected=['Production.gs','HistoryProduction.gs','PhotoProduction.gs',
  'GuardedRelease.gs','RulesProduction.gs','PilotCore.gs','RulesCore.gs'];
function digest(buffer){return createHash('sha256').update(buffer).digest('hex');}
class Field{
  constructor(){this.listeners={};this.options=[];this.value='';this.disabled=false;this.files=[];this._text='';}
  addEventListener(event,listener){this.listeners[event]=listener;}
  appendChild(item){this.options.push(item);if(!this.value)this.value=item.value;}
  set textContent(s){this._text=s;this.options=[];if(s==='')this.value='';}
  get textContent(){return this._text;}
  focus(){} select(){}
}
function harness(){
  const script=html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(script,'inline offline implementation exists');
  const fields=Object.fromEntries(['package','package-status','module','copy','source',
    'readback','verify','clear','result','load','preloaded','readback-progress'].map(id=>[id,new Field()]));
  const document={getElementById:id=>fields[id],createElement:()=>new Field()};
  const ctx={document,crypto:webcrypto,TextEncoder,Uint8Array,navigator:{},console};
  vm.runInNewContext(script[1]+'\n;globalThis.verifyPrivateTransfer={classifyReadback,sha256};',ctx);
  return {fields,verify:ctx.verifyPrivateTransfer};
}
function fakeFile(name,text){
  const raw=Buffer.from(text,'utf8');
  return {name,text:async()=>text,
    arrayBuffer:async()=>raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)};
}
function packageFixture(tamperName=''){
  const records=[],files=[];
  for(const name of expected){
    const repoName=(name==='PilotCore.gs'||name==='RulesCore.gs')
      ? name.slice(0,-3)+'.js':name;
    const source=readFileSync(new URL('../scripts/annals/'+repoName,import.meta.url));
    const data=source.toString('utf8');
    records.push({source:'scripts/annals/'+repoName,install:'install/'+name,sha256:digest(source)});
    files.push(fakeFile(name,name===tamperName ? data+'\n// malicious alteration' : data));
  }
  const manifest={schemaVersion:1,sourceCommit:'a'.repeat(40),installed:false,
    credentialsIncluded:false,publicationActivated:false,files:records};
  files.push(fakeFile('source-manifest.json',JSON.stringify(manifest)));
  return files;
}

test('the transfer page is explicitly offline and never has a network connection',()=>{
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/default-src 'none'/);
  assert.doesNotMatch(html,/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/);
  for(const name of expected)assert.ok(html.includes("'"+name+"'"));
  assert.match(html,/does not access Google accounts/);
});
test('exact, newline-normalized and modified saved editor content are distinguished',()=>{
  const {verify}=harness();
  assert.equal(verify.classifyReadback('a\nb\n','a\nb\n'),'exact');
  assert.equal(verify.classifyReadback('a\r\nb\r\n','a\nb\n'),'line_endings_only');
  assert.equal(verify.classifyReadback('a\nb\n','a\nb'),'line_endings_and_final_newline_only');
  assert.equal(verify.classifyReadback('a\nb','a\nB'),'mismatch');
  assert.equal(verify.classifyReadback('a=1;','a=2;'),'mismatch');
});
test('package and whole-source hashes are checked before any editor transfer',async()=>{
  const {fields,verify}=harness();
  const raw='Fictional source';
  assert.equal(await verify.sha256(raw),digest(Buffer.from(raw)));
  fields.package.files=packageFixture();
  await fields.load.listeners.click();
  assert.match(fields['package-status'].textContent,/7 of 7 public modules match/);
  assert.equal(fields.module.disabled,false);
  assert.equal(fields.module.options.length,7);
  assert.equal(fields.source.value,readFileSync(
    new URL('../scripts/annals/Production.gs',import.meta.url),'utf8'));
  fields.readback.value=fields.source.value;
  await fields.verify.listeners.click();
  assert.match(fields.result.textContent,/MATCH — exact text/);
  fields.readback.value+='// intentional test-only modification';
  await fields.verify.listeners.click();
  assert.match(fields.result.textContent,/HOLD — content differs/);
});
test('preloaded reviewed source needs no browser file picker and exactly matches all seven public files',async()=>{
  const {fields}=harness();
  assert.equal(fields.package.files.length,0);
  await fields.preloaded.listeners.click();
  assert.match(fields['package-status'].textContent,/7 of 7 built-in source modules match/);
  assert.match(fields['package-status'].textContent,/a40064d1aa62d9b1e3d8ccb8532b146aebfa5db1/);
  assert.equal(fields.module.options.length,7);
  assert.equal(fields.module.disabled,false);
  assert.match(fields['readback-progress'].textContent,/0 \/ 7/);
  for(const name of expected){
    fields.module.value=name;
    fields.module.listeners.change();
    const repoName=(name==='PilotCore.gs'||name==='RulesCore.gs')?name.slice(0,-3)+'.js':name;
    const original=readFileSync(new URL('../scripts/annals/'+repoName,import.meta.url),'utf8');
    assert.equal(fields.source.value,original,'exact reviewed public source for '+name);
    fields.readback.value=original;
    await fields.verify.listeners.click();
    assert.match(fields.result.textContent,/MATCH — exact text/);
  }
  assert.match(fields['readback-progress'].textContent,/7 \/ 7 complete editor readbacks verified/);
  fields.module.value='Production.gs';fields.module.listeners.change();
  fields.readback.value='test-only mismatch';
  await fields.verify.listeners.click();
  assert.match(fields.result.textContent,/HOLD — content differs/);
  assert.match(fields['readback-progress'].textContent,/6 \/ 7/);
});

test('tampered source fails before copy and readback controls unlock',async()=>{
  const {fields}=harness();
  fields.package.files=packageFixture('PilotCore.gs');
  await fields.load.listeners.click();
  assert.match(fields['package-status'].textContent,/SHA-256 mismatch for PilotCore/);
  assert.equal(fields.module.disabled,true);
  assert.equal(fields.copy.disabled,true);
});
