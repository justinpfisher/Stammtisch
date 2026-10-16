/* GitHub-hosted bounded v3 adapter. Inputs are signed public-safe data only. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {digest} from './RulesPublisher.mjs';
import {COL_RULE_PUBLIC_FILES} from './observe-hosted-col.mjs';
import {behaviorDigest} from './RulesRelease.mjs';
import {STATE_PATH,EMPTY_STATE,currentOperation,validateCandidate,snapshotHashes,stageCandidate,authorizeActivation,confirmActivation,cancelStaged,sealCompletion} from './RulesStaged.mjs';
import {readReleaseWitness,validateSealedWitness,WITNESS_WORKFLOW} from '../../col-rules-witness.mjs';

export function sourceProof(receipt,commit,run){
  if(!receipt||receipt.kind!=='col-source-readonly-observation-v1'||receipt.digestFormat!=='monitor-semantic-v1-json-sorted-compact-ascii'||
    receipt.scope!=='spreadsheets.readonly'||receipt.qualification!=='snapshot-only-not-formula-or-allocation-approval'||
    receipt.implementationCommit!==commit||String(receipt.workflowRunId)!==String(run))throw Error('Independent Viewer receipt provenance mismatch');
  return {sourceDigest:receipt.sourceDigest,observedAt:new Date(receipt.observedAt).toISOString(),repoCommit:receipt.implementationCommit,workflowRun:String(receipt.workflowRunId)};
}
async function json(name){return JSON.parse(await readFile(name,'utf8'));}
async function immutable(name,value){
  await mkdir(path.dirname(name),{recursive:true});
  await writeFile(name,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
}
async function operationWitness(op){
  if(op.confirmation.sealDigest){
    const receipt=await json('data/col-releases/'+op.candidateDigest+'-witness.json');
    if(digest(receipt)!==op.confirmation.sealDigest)throw Error('Stored completion witness changed');
    return validateSealedWitness(receipt,op);
  }
  return readReleaseWitness(op.confirmation.producer);
}
export async function main(){
  for(const gate of ['ANNALS_RULES_V3_RELEASE_ENABLED','ANNALS_RULES_V3_HOSTED_ACCEPTED','ANNALS_RULES_V3_CLOCK_QUALIFIED','ANNALS_SIGNING_REMEDIATION_VERIFIED'])
    if(process.env[gate]!=='true')throw Error('V3 release qualification gate closed');
  const event=await json(process.env.GITHUB_EVENT_PATH);
  const action={'annals-col-candidate-v3':'stage','annals-col-activation-v3':'authorize','annals-col-confirm-v3':'confirm','annals-col-seal-v3':'seal','annals-col-cancel-v3':'cancel'}[event.action];
  if(!action||Object.keys(event.client_payload||{}).join(',')!=='envelope')throw Error('Constrained staged event required');
  let state;try{state=await json(STATE_PATH);}catch(e){if(e.code!=='ENOENT')throw e;state=structuredClone(EMPTY_STATE);}
  if(action==='seal'){
    const hash=event.client_payload.envelope.content?.candidateDigest,op=state.operations.find(o=>o.candidateDigest===hash);
    if(!op||op.phase!=='release_pending'||op.confirmation.sealDigest)throw Error('Unsealed ready release required');
    const independentWitness=await readReleaseWitness(op.confirmation.producer),activation=await json('data/col-releases/'+hash+'-activation.json');
    const result=sealCompletion({state,envelope:event.client_payload.envelope,secret:process.env.ANNALS_PUBLISH_SIGNING_KEY,enabled:true,independentWitness,activation});
    await immutable('data/col-releases/'+hash+'-witness.json',result.receipt);
    await writeFile(STATE_PATH,JSON.stringify(result.state,null,2)+'\n');return;
  }
  if(action==='cancel'){
    const op=state.operations.find(o=>o.revisionId===event.client_payload.envelope.content?.revisionId);let failedFinalWitness=false;
    if(op?.phase==='release_pending'){
      const outcome=await readReleaseWitness(op.confirmation.producer,{requireSuccess:false});
      const activation=await json('data/col-releases/'+op.candidateDigest+'-activation.json');
      failedFinalWitness=!outcome.successful||Date.parse(outcome.completedAt)>Date.parse(activation.expiresAt);
    }
    const result=cancelStaged({state,envelope:event.client_payload.envelope,secret:process.env.ANNALS_PUBLISH_SIGNING_KEY,enabled:true,failedFinalWitness});
    await writeFile(STATE_PATH,JSON.stringify(result.state,null,2)+'\n');return;
  }
  const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceWitness=sourceProof(await json(process.env.COL_SOURCE_WITNESS_PATH),commit,process.env.GITHUB_RUN_ID);
  const common={state,envelope:event.client_payload.envelope,secret:process.env.ANNALS_PUBLISH_SIGNING_KEY,enabled:true,now:new Date(),implementationCommit:commit,behaviorDigest:await behaviorDigest(),sourceWitness};
  let result;
  if(action==='stage'){
    const current=currentOperation(state);let files;
    if(current){
      const previous=await json('data/col-releases/'+current.candidateDigest+'-confirmed.json');
      if(digest(previous)!==current.confirmation.snapshotDigest||digest(snapshotHashes(previous.files))!==digest(previous.hashes))throw Error('Previous complete snapshot unavailable');
      const outcome=await operationWitness(current),activation=await json('data/col-releases/'+current.candidateDigest+'-activation.json');
      if(Date.parse(outcome.completedAt)>Date.parse(activation.expiresAt))throw Error('Previous release expired before completion');
      common.basePublishedAt=outcome.completedAt;files=previous.files;
    }else files=Object.fromEntries(await Promise.all(COL_RULE_PUBLIC_FILES.map(async p=>[p,await readFile(p,'utf8')])));
    result=stageCandidate({...common,files});
    await immutable('data/col-releases/'+result.candidateDigest+'.json',result.candidate);
  }else{
    const hash=event.client_payload.envelope.content?.candidateDigest;
    if(!/^[a-f0-9]{64}$/.test(hash||''))throw Error('Bounded candidate identity required');
    const candidate=await json('data/col-releases/'+hash+'.json');validateCandidate(candidate,hash);
    // Publication commits can follow the reviewed implementation. Changed code
    // still fails its independent behavior digest, and a rewritten history fails.
    execFileSync('git',['merge-base','--is-ancestor',candidate.implementationCommit,commit],{stdio:'pipe'});
    common.implementationCommit=candidate.implementationCommit;
    const current=currentOperation(state);
    let files;
    if(current){
      const previous=await json('data/col-releases/'+current.candidateDigest+'-confirmed.json');if(digest(previous)!==current.confirmation.snapshotDigest)throw Error('Previous snapshot changed');
      const outcome=await operationWitness(current),priorActivation=await json('data/col-releases/'+current.candidateDigest+'-activation.json');
      if(Date.parse(outcome.completedAt)>Date.parse(priorActivation.expiresAt))throw Error('Prior release job expired');files=previous.files;
    }
    else files=Object.fromEntries(await Promise.all(COL_RULE_PUBLIC_FILES.map(async p=>[p,await readFile(p,'utf8')])));
    if(digest(snapshotHashes(files))!==digest(candidate.baseFiles))throw Error('Current official base changed');
    if(action==='authorize'){
      result=authorizeActivation({...common,candidate});
      await immutable('data/col-releases/'+hash+'-activation.json',result.activation);
    }else{
      const activation=await json('data/col-releases/'+hash+'-activation.json');
      const producer={repository:'justinpfisher/Stammtisch',workflow:WITNESS_WORKFLOW,job:'staged',runId:String(process.env.GITHUB_RUN_ID),runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT),workflowHead:process.env.GITHUB_SHA,checkoutHead:commit};
      result=confirmActivation({...common,candidate,activation,producer});
      await immutable('data/col-releases/'+hash+'-confirmed.json',result.confirmedSnapshot);
    }
  }
  // Files above are immutable. A failed job/commit/push cannot partially publish
  // them; a later hosted failure leaves readers on the prior complete snapshot.
  await writeFile(STATE_PATH,JSON.stringify(result.state,null,2)+'\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Staged CoL operation held; no operative success established.');process.exitCode=1;});
