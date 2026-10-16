/* Fictional loopback-only typography release; never publish these records. */
import {createHmac} from 'node:crypto';
import Rules from '../../scripts/annals/RulesCore.js';
import {canonical,digest,renderRegister} from '../../scripts/annals/RulesPublisher.mjs';
import {EMPTY_STATE,MODES,LITERAL_EXPLANATION,snapshotHashes,stageCandidate,authorizeActivation,confirmActivation,sealCompletion,STATE_PATH} from '../../scripts/annals/RulesStaged.mjs';
import {WITNESS_WORKFLOW,WITNESS_STEP,WITNESS_SOURCE_STEP,verifyJobWitness} from '../../col-rules-witness.mjs';

export function browserRuleFixture(){
  const key='fictional-browser-only-typography-fixture-key',commit='c'.repeat(40),behavior='d'.repeat(64),sourceDigest='e'.repeat(64);
  const times=[0,1,2,3,4].map(n=>'2026-01-15T18:0'+n+':00.000Z');
  const before="## PRIZE\n\nThe fictional member's tokens stay unchanged.",after='## PRIZE\n\nThe fictional  member’s tokens stay unchanged.';
  const base={id:'col-browser-baseline',digest:'a'.repeat(64),previous:null,verified:true,publishedAt:times[0],effectiveAt:times[0],provisions:{PRIZE:before},parameters:{fictionalTokens:7},januaryGap:'unresolved'};
  const directive='In the CoL rules, replace "'+before+'" with "'+after+'".';
  const revision=Rules.intake({senderAuthenticated:true,freshOperativeWindow:true,member:'marc',text:directive,receivedAt:times[0]},
    {intent:'operative',requestExcerpt:directive,changes:[{provision:'PRIZE',before,after,sourceExcerpt:directive}],explanation:'Fictional browser fixture.',clarification:'',effectiveAt:'',retrospective:{requested:false,period:'',results:'',clubAgreementExcerpt:''}},base,'col-browser-ready-0001');
  const register={schemaVersion:1,baseline:{id:base.id,recordedAt:times[0],description:'Fictional browser baseline.'},revisions:[],events:[]};
  const html='<section id="official-rules"><details class="rule-topic"><summary>PRIZE</summary><p>Previous complete fictional rule.</p></details>\n      <p class="rules-reference"><a href="docs/celebration-of-life-rules.md">Official reference</a></p></section>';
  const files={'celebration.html':html,'docs/celebration-of-life-rules.md':'# Fictional browser only\n\n'+before+'\n\n---\n',
    'data/col-rules-versions.json':JSON.stringify({schemaVersion:1,versions:[base]}),'data/col-rules-register.json':JSON.stringify(register),'col-revisions.html':renderRegister(register)};
  const proof=at=>({sourceDigest,observedAt:at,repoCommit:commit,workflowRun:'123456'});
  const sign=(kind,state,content,at)=>{const approval={mode:MODES[kind],baseStateDigest:digest(state),issuedAt:at};return {content,approval:{...approval,signature:createHmac('sha256',key).update(JSON.stringify(canonical({content,approval}))).digest('hex')}};};
  const common={secret:key,enabled:true,implementationCommit:commit,behaviorDigest:behavior};
  const candidate=stageCandidate({...common,state:structuredClone(EMPTY_STATE),files,now:new Date(times[0]),sourceWitness:proof(times[0]),envelope:sign('stage',EMPTY_STATE,{revision:{...Rules.publicRecord(revision),baseDigest:base.digest,explanation:LITERAL_EXPLANATION},qualification:'literal-typography-v1',baseFiles:snapshotHashes(files),implementationCommit:commit,behaviorDigest:behavior,source:null},times[0])});
  const h=candidate.candidateDigest,source=candidate.candidate.source,baseFiles=candidate.candidate.baseFiles;
  const authorized=authorizeActivation({...common,state:candidate.state,candidate:candidate.candidate,now:new Date(times[1]),sourceWitness:proof(times[1]),envelope:sign('authorize',candidate.state,{candidateDigest:h,observation:{candidateDigest:h,observedAt:times[1]},source,baseFiles},times[1])});
  const producer={repository:'justinpfisher/Stammtisch',workflow:WITNESS_WORKFLOW,job:'staged',runId:'123456',runAttempt:1,workflowHead:commit,checkoutHead:commit};
  const ready=confirmActivation({...common,state:authorized.state,candidate:candidate.candidate,activation:authorized.activation,producer,now:new Date(times[2]),sourceWitness:proof(times[2]),envelope:sign('confirm',authorized.state,{candidateDigest:h,activationDigest:authorized.activationDigest,observedAt:times[2],source,baseFiles},times[2])});
  const run={id:123456,run_attempt:1,path:WITNESS_WORKFLOW,event:'repository_dispatch',head_sha:commit,repository:{full_name:producer.repository},status:'completed',conclusion:'success'};
  const jobs={total_count:1,jobs:[{name:'staged',run_id:123456,run_attempt:1,head_sha:commit,status:'completed',conclusion:'success',started_at:times[2],completed_at:times[3],steps:[{name:WITNESS_STEP,status:'completed',conclusion:'success',completed_at:times[2]},{name:WITNESS_SOURCE_STEP,status:'completed',conclusion:'success',started_at:times[2],completed_at:times[3]}]}]};
  const sealed=sealCompletion({state:ready.state,secret:key,enabled:true,now:new Date(times[4]),activation:authorized.activation,independentWitness:verifyJobWitness(producer,run,jobs,{now:Date.parse(times[4])}),envelope:sign('seal',ready.state,{candidateDigest:h,snapshotDigest:ready.state.operations[0].confirmation.snapshotDigest,producer,completedAt:times[3]},times[4])});
  const prefix='/data/col-releases/'+h,api='https://api.github.com/repos/justinpfisher/Stammtisch/actions/runs/123456/attempts/1';
  const bodies=new Map([[STATE_PATH,ready.state],[prefix.slice(1)+'.json',candidate.candidate],[prefix.slice(1)+'-activation.json',authorized.activation],[prefix.slice(1)+'-confirmed.json',ready.confirmedSnapshot],[prefix.slice(1)+'-witness.json',sealed.receipt],[api,run],[api+'/jobs?per_page=100',jobs]]);
  return {html,revisionId:revision.id,bodies,readyState:ready.state,sealedState:sealed.state,failedJobs:{...jobs,jobs:jobs.jobs.map(j=>({...j,conclusion:'failure'}))},api};
}
