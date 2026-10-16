// Public GitHub metadata is an external completion clock. It is read-only and
// fixed to this repository/workflow; no caller URL or credential is accepted.
export const WITNESS_WORKFLOW='.github/workflows/annals-col-rules-v3.yml';
export const WITNESS_STEP='Verify complete hosted ready snapshot';
export const WITNESS_SOURCE_STEP='Verify final independent Viewer source';
export function validateProducer(p){
  if(!p||Object.keys(p).sort().join(',')!=='checkoutHead,job,repository,runAttempt,runId,workflow,workflowHead'||p.repository!=='justinpfisher/Stammtisch'||
    p.workflow!==WITNESS_WORKFLOW||p.job!=='staged'||!/^\d{1,20}$/.test(p.runId)||!Number.isSafeInteger(p.runAttempt)||p.runAttempt<1||
    !/^[a-f0-9]{40}$/.test(p.workflowHead)||!/^[a-f0-9]{40}$/.test(p.checkoutHead))throw Error('Invalid fixed release producer');
  return p;
}
export function validateSealedWitness(receipt,operation,{now=Date.now()}={}){
  const c=operation?.confirmation,keys='activationDigest,candidateDigest,kind,producer,publishedAt,schemaVersion,snapshotDigest,verifiedAt';
  if(!receipt||Object.keys(receipt).sort().join(',')!==keys||receipt.schemaVersion!==3||receipt.kind!=='col-completion-witness-v1'||
    receipt.candidateDigest!==operation.candidateDigest||receipt.activationDigest!==operation.activationDigest||receipt.snapshotDigest!==c?.snapshotDigest)
    throw Error('Sealed release witness identity mismatch');
  validateProducer(receipt.producer);validateProducer(c.producer);
  for(const key of Object.keys(receipt.producer))if(receipt.producer[key]!==c.producer[key])throw Error('Sealed producer mismatch');
  const at=Date.parse(receipt.publishedAt),verified=Date.parse(receipt.verifiedAt),observed=Date.parse(c.observedAt);
  if(!Number.isFinite(at)||!Number.isFinite(verified)||!Number.isFinite(observed)||at<observed||verified<at||verified>now)throw Error('Invalid sealed completion clock');
  return {successful:true,completedAt:new Date(at).toISOString(),conclusion:'success'};
}
export function verifyJobWitness(producer,run,listing,{now=Date.now(),requireSuccess=true}={}){
  validateProducer(producer);
  if(String(run?.id)!==producer.runId||run.run_attempt!==producer.runAttempt||run.path!==producer.workflow||run.event!=='repository_dispatch'||
    run.head_sha!==producer.workflowHead||run.repository?.full_name!==producer.repository||run.status!=='completed'||!Array.isArray(listing?.jobs)||listing.total_count!==listing.jobs.length)
    throw Error('Release workflow identity or completion unavailable');
  const jobs=listing.jobs.filter(job=>job.name===producer.job);
  if(jobs.length!==1)throw Error('Unique release job required');
  const job=jobs[0],at=Date.parse(job.completed_at),start=Date.parse(job.started_at),step=job.steps?.filter(s=>s.name===WITNESS_STEP),source=job.steps?.filter(s=>s.name===WITNESS_SOURCE_STEP);
  if(String(job.run_id)!==producer.runId||job.run_attempt!==producer.runAttempt||job.head_sha!==producer.workflowHead||job.status!=='completed'||
    !Number.isFinite(at)||!Number.isFinite(start)||at<start||at>now)throw Error('Release job clock unavailable');
  const hostedAt=Date.parse(step?.[0]?.completed_at),sourceStart=Date.parse(source?.[0]?.started_at),sourceAt=Date.parse(source?.[0]?.completed_at);
  const successful=run.conclusion==='success'&&job.conclusion==='success'&&step?.length===1&&step[0].status==='completed'&&step[0].conclusion==='success'&&
    source?.length===1&&source[0].status==='completed'&&source[0].conclusion==='success'&&Number.isFinite(hostedAt)&&Number.isFinite(sourceStart)&&Number.isFinite(sourceAt)&&
    hostedAt>=start&&sourceStart>=hostedAt&&sourceAt>=sourceStart&&at>=sourceAt&&at-sourceStart<=300000;
  if(requireSuccess&&!successful)throw Error('Hosted verification job did not succeed');
  return {successful,completedAt:new Date(at).toISOString(),conclusion:job.conclusion};
}
export async function readReleaseWitness(producer,{fetchImpl=fetch,now=Date.now(),requireSuccess=true}={}){
  validateProducer(producer);const prefix='https://api.github.com/repos/justinpfisher/Stammtisch/actions/runs/'+producer.runId;
  async function read(url){
    const response=await fetchImpl(url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',headers:{Accept:'application/vnd.github+json','Cache-Control':'no-cache'}});
    if(!response||response.status!==200||response.redirected)throw Error('Public release witness unavailable');
    const body=await response.text();if(!body||body.length>512*1024)throw Error('Bounded release witness required');return JSON.parse(body);
  }
  const run=await read(prefix+'/attempts/'+producer.runAttempt),jobs=await read(prefix+'/attempts/'+producer.runAttempt+'/jobs?per_page=100');
  return verifyJobWitness(producer,run,jobs,{now,requireSuccess});
}
