/* Mandatory last publication step. A successful enclosing GitHub job supplies
 * its own completed_at only after these exact public bytes have been observed. */
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {bytesHash,STATE_PATH,validateState,validateSource} from './RulesStaged.mjs';
import {sourceProof} from './run-staged-col.mjs';
export function verifyFinalSourceReceipt(receipt,op,{commit,run,now=new Date()}={}){
  if(op?.phase!=='release_pending'||op.confirmation.producer.runId!==String(run))throw Error('Exact release source witness required');
  const witness=sourceProof(receipt,commit,run);validateSource(witness,witness,commit,now);
  if(witness.sourceDigest!==op.confirmation.sourceDigest||Date.parse(witness.observedAt)<Date.parse(op.confirmation.observedAt))throw Error('Final independent source changed');
  return true;
}
export async function observeReadyRelease(expected,{fetchImpl=fetch,clock=()=>new Date(),expiresAt}={}){
  if(Object.keys(expected).length!==4||!Object.hasOwn(expected,STATE_PATH)||!Number.isFinite(Date.parse(expiresAt)))throw Error('Exact release package required');
  for(const [name,hash] of Object.entries(expected)){
    if(!/^(?:data\/col-rules-release-state\.json|data\/col-releases\/[a-f0-9]{64}(?:-activation|-confirmed)?\.json)$/.test(name)||!/^[a-f0-9]{64}$/.test(hash))throw Error('Unapproved public witness target');
    const response=await fetchImpl('https://stammtischbrewery.com/'+name,{method:'GET',cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});
    if(response.status!==200||response.redirected)throw Error('Hosted release not ready');
    const body=await response.text();if(body.length>3*1024*1024||bytesHash(body)!==hash)throw Error('Hosted release bytes differ');
  }
  const completed=clock();if(!(completed instanceof Date)||!Number.isFinite(completed.getTime())||completed.getTime()>Date.parse(expiresAt))throw Error('Release expired before hosted readback');
  return {kind:'complete-hosted-release-observation',observedAt:completed.toISOString()};
}
async function main(){
  const state=JSON.parse(await readFile(STATE_PATH,'utf8'));validateState(state);const op=state.operations.at(-1);
  if(op?.phase!=='release_pending'||op.confirmation.producer.runId!==process.env.GITHUB_RUN_ID||String(op.confirmation.producer.runAttempt)!==process.env.GITHUB_RUN_ATTEMPT)throw Error('Exact current producer required');
  if(process.argv[2]==='--source'){
    const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),receipt=JSON.parse(await readFile(process.env.COL_FINAL_SOURCE_WITNESS_PATH,'utf8'));
    verifyFinalSourceReceipt(receipt,op,{commit,run:process.env.GITHUB_RUN_ID});
    process.stdout.write('Final independent Viewer source agrees with the complete hosted release.\n');return;
  }
  const prefix='data/col-releases/'+op.candidateDigest,paths=[STATE_PATH,prefix+'.json',prefix+'-activation.json',prefix+'-confirmed.json'],expected={};
  for(const name of paths)expected[name]=bytesHash(await readFile(name,'utf8'));
  const activation=JSON.parse(await readFile(prefix+'-activation.json','utf8'));
  for(let attempt=0;attempt<8;attempt++){
    try{await observeReadyRelease(expected,{expiresAt:activation.expiresAt});process.stdout.write('Exact complete staged CoL release observed. Job completion remains the operative clock.\n');return;}
    catch{if(attempt===7||Date.now()>Date.parse(activation.expiresAt))throw Error('Hosted verification failed');await new Promise(resolve=>setTimeout(resolve,15000));}
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Complete hosted CoL readback FAILED; previous version remains operative.');process.exitCode=1;});
