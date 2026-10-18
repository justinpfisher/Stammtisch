import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash,createHmac} from 'node:crypto';
import {makeReceipt} from '../scripts/annals/signing-consistency.mjs';
const source=readFileSync(new URL('../scripts/annals/HistoryProduction.gs',import.meta.url),'utf8');
const key='unicode-\u00e9-'.repeat(8), challenge='a'.repeat(64), sha='b'.repeat(40);
const env={ANNALS_PUBLISH_SIGNING_KEY:key,ANNALS_CHALLENGE:challenge,GITHUB_REPOSITORY:'justinpfisher/Stammtisch',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_RUN_ID:'12345',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:sha};
const hash=x=>createHash('sha256').update(x).digest('hex');
function fixture(change=()=>{}){
 const proof=makeReceipt(env),bytes=Buffer.from('fictional original zip'),state={proof,key,bytes,unzipCalls:0,files:null,token:"existing-restricted-fictional-token",requests:[]};
 state.artifact={id:6789,name:'signing-consistency-12345-1',size_in_bytes:bytes.length,expired:false,digest:'sha256:'+hash(bytes),workflow_run:{id:12345,head_sha:sha}};
 state.run={id:12345,run_attempt:1,event:'workflow_dispatch',path:'.github/workflows/annals-signing-consistency.yml',head_branch:'main',head_sha:sha,repository:{full_name:env.GITHUB_REPOSITORY},status:'completed',conclusion:'success',run_started_at:new Date(Date.now()-1000).toISOString(),updated_at:new Date(Date.now()+1000).toISOString()};
 state.job={run_id:12345,run_attempt:1,head_sha:sha,name:'challenge',status:'completed',conclusion:'success',started_at:state.run.run_started_at,completed_at:state.run.updated_at,steps:['Compute non-publishing key commitment','Retain bounded challenge receipt'].map(name=>({name,status:'completed',conclusion:'success'}))};
 change(state);
 const context={Date,console,annalsUiCall_:(n,f)=>{assert.equal(n,'owner-session');return f();},annalsProps_:()=>({getProperty:n=>n==='ANNALS_HISTORY_SIGNING_KEY'?state.key:n==='ANNALS_PUBLISH_SIGNING_KEY'?(state.publishKey||state.key):n==='ANNALS_GITHUB_TOKEN'?state.token:'private-key'.repeat(8)}),annalsHash_:hash,annalsHex_:b=>Buffer.from(b).toString('hex'),Utilities:{Charset:{UTF_8:'utf8'},DigestAlgorithm:{SHA_256:'sha256'},base64Decode:s=>Buffer.from(s,'base64'),computeDigest:(a,b)=>createHash(a).update(b).digest(),computeHmacSha256Signature:(m,k)=>createHmac('sha256',k).update(m).digest(),newBlob:b=>b,unzip:()=>{state.unzipCalls++;return state.files||[{getName:()=> 'signing-consistency.json',getBytes:()=>Buffer.from(JSON.stringify(state.proof)),getDataAsString:()=>JSON.stringify(state.proof)}];}},UrlFetchApp:{fetch:(url,options)=>{state.requests.push({url,options});let value;if(url.endsWith('/actions/artifacts/6789'))value=JSON.stringify(state.artifact);else if(url.endsWith('/actions/runs/12345/attempts/1'))value=JSON.stringify(state.run);else if(url.endsWith('/attempts/1/jobs?per_page=100'))value=JSON.stringify({total_count:1,jobs:[state.job]});else if(url.includes('/raw')||url.startsWith('https://raw.githubusercontent.com/'))value=readFileSync(new URL('../'+url.split(sha+'/')[1],import.meta.url),'utf8');else throw Error('Unexpected external route');return {getResponseCode:()=>state.httpStatus||200,getAllHeaders:()=>state.headers||{},getContentText:()=>value};}}};
 vm.createContext(context);vm.runInContext(source,context);return {state,run:(c=challenge,z=bytes.toString('base64'),diagnostic)=>context.annalsCheckGithubSigningConsistency('owner-session',c,'6789',z,diagnostic),runHistory:(c=challenge,z=bytes.toString('base64'),diagnostic)=>context.annalsCheckGithubHistorySigningConsistency('owner-session',c,'6789',z,diagnostic)};
}
test('Node and Apps Script agree without returning key or HMAC or changing state',()=>{const f=fixture(),r=f.run();assert.equal(r.githubSecretConsistencyVerified,true);assert.equal(r.publishesAnything,false);assert.equal(r.changesCredentials,false);assert.equal(r.changesReleaseGates,false);assert.ok(!JSON.stringify(r).includes(key));assert.deepEqual(Object.keys(r).sort(),['changesCredentials','changesReleaseGates','githubSecretConsistencyVerified','implementationCommit','publishesAnything','separateKeys','verifiedAt','workflowRunAttempt','workflowRunId'].sort());});
test('different publishing key fails equality without publication',()=>assert.equal(fixture(s=>s.key='different'.repeat(8)).run().githubSecretConsistencyVerified,false));
test('distinct History keys can be compared without using the ordinary authority or changing gates',()=>{
 const f=fixture(s=>{s.publishKey='ordinary-publishing-key-'.repeat(3);s.artifact.name='history-signing-consistency-12345-1';s.run.path='.github/workflows/annals-history-signing-consistency.yml';s.job.steps=['Compute non-publishing History key commitment','Retain bounded History challenge receipt'].map(name=>({name,status:'completed',conclusion:'success'}));});
 const r=f.runHistory();assert.equal(r.githubSecretConsistencyVerified,true);assert.equal(r.signingAuthority,'history');assert.equal(r.publishesAnything,false);assert.equal(r.changesCredentials,false);assert.equal(r.changesReleaseGates,false);assert.ok(!JSON.stringify(r).includes(key));
});
test('History comparison rejects reuse of the ordinary publishing authority',()=>{
 const f=fixture(s=>{s.publishKey=s.key;s.artifact.name='history-signing-consistency-12345-1';s.run.path='.github/workflows/annals-history-signing-consistency.yml';s.job.steps=['Compute non-publishing History key commitment','Retain bounded History challenge receipt'].map(name=>({name,status:'completed',conclusion:'success'}));});
 assert.throws(()=>f.runHistory(),/Independent signing configuration required/);
});
for(const [name,change] of Object.entries({skippedStep:s=>s.job.steps[0].conclusion='skipped',failedJob:s=>s.job.conclusion='failure',missingDigest:s=>delete s.artifact.digest,changedArchive:s=>s.artifact.digest='sha256:'+'0'.repeat(64),expired:s=>s.artifact.expired=true,wrongBranch:s=>s.run.head_branch='feature',failed:s=>s.run.conclusion='failure',running:s=>s.run.status='in_progress',wrongRepo:s=>s.run.repository.full_name='other/repo',wrongWorkflow:s=>s.run.path='other.yml',wrongCommit:s=>s.run.head_sha='c'.repeat(40),wrongAttempt:s=>s.run.run_attempt=2}))test('reject before unzip: '+name,()=>{const f=fixture(change);assert.throws(()=>f.run());assert.equal(f.state.unzipCalls,0);});
for(const [name,change] of Object.entries({wrongNonce:s=>s.proof.challenge='c'.repeat(64),wrongDomain:s=>s.proof.kind='annals-publication',wrongRun:s=>s.proof.runId='999',wrongAttempt:s=>s.proof.attempt='2',wrongCommit:s=>s.proof.headSha='c'.repeat(40),extraField:s=>s.proof.signature='forbidden',stale:s=>s.proof.createdAt=new Date(Date.now()-16*60*1000).toISOString(),future:s=>s.proof.createdAt=new Date(Date.now()+60000).toISOString(),shortKey:s=>s.key='short',extraFiles:s=>s.files=[{},{}],pathTraversal:s=>s.files=[{getName:()=> '../signing-consistency.json'}],oversized:s=>s.files=[{getName:()=> 'signing-consistency.json',getBytes:()=>Buffer.alloc(4097)}]}))test('reject receipt: '+name,()=>assert.throws(()=>fixture(change).run()));
test('bounded caller inputs cannot select URLs or huge archives',()=>{const f=fixture();assert.throws(()=>f.run('https://evil'));assert.throws(()=>f.run(challenge,'a'.repeat(90004)));});
test('producer rejects missing key, wrong branch and command-like nonce',()=>{for(const patch of [{ANNALS_PUBLISH_SIGNING_KEY:''},{GITHUB_REF:'refs/heads/evil'},{ANNALS_CHALLENGE:'$(printenv)'}])assert.throws(()=>makeReceipt({...env,...patch}));});

test('fixed workflow path with main suffix is accepted',()=>assert.equal(fixture(s=>s.run.path+='@main').run().githubSecretConsistencyVerified,true));
test('unreviewed workflow suffix is rejected',()=>assert.throws(()=>fixture(s=>s.run.path+='@evil').run()));

test('HTTP failure diagnostics identify the fixed endpoint and status without bypassing rejection',()=>{
 const f=fixture(s=>s.httpStatus=403),diagnostic={};
 assert.throws(()=>f.run(undefined,undefined,diagnostic),/Public verification evidence unavailable/);
 assert.equal(diagnostic.stage,'artifact_http');assert.equal(diagnostic.http.artifact,403);
 assert.equal(f.state.unzipCalls,0);assert.ok(!JSON.stringify(diagnostic).includes(key));
 assert.deepEqual(Object.keys(diagnostic).sort(),['failure','http','rateLimitRemaining','stage']);
 assert.equal(diagnostic.failure,'unclassified_http');
});
test('artifact failure and successful verification expose different bounded stages',()=>{
 let diagnostic={};assert.throws(()=>fixture(s=>delete s.artifact.digest).run(undefined,undefined,diagnostic));
 assert.equal(diagnostic.stage,'artifact_validation');
 diagnostic={};assert.equal(fixture().run(undefined,undefined,diagnostic).githubSecretConsistencyVerified,true);
 assert.equal(diagnostic.stage,'complete');assert.deepEqual(Object.values(diagnostic.http),[200,200,200,200,200]);
 assert.ok(!JSON.stringify(diagnostic).includes(key));
});

test('rate-limit diagnosis uses only bounded standard header evidence',()=>{
 for(const headers of [{'X-RateLimit-Remaining':'0'},{'x-ratelimit-remaining':0}]){
  const diagnostic={};assert.throws(()=>fixture(s=>{s.httpStatus=403;s.headers=headers;}).run(undefined,undefined,diagnostic));
  assert.equal(diagnostic.failure,'github_rate_limit');assert.equal(diagnostic.rateLimitRemaining,0);
 }
 const diagnostic={};assert.throws(()=>fixture(s=>{s.httpStatus=403;s.headers={'X-RateLimit-Remaining':'secret-or-invalid','Other':'private'};}).run(undefined,undefined,diagnostic));
 assert.equal(diagnostic.failure,'unclassified_http');assert.equal(diagnostic.rateLimitRemaining,null);assert.ok(!JSON.stringify(diagnostic).includes('private'));
});

test('existing repository credential is confined to fixed API GETs with redirects disabled',()=>{
 const f=fixture();assert.equal(f.run().githubSecretConsistencyVerified,true);
 assert.equal(f.state.requests.length,5);
 for(const {url,options} of f.state.requests){
  assert.equal(options.method,'get');assert.equal(options.followRedirects,false);assert.equal(options.validateHttpsCertificates,true);
  if(url.startsWith('https://api.github.com/repos/justinpfisher/Stammtisch/'))assert.equal(options.headers.Authorization,'Bearer '+f.state.token);
  else {assert.ok(url.startsWith('https://raw.githubusercontent.com/justinpfisher/Stammtisch/'));assert.equal(options.headers.Authorization,undefined);}
 }
 const missing=fixture(s=>s.token='');assert.throws(()=>missing.run(),/Existing repository verification credential required/);assert.equal(missing.state.requests.length,0);
});
