import test from 'node:test';
import assert from 'node:assert/strict';
import {SITE_FILES,SITE_ORIGIN,observeHostedSite} from '../scripts/annals/observe-hosted-site.mjs';

function responseFor(bytes,{status=200,redirected=false,length=null}={}){
  return {
    status,redirected,headers:{get:key=>key==='content-length'?length:null},
    arrayBuffer:async()=>{
      const b=Buffer.from(bytes);
      return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
    }
  };
}
function fixture(override={}){
  const calls=[];
  const fakeSource=name=>Buffer.from('fixture-'+name);
  const readFileImpl=async name=>{
    if(override.missing===name)throw Error('private fixture');
    return fakeSource(name);
  };
  const fetchImpl=async(url,options)=>{
    const u=new URL(url),name=u.pathname.slice(1);
    calls.push({url,options,name});
    assert.equal(u.origin,'https://stammtischbrewery.com');
    assert.ok(SITE_FILES.includes(name));
    assert.equal(options.method,'GET');
    assert.equal(options.redirect,'error');
    assert.equal(options.credentials,'omit');
    assert.equal(options.cache,'no-store');
    if(override.network===name)throw Error('network');
    const bytes=override.changed===name?Buffer.from('wrong'):fakeSource(name);
    return responseFor(bytes,{
      status:override.http===name?404:200,
      redirected:override.redirect===name,
      length:override.oversized===name?'2000000':null
    });
  };
  let count=0;
  const clock=()=>new Date(1700000000000+(override.reverseClock?(count++===0?1000:0):count++*1000));
  return {calls,run:()=>observeHostedSite({fetchImpl,readFileImpl,clock})};
}
test('fixed public-only source scope, no private files, user URLs or credentials',()=>{
  assert.equal(SITE_ORIGIN,'https://stammtischbrewery.com/');
  assert.equal(SITE_FILES.length,11);
  assert.equal(new Set(SITE_FILES).size,SITE_FILES.length);
  for(const name of SITE_FILES)assert.match(name,/^(?:[a-z0-9.-]+\.html|data\/[a-z0-9/.-]+\.json)$/);
});
test('matching live 11-file archive yields only source-bound public hashes and times',async()=>{
  const f=fixture(),result=await f.run();
  assert.equal(result.kind,'public-site-exact-byte-observation-only');
  assert.equal(result.files.length,11);
  assert.equal(f.calls.length,11);
  assert.equal(result.publishingActivated,false);
  assert.equal(result.privateReleaseQualified,false);
  for(const item of result.files){
    assert.equal(item.sha256.length,64);
    assert.ok(item.bytes>0);
  }
  assert.ok(!JSON.stringify(result).includes('fixture-'));
});
for(const [label,change] of [
  ['wrong hosted bytes',{changed:SITE_FILES[2]}],
  ['HTTP denial',{http:SITE_FILES[0]}],
  ['redirect',{redirect:SITE_FILES[0]}],
  ['oversize declaration',{oversized:SITE_FILES[0]}],
  ['unreachable network',{network:SITE_FILES[0]}],
  ['missing checked-out source',{missing:SITE_FILES[0]}],
  ['backwards clock',{reverseClock:true}]
])test('holds rather than attests '+label,async()=>{
  await assert.rejects(fixture(change).run());
});
