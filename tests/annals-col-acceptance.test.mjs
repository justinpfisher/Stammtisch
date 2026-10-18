/* Fictional identities and local cryptographic fixtures only. No live services. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash,createHmac} from 'node:crypto';
import Rules from '../scripts/annals/RulesCore.js';
import {canonical,digest} from '../scripts/annals/RulesPublisher.mjs';
import {BEHAVIOR_FILES} from '../scripts/annals/RulesRelease.mjs';
import {EMPTY_STATE,MODES,snapshotHashes,stageCandidate,authorizeActivation,confirmActivation,sealCompletion,cancelStaged} from '../scripts/annals/RulesStaged.mjs';
import {acceptanceAuthority,releaseGate} from '../scripts/annals/run-staged-col.mjs';
import {verifyJobWitness,WITNESS_WORKFLOW,WITNESS_STEP,WITNESS_SOURCE_STEP} from '../col-rules-witness.mjs';
const clone=structuredClone,read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const id='a'.repeat(64),otherId='b'.repeat(64),commit='c'.repeat(40),behavior='d'.repeat(64),sourceDigest='e'.repeat(64);
const t0='2026-10-17T17:00:00.000Z',t1='2026-10-17T17:01:00.000Z',t2='2026-10-17T17:02:00.000Z',t3='2026-10-17T17:03:00.000Z',late='2026-10-17T17:46:00.000Z';
const key='fictional-acceptance-signing-key-not-a-production-secret';
const source={rulesAuthorityVersion:2,rulesActivationEligible:false,senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,protectiveRoute:'col_proposal',
  source:{sender:'fictional-member@example.invalid',receivedAt:'2026-10-16T12:00:00.000Z',subject:'CoL rule refinement.',
    excerpt:'Whoever had the oldest death in the year gets a steal. This is effective immediately',sourceTruncated:false,subjectTruncated:false,excerptTruncated:false}};
const paths=['data/col-rules-register.json','data/col-rules-versions.json','docs/celebration-of-life-rules.md','celebration.html','col-revisions.html'];
// GitHub checkout/raw files use LF; local Windows checkout can use CRLF.
const files=Object.fromEntries(paths.map(p=>[p,read(p).replace(/\r\n/g,'\n')]));
const base=Rules.select(JSON.parse(files['data/col-rules-versions.json']).versions,t0);
const producer={repository:'justinpfisher/Stammtisch',workflow:WITNESS_WORKFLOW,job:'staged',runId:'123456',runAttempt:1,workflowHead:commit,checkoutHead:commit};
function sign(phase,state,content,at=t0){const approval={mode:MODES[phase],baseStateDigest:digest(state),issuedAt:at};return {content,approval:{...approval,signature:createHmac('sha256',key).update(JSON.stringify(canonical({content,approval}))).digest('hex')}};}
const witness=at=>({sourceDigest,observedAt:at,repoCommit:commit,workflowRun:'123456'});
function fixture(){
  const revision=Rules.oldestSteal({senderAuthenticated:true,freshOperativeWindow:true,member:'fish',text:source.source.excerpt,receivedAt:source.source.receivedAt},base,'col-'+id.slice(0,24));
  const content={revision:{...Rules.publicRecord(revision),baseDigest:base.digest},qualification:'oldest-death-steal-v1',baseFiles:snapshotHashes(files),implementationCommit:commit,behaviorDigest:behavior,source:null};
  const descriptor={schemaVersion:1,kind:'col-oldest-acceptance-v1',revisionId:revision.id,contentDigest:digest(content),initialStateDigest:digest(EMPTY_STATE),implementationCommit:commit,behaviorDigest:behavior,nonce:'f'.repeat(64),armedAt:t0,expiresAt:'2026-10-17T17:45:00.000Z'};
  return {revision,content,descriptor,args:{state:clone(EMPTY_STATE),files:clone(files),envelope:sign('stage',EMPTY_STATE,content),secret:key,enabled:true,now:new Date(t0),implementationCommit:commit,behaviorDigest:behavior,sourceWitness:witness(t0)}};
}
function setup(){
  let now=t0,state=clone(EMPTY_STATE),currentFiles=clone(files),uuid=0;
  const privateFiles=new Map(),publicFiles=new Map(),dispatches=[],notices=[];
  const props={ANNALS_PUBLISH_SIGNING_KEY:key,ANNALS_APPROVAL_KEY:'fictional-independent-private-key',ANNALS_GITHUB_TOKEN:'fictional-local-token',ANNALS_GITHUB_REPOSITORY:'justinpfisher/Stammtisch',
    ANNALS_SIGNING_REMEDIATED_AT:'2026-10-17T16:59:00.000Z',ANNALS_SIGNING_QUALIFICATION_RECORD:'signing-qualification-123456-1-private.json'};
  const security={schemaVersion:1,state:'verified_signing_only',verifiedAt:props.ANNALS_SIGNING_REMEDIATED_AT,oldPrivateSignatureRejected:true,oldPublicSignatureRejected:true,newPrivateSignatureValid:true,separateKeys:true,
    outstandingDispatchReconciliationConfirmed:true,historicalWithdrawalReceiptGapPreserved:true,publicationActivated:false,crossPlatform:{githubSecretConsistencyVerified:true,separateKeys:true}};
  privateFiles.set('root/'+props.ANNALS_SIGNING_QUALIFICATION_RECORD,security);privateFiles.set(id+'/source-private.json',clone(source));
  const folder=name=>({getName:()=>name,toString:()=>name});
  const c=vm.createContext({AnnalsRules:Rules,AnnalsProduction:{serial:v=>JSON.stringify(canonical(v))},Date:class extends Date{constructor(v){super(v===undefined?now:v);}static now(){return Date.parse(now);}}});
  vm.runInContext(read('scripts/annals/Production.gs'),c);vm.runInContext(read('scripts/annals/RulesProduction.gs'),c);
  Object.assign(c,{annalsUiCall_:(nonce,fn)=>{assert.equal(nonce,'fictional-owner');return fn();},annalsLocked_:fn=>fn(),
    annalsProps_:()=>({getProperty:k=>props[k]||null}),annalsRoot_:()=>folder('root'),annalsFolder_:folder,
    annalsRead_:(f,n)=>clone(privateFiles.get(f+'/'+n)||null),annalsFile_:(f,n)=>privateFiles.has(f+'/'+n)?{setContent:text=>privateFiles.set(f+'/'+n,JSON.parse(text))}:null,
    annalsWriteOnce_:(f,n,v)=>{assert.equal(privateFiles.has(f+'/'+n),false,'no overwritten evidence');privateFiles.set(f+'/'+n,clone(v));},annalsSavePrivate_:(f,n,v)=>privateFiles.set(f+'/'+n,clone(v)),
    annalsConsentActive_:()=>true,annalsStandingPublicationActive_:()=>true,annalsSpeakerIdentities_:()=>({[source.source.sender]:'fish'}),
    annalsHash_:v=>createHash('sha256').update(v).digest('hex'),annalsHex_:v=>Buffer.from(v).toString('hex'),
    annalsRuleNotice_:(f,address,kind)=>notices.push(kind),
    Utilities:{getUuid:()=>String(++uuid),Charset:{UTF_8:'UTF-8'},computeHmacSha256Signature:(v,k)=>[...createHmac('sha256',k).update(v).digest()],newBlob:v=>({getBytes:()=>[...Buffer.from(v)]})},
    UrlFetchApp:{fetch:(url,options)=>{assert.equal(url,'https://api.github.com/repos/justinpfisher/Stammtisch/dispatches');dispatches.push(JSON.parse(options.payload));return {getResponseCode:()=>204};}}
  });
  c.annalsRuleContext_=()=>{
    const ready=state.operations.find(op=>op.phase==='release_pending'),versions=JSON.parse(currentFiles['data/col-rules-versions.json']).versions;
    if(ready)Object.assign(versions.at(-1),{verified:true,publishedAt:t3,effectiveAt:t3});
    return {commit,state:clone(state),files:clone(currentFiles),baseFiles:snapshotHashes(currentFiles),behaviorDigest:behavior,base:Rules.select(versions,now),publicationAt:ready?t3:null};
  };
  c.annalsRuleHead_=()=>commit;c.annalsRulePublicRead_=p=>p==='data/col-rules-release-state.json'?JSON.stringify(state):publicFiles.get(p);
  return {c,props,privateFiles,publicFiles,dispatches,notices,security,setNow:v=>{now=v;},setState:(v,next)=>{state=v;if(next)currentFiles=next;}};
}
function arm(x){const p=x.c.annalsPrepareRuleAcceptance('fictional-owner',id);return x.c.annalsArmRuleAcceptance('fictional-owner',id,p.preparationDigest,true).descriptor;}

test('preparation is read-only and arm requires real retained signing/reconciliation evidence',()=>{
  const x=setup(),before=JSON.stringify([...x.privateFiles]),p=x.c.annalsPrepareRuleAcceptance('fictional-owner',id);
  assert.equal(p.readOnly,true);assert.equal(JSON.stringify([...x.privateFiles]),before);assert.equal(x.dispatches.length,0);
  assert.throws(()=>x.c.annalsArmRuleAcceptance('fictional-owner',id,p.preparationDigest,false),/Genuine/);
  for(const field of ['oldPrivateSignatureRejected','oldPublicSignatureRejected','newPrivateSignatureValid','outstandingDispatchReconciliationConfirmed','historicalWithdrawalReceiptGapPreserved']){
    const y=setup();y.security[field]=false;assert.throws(()=>arm(y),/Verified signing/);assert.equal(y.privateFiles.has('root/col-acceptance-private.json'),false);
  }
  delete x.props.ANNALS_SIGNING_QUALIFICATION_RECORD;assert.throws(()=>arm(x),/qualification record/);
});
test('one immutable arm exports only public-safe bindings and leaves broad properties and source unchanged',()=>{
  const x=setup(),before=JSON.stringify(x.props),original=JSON.stringify(x.privateFiles.get(id+'/source-private.json')),d=arm(x);
  assert.equal(JSON.stringify(x.props),before);assert.equal(JSON.stringify(x.privateFiles.get(id+'/source-private.json')),original);assert.equal(x.dispatches.length,0);
  assert.equal(d.revisionId,'col-'+id.slice(0,24));assert.equal(Date.parse(d.expiresAt)-Date.parse(d.armedAt),2700000);
  const exported=JSON.stringify(d);for(const forbidden of [id,source.source.sender,source.source.excerpt,'sourceDigest'])assert.ok(!exported.includes(forbidden));
  assert.throws(()=>arm(x),/earlier acceptance/);x.setNow(late);assert.throws(()=>arm(x),/earlier acceptance/);
  assert.equal(x.c.annalsReadRuleAcceptance('fictional-owner',id).expired,true);
});
test('preparation and continuation reject changed source/base/implementation, revoked consent and consumed history',()=>{
  for(const marker of ['col-oldest-continuation-private.json','col-rule-request-private.json','col-v3-stage-dispatch-private.json','quarantine-private.json','ai-attempt-private.json']){
    const x=setup();x.privateFiles.set(id+'/'+marker,{state:'consumed'});assert.throws(()=>arm(x),/unconsumed original/);
  }
  const x=setup(),p=x.c.annalsPrepareRuleAcceptance('fictional-owner',id);x.privateFiles.get(id+'/source-private.json').source.subject='CoL rule change';
  assert.throws(()=>x.c.annalsArmRuleAcceptance('fictional-owner',id,p.preparationDigest,true),/changed/);assert.equal(x.dispatches.length,0);
  for(const kind of ['source','base','implementation','consent']){
    const y=setup();arm(y);
    if(kind==='source')y.privateFiles.get(id+'/source-private.json').source.subject='Not a request';
    if(kind==='base'||kind==='implementation'){const context=y.c.annalsRuleContext_;y.c.annalsRuleContext_=()=>({...context(),[kind==='base'?'baseFiles':'commit']:kind==='base'?{}:'0'.repeat(40)});}
    if(kind==='consent')y.c.annalsConsentActive_=()=>false;
    assert.throws(()=>y.c.annalsContinueHistoricOldestRule('fictional-owner',id));
    assert.equal(y.privateFiles.has(id+'/col-oldest-continuation-private.json'),false,kind);assert.equal(y.dispatches.length,0);
  }
});
test('broad and unselected routes remain closed; missing security and malformed hosted descriptors cannot admit work',()=>{
  const x=setup();arm(x);x.privateFiles.set(otherId+'/source-private.json',clone(source));
  assert.equal(x.c.annalsStagedRulesReady_(),false);assert.equal(x.c.annalsRulesReady_(),false);
  assert.throws(()=>x.c.annalsContinueHistoricOldestRule('fictional-owner',otherId),/qualification/);assert.equal(x.dispatches.length,0);
  const {descriptor}=fixture(),env={ANNALS_SIGNING_REMEDIATION_VERIFIED:'true',ANNALS_RULES_V3_ACCEPTANCE:JSON.stringify(descriptor)};
  assert.deepEqual(releaseGate(env),descriptor);assert.throws(()=>releaseGate({...env,ANNALS_SIGNING_REMEDIATION_VERIFIED:'false'}),/signing/);
  for(const gate of ['ANNALS_RULES_V3_RELEASE_ENABLED','ANNALS_RULES_V3_HOSTED_ACCEPTED','ANNALS_RULES_V3_CLOCK_QUALIFIED'])assert.throws(()=>releaseGate({...env,[gate]:'true'}),/remain off/);
  for(const raw of ['', 'null','not JSON','x'.repeat(2049)])assert.throws(()=>releaseGate({...env,ANNALS_RULES_V3_ACCEPTANCE:raw}));
  for(const patch of [{nonce:'bad'},{sourceId:id},{expiresAt:'2026-10-17T18:00:00.000Z'},{armedAt:t1},{kind:'all-rules'}])assert.throws(()=>Rules.acceptanceDescriptor({...descriptor,...patch},Date.parse(t0),'stage'));
});
test('hosted exact acceptance bindings reject arbitrary semantics, another revision, stale base and implementation',()=>{
  const f=fixture(),check=patch=>acceptanceAuthority({descriptor:f.descriptor,action:'stage',...f.args,...patch});assert.equal(check({}).revisionId,f.revision.id);
  for(const patch of [{contentDigest:'0'.repeat(64)},{initialStateDigest:'0'.repeat(64)},{implementationCommit:'0'.repeat(40)},{behaviorDigest:'0'.repeat(64)},{revisionId:'col-foreign-revision'}])assert.throws(()=>check({descriptor:{...f.descriptor,...patch}}));
  for(const patch of [{qualification:'literal-typography-v1'},{source:witness(t0)},{revision:{...f.content.revision,explanation:'Unsupported claim'}}])assert.throws(()=>check({envelope:sign('stage',EMPTY_STATE,{...f.content,...patch})}));
  assert.throws(()=>check({now:new Date(f.descriptor.expiresAt)}),/window/);
});
test('actual private dispatcher and hosted reducers preserve the original through all acceptance phases while broad gates are off',()=>{
  const x=setup(),d=arm(x),f=fixture(),original=JSON.stringify(x.privateFiles.get(id+'/source-private.json'));
  const continuation=x.c.annalsContinueHistoricOldestRule('fictional-owner',id);assert.equal(continuation.dispatchAccepted,true);assert.equal(x.dispatches.length,1);
  assert.throws(()=>x.c.annalsContinueHistoricOldestRule('fictional-owner',id),/unconsumed/);
  let envelope=x.dispatches[0].client_payload.envelope;
  acceptanceAuthority({descriptor:d,action:'stage',...f.args,envelope});const stage=stageCandidate({...f.args,envelope});
  const prefix='data/col-releases/'+stage.candidateDigest;x.publicFiles.set(prefix+'.json',JSON.stringify(stage.candidate));x.setState(stage.state);x.setNow(t1);
  assert.equal(x.c.annalsAdvanceRuleAcceptance('fictional-owner',id).advanced,true);assert.equal(x.dispatches.length,2);
  x.c.annalsAdvanceRuleAcceptance('fictional-owner',id);assert.equal(x.dispatches.length,2,'never repeat the saved phase');
  envelope=x.dispatches[1].client_payload.envelope;
  acceptanceAuthority({descriptor:d,action:'authorize',state:stage.state,envelope,candidate:stage.candidate,now:new Date(t1)});
  const authorized=authorizeActivation({...f.args,state:stage.state,candidate:stage.candidate,envelope,now:new Date(t1),sourceWitness:witness(t1),acceptanceUntil:d.expiresAt});
  assert.equal(authorized.activation.expiresAt,d.expiresAt);x.publicFiles.set(prefix+'-activation.json',JSON.stringify(authorized.activation));x.setState(authorized.state);x.setNow(t2);
  assert.equal(x.c.annalsAdvanceRuleAcceptance('fictional-owner',id).advanced,true);envelope=x.dispatches[2].client_payload.envelope;
  acceptanceAuthority({descriptor:d,action:'confirm',state:authorized.state,envelope,candidate:stage.candidate,activation:authorized.activation,now:new Date(t2)});
  const confirmed=confirmActivation({...f.args,state:authorized.state,candidate:stage.candidate,activation:authorized.activation,envelope,now:new Date(t2),sourceWitness:witness(t2),producer});
  x.setState(confirmed.state,confirmed.confirmedSnapshot.files);x.publicFiles.set(prefix+'-confirmed.json',JSON.stringify(confirmed.confirmedSnapshot));x.setNow(late);
  assert.equal(x.c.annalsAdvanceRuleAcceptance('fictional-owner',id).advanced,true,'timely completion can be retained after expiry');assert.equal(x.dispatches.length,4);envelope=x.dispatches[3].client_payload.envelope;
  acceptanceAuthority({descriptor:d,action:'seal',state:confirmed.state,envelope,candidate:stage.candidate,activation:authorized.activation,now:new Date(late)});
  const sealed=sealCompletion({state:confirmed.state,envelope,secret:key,enabled:true,now:new Date(late),activation:authorized.activation,independentWitness:{successful:true,completedAt:t3}});
  x.setState(sealed.state,confirmed.confirmedSnapshot.files);x.publicFiles.set(prefix+'-witness.json',JSON.stringify(sealed.receipt));
  assert.equal(x.c.annalsAdvanceRuleAcceptance('fictional-owner',id).advanced,true);assert.equal(x.c.annalsReadRuleAcceptance('fictional-owner',id).state,'verified_live');
  assert.equal(x.privateFiles.get(id+'/col-rule-request-private.json').effectiveAt,t3);assert.equal(x.privateFiles.get(id+'/col-rule-request-private.json').submittedAt,source.source.receivedAt);
  assert.equal(JSON.stringify(x.privateFiles.get(id+'/source-private.json')),original);assert.equal(x.c.annalsStagedRulesReady_(),false);assert.equal(x.notices.length,1);
  assert.equal(x.c.annalsAdvanceRuleAcceptance('fictional-owner',id).advanced,false);assert.equal(x.dispatches.length,4);
});
test('expiry holds new phases but preserves exact bounded cancellation and unknown dispatch evidence',()=>{
  const x=setup(),d=arm(x);x.c.UrlFetchApp.fetch=()=>{throw Error('fictional unknown transport');};
  assert.equal(x.c.annalsContinueHistoricOldestRule('fictional-owner',id).dispatchAccepted,false);
  const pending=x.privateFiles.get('root/col-release-pending-private.json'),envelope=clone(pending.envelope);
  assert.equal(pending.state,'unknown_or_held_no_retry');assert.equal(x.privateFiles.get(id+'/col-v3-stage-dispatch-private.json').state,'unknown_no_retry');
  x.setNow(late);assert.equal(x.c.annalsRuleExecutionReady_(id,'stage'),false);assert.equal(x.c.annalsRuleExecutionReady_(id,'authorize'),false);
  const result=x.c.annalsCancelStagedRule('fictional-owner',id,'expired');assert.equal(result.phase,'cancel');
  const cancel=x.privateFiles.get('root/col-release-pending-private.json').envelope;
  acceptanceAuthority({descriptor:d,action:'cancel',state:clone(EMPTY_STATE),envelope:cancel,now:new Date(late)});
  const cancelled=cancelStaged({state:clone(EMPTY_STATE),envelope:cancel,secret:key,enabled:true,now:new Date(late)});
  assert.equal(cancelled.state.events[0].phase,'failed');assert.deepEqual(x.privateFiles.get(id+'/col-v3-stage-envelope-private.json'),envelope);
  assert.throws(()=>stageCandidate({...fixture().args,state:cancelled.state,envelope:sign('stage',cancelled.state,envelope.content,late),now:new Date(late),sourceWitness:witness(late)}),/replayed/);
});
test('clipped activation prevents late publication and a widened activation cannot pass scoped enforcement',()=>{
  const f=fixture(),stage=stageCandidate(f.args),content={candidateDigest:stage.candidateDigest,observation:{candidateDigest:stage.candidateDigest,observedAt:t1},source:stage.candidate.source,baseFiles:stage.candidate.baseFiles};
  const args={...f.args,state:stage.state,candidate:stage.candidate,envelope:sign('authorize',stage.state,content,t1),now:new Date(t1),sourceWitness:witness(t1),acceptanceUntil:f.descriptor.expiresAt};
  const authorized=authorizeActivation(args);assert.equal(authorized.activation.expiresAt,f.descriptor.expiresAt);
  assert.throws(()=>authorizeActivation({...args,acceptanceUntil:t0}),/expired/);
  const confirmation={candidateDigest:stage.candidateDigest,activationDigest:authorized.activationDigest,observedAt:t2,source:stage.candidate.source,baseFiles:stage.candidate.baseFiles};
  assert.throws(()=>confirmActivation({...args,state:authorized.state,activation:authorized.activation,envelope:sign('confirm',authorized.state,{...confirmation,observedAt:late},late),now:new Date(late),sourceWitness:witness(late),producer}),/expired/);
  assert.throws(()=>acceptanceAuthority({descriptor:f.descriptor,action:'confirm',state:authorized.state,candidate:stage.candidate,envelope:{content:confirmation},activation:{...authorized.activation,expiresAt:late},now:new Date(t2)}),/deadline/);
  const confirmed=confirmActivation({...args,state:authorized.state,activation:authorized.activation,envelope:sign('confirm',authorized.state,confirmation,t2),now:new Date(t2),sourceWitness:witness(t2),producer});
  const seal={candidateDigest:stage.candidateDigest,snapshotDigest:digest(confirmed.confirmedSnapshot),producer,completedAt:late};
  assert.throws(()=>sealCompletion({state:confirmed.state,envelope:sign('seal',confirmed.state,seal,late),secret:key,enabled:true,now:new Date(late),activation:authorized.activation,independentWitness:{successful:true,completedAt:late}}),/completed job proof/);
});
test('completion witnesses accept only the exact bare or @main workflow path in both runtimes',()=>{
  const x=setup(),run={id:123456,run_attempt:1,path:WITNESS_WORKFLOW,event:'repository_dispatch',head_sha:commit,repository:{full_name:producer.repository},status:'completed',conclusion:'success'};
  const listing={total_count:1,jobs:[{name:'staged',run_id:123456,run_attempt:1,head_sha:commit,status:'completed',conclusion:'success',started_at:t1,completed_at:t3,
    steps:[{name:WITNESS_STEP,status:'completed',conclusion:'success',completed_at:t2},{name:WITNESS_SOURCE_STEP,status:'completed',conclusion:'success',started_at:t2,completed_at:t3}]}]};
  x.setNow(t3);x.c.UrlFetchApp.fetch=url=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify(url.includes('/jobs?')?listing:run)});
  for(const suffix of ['', '@main']){run.path=WITNESS_WORKFLOW+suffix;assert.equal(verifyJobWitness(producer,run,listing,{now:Date.parse(t3)}).successful,true);assert.equal(x.c.annalsRuleJobWitness_(producer).successful,true);}
  for(const suffix of ['@feature','@refs/heads/main','@main/extra','@main@main']){run.path=WITNESS_WORKFLOW+suffix;assert.throws(()=>verifyJobWitness(producer,run,listing,{now:Date.parse(t3)}));assert.throws(()=>x.c.annalsRuleJobWitness_(producer));}
});
test('acceptance dispatcher is included in both behavior manifests and desk separates preparation, arm and continuation',()=>{
  assert.ok(BEHAVIOR_FILES.includes('scripts/annals/Production.gs'));
  const script=read('scripts/annals/RulesProduction.gs'),names=script.match(/var names=(\[[^\n]+\]);/)[1];assert.deepEqual(vm.runInNewContext(names).join('|'),BEHAVIOR_FILES.join('|'));
  const ui=read('scripts/annals/ReviewUi.html');for(const method of ['annalsPrepareRuleAcceptance','annalsArmRuleAcceptance','annalsReadRuleAcceptance','annalsAdvanceRuleAcceptance','annalsRecordSigningQualification'])assert.ok(ui.includes(method));
  const armHandler=ui.slice(ui.indexOf("el('armRuleAcceptance').onclick"),ui.indexOf("el('readRuleAcceptance').onclick"));assert.ok(!armHandler.includes('annalsContinueHistoricOldestRule'));assert.ok(armHandler.includes('ruleAcceptancePrepared=null'));
});

test('unqualified literal staging stays closed even when the shared protocol is ready',()=>{
 let reads=0,literal='false';
 const c=vm.createContext({annalsProps_:()=>({getProperty:()=>literal}),annalsRoot_:()=> 'root',annalsRead_:()=>{reads++;return {state:'accepted'};}});
 vm.runInContext(readFileSync(new URL('../scripts/annals/RulesProduction.gs',import.meta.url),'utf8'),c);c.annalsStagedRulesReady_=()=>true;
 assert.equal(c.annalsStageLiteralRule_('fixture'),false);assert.equal(reads,0);
 literal='true';assert.equal(c.annalsStageLiteralRule_('fixture'),false);assert.equal(reads,1);
 const ui=readFileSync(new URL('../scripts/annals/ReviewUi.html',import.meta.url),'utf8');assert.ok(ui.includes("el('stageLiteralRule').disabled=!gates.ready||!gates.automaticLiteralEnabled"));
});
