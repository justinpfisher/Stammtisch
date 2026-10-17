import {createHmac,createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function makeReceipt(env,now=new Date().toISOString()) {
  const key=env.ANNALS_PUBLISH_SIGNING_KEY;
  if(typeof key!=='string'||key.length<32||env.GITHUB_REPOSITORY!=='justinpfisher/Stammtisch'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||!/^([a-f0-9]{64})$/.test(env.ANNALS_CHALLENGE||'')||!/^\d{1,20}$/.test(env.GITHUB_RUN_ID||'')||!/^\d{1,5}$/.test(env.GITHUB_RUN_ATTEMPT||'')||!/^([a-f0-9]{40})$/.test(env.GITHUB_SHA||'')) throw new Error('Invalid challenge context');
  const receipt={kind:'annals-key-consistency-v1',repository:env.GITHUB_REPOSITORY,challenge:env.ANNALS_CHALLENGE,runId:env.GITHUB_RUN_ID,attempt:env.GITHUB_RUN_ATTEMPT,headSha:env.GITHUB_SHA,createdAt:now};
  const message='ANNALS NON-PUBLISHING KEY CONSISTENCY V1\n'+JSON.stringify([receipt.repository,receipt.challenge,receipt.runId,receipt.attempt,receipt.headSha,receipt.createdAt]);
  const mac=createHmac('sha256',key).update(message,'utf8').digest('hex');
  return {...receipt,commitment:createHash('sha256').update(mac,'utf8').digest('hex')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{writeFileSync('signing-consistency.json',JSON.stringify(makeReceipt(process.env))+'\n',{flag:'wx'});console.log('Non-publishing receipt created; no keys or signatures emitted.');}
  catch{console.error('Challenge failed; no credential details emitted.');process.exitCode=1;}
}
