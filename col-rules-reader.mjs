/* Complete snapshot admission. A new candidate/partial deployment never changes
 * the displayed operative version. Origin integrity remains the trust boundary;
 * browsers do not receive the private HMAC key or claim to authenticate members. */
import {readReleaseWitness,validateSealedWitness} from './col-rules-witness.mjs';
const FILES=['data/col-rules-register.json','data/col-rules-versions.json','docs/celebration-of-life-rules.md','celebration.html','col-revisions.html'];
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const serial=v=>JSON.stringify(canonical(v));
const hex=v=>/^[a-f0-9]{64}$/.test(v||'');
const validTime=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export async function sha(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
const digest=v=>sha(serial(v));
async function readJson(path,fetchImpl){
  if(!/^data\/(?:col-rules-release-state\.json|col-releases\/[a-f0-9]{64}(?:-activation|-confirmed|-witness)?\.json)$/.test(path))throw Error('Unapproved rule path');
  const r=await fetchImpl(path,{method:'GET',cache:'no-store',credentials:'omit',redirect:'error',headers:{'Cache-Control':'no-cache'}});
  if(!r||r.status!==200||r.redirected)throw Error('Complete hosted snapshot unavailable');
  const body=await r.text();if(!body.length||new TextEncoder().encode(body).length>3*1024*1024)throw Error('Oversized rule snapshot');return JSON.parse(body);
}
async function validateFiles(value){
  if(Object.keys(value.files||{}).sort().join('|')!==[...FILES].sort().join('|')||Object.keys(value.hashes||{}).sort().join('|')!==[...FILES].sort().join('|'))throw Error('Incomplete rule snapshot');
  for(const p of FILES)if(typeof value.files[p]!=='string'||!hex(value.hashes[p])||await sha(value.files[p])!==value.hashes[p])throw Error('Rule file discrepancy');
}
async function resolveOperation(op,fetchImpl,now){
  if(op.phase!=='release_pending'||!hex(op.candidateDigest)||!hex(op.activationDigest)||!hex(op.confirmation?.snapshotDigest)||
    op.confirmation.candidateDigest!==op.candidateDigest||op.confirmation.activationDigest!==op.activationDigest||!validTime(op.confirmation.observedAt)||Date.parse(op.confirmation.observedAt)>now)throw Error('Unconfirmed rule version');
  const prefix='data/col-releases/'+op.candidateDigest;
  const candidate=await readJson(prefix+'.json',fetchImpl),activation=await readJson(prefix+'-activation.json',fetchImpl),view=await readJson(prefix+'-confirmed.json',fetchImpl);
  if(await digest(candidate)!==op.candidateDigest||await digest(activation)!==op.activationDigest||await digest(view)!==op.confirmation.snapshotDigest)throw Error('Immutable release discrepancy');
  if(candidate.kind!=='non-operative-col-candidate'||view.kind!=='col-ready-snapshot-awaiting-job-witness'||activation.kind!=='col-activation-awaiting-independent-readback'||
    candidate.previous!==op.previous||activation.previous!==op.previous||activation.candidateDigest!==op.candidateDigest||view.candidateDigest!==op.candidateDigest||view.activationDigest!==op.activationDigest||
    view.observedAt!==op.confirmation.observedAt||serial(view.producer)!==serial(op.confirmation.producer)||!validTime(activation.authorizedAt)||!validTime(activation.expiresAt)||!validTime(activation.candidateObservedAt)||
    Date.parse(activation.candidateObservedAt)<Date.parse(candidate.stagedAt)||Date.parse(activation.candidateObservedAt)>Date.parse(activation.authorizedAt)||
    Date.parse(view.observedAt)<Date.parse(activation.authorizedAt)||Date.parse(view.observedAt)>Date.parse(activation.expiresAt)||
    activation.effectiveAt!==null||activation.publishedAt!==null||candidate.source.sourceDigest!==op.confirmation.sourceDigest||activation.source.sourceDigest!==op.confirmation.sourceDigest)
    throw Error('Release clock or source discrepancy');
  await validateFiles(candidate);await validateFiles(view);
  if(serial(candidate.files)!==serial(view.files))throw Error('Ready snapshot differs from qualified candidate');
  let outcome;
  if(op.confirmation.sealDigest){
    try{
      const receipt=await readJson(prefix+'-witness.json',fetchImpl);
      if(!hex(op.confirmation.sealDigest)||await digest(receipt)!==op.confirmation.sealDigest)throw Error('Retained completion witness discrepancy');
      outcome=validateSealedWitness(receipt,op,{now});
    }catch{outcome=await readReleaseWitness(view.producer,{fetchImpl,now});}
  }else outcome=await readReleaseWitness(view.producer,{fetchImpl,now});
  const at=outcome.completedAt;
  if(Date.parse(at)<Date.parse(view.observedAt)||Date.parse(at)>Date.parse(activation.expiresAt)||candidate.requestedEffectiveAt&&Date.parse(at)!==Date.parse(candidate.requestedEffectiveAt))throw Error('Late or invalid operative publication clock');
  const catalog=JSON.parse(view.files['data/col-rules-versions.json']),pending=catalog.versions.at(-1),register=JSON.parse(view.files['data/col-rules-register.json']),record=register.revisions.at(-1);
  if(pending?.id!==op.revisionId||pending.verified!==false||pending.protocol!==3||pending.effectiveAt!==null||pending.publishedAt!==null||record?.id!==op.revisionId||record.state!=='awaiting_implementation'||record.publishedAt!==null)throw Error('Ready version must remain non-operative until job witness');
  const predecessor=catalog.versions.at(-2);
  if(!predecessor||pending.previous!==predecessor.id||candidate.baseVersion!==predecessor.id||candidate.baseDigest!==predecessor.digest||
    serial(pending.parameters)!==serial(predecessor.parameters)||pending.januaryGap!==predecessor.januaryGap)throw Error('Executable parameters or January continuity changed');
  const last={...pending,verified:true,publishedAt:at,effectiveAt:at,confirmedAt:at};catalog.versions=[...catalog.versions.slice(0,-1),last];
  register.revisions=[...register.revisions.slice(0,-1),{...record,state:'active',publishedAt:at,effectiveAt:at}];
  const files={...view.files,'data/col-rules-versions.json':JSON.stringify(catalog,null,2)+'\n','data/col-rules-register.json':JSON.stringify(register,null,2)+'\n'};
  return {candidateDigest:op.candidateDigest,previous:op.previous,operation:op,files,versions:catalog.versions,version:last,register};
}
export async function loadOperativeSnapshot({fetchImpl=fetch,now=Date.now(),previous=null,versionId=null}={}){
  if(!Number.isFinite(now))return previous;
  try{
    const state=await readJson('data/col-rules-release-state.json',fetchImpl);
    if(state.schemaVersion!==3||!Array.isArray(state.operations)||state.operations.length>5000)throw Error('Invalid release ledger');
    const confirmed=state.operations.filter(op=>op.phase==='release_pending'),seen=new Set();let prior=null;
    for(const op of confirmed){if(!hex(op.candidateDigest)||seen.has(op.candidateDigest)||op.previous!==prior)throw Error('Competing or rewritten release chain');seen.add(op.candidateDigest);prior=op.candidateDigest;}
    if(previous&&!seen.has(previous.candidateDigest))return previous; // A stale cache cannot roll back a verified session.
    for(const op of [...confirmed].reverse()){
      if(versionId&&op.revisionId!==versionId)continue;
      if(previous&&op.candidateDigest===previous.candidateDigest)return previous;
      try{return await resolveOperation(op,fetchImpl,now);}catch{/* A missing edge/file keeps the most recent complete predecessor. */}
    }
  }catch{/* Baseline/current complete DOM stays intact on every read failure. */}
  return previous;
}

export async function refreshOfficialRules(){
  const boundary=document.querySelector('#official-rules');if(!boundary)return;
  const current=await loadOperativeSnapshot();if(!current)return;
  const parsed=new DOMParser().parseFromString(current.files['celebration.html'],'text/html'),topics=[...parsed.querySelectorAll('.rule-topic')],old=[...boundary.querySelectorAll('.rule-topic')];
  if(!topics.length||!old.length)return;
  // All network and schema checks completed before a single visible node changes.
  const fragment=document.createDocumentFragment();for(const topic of topics)fragment.append(document.importNode(topic,true));old[0].before(fragment);for(const node of old)node.remove();
  const note=boundary.querySelector('#rules-version-status')||document.createElement('p');note.id='rules-version-status';note.className='rules-reference';note.textContent='Rules updated '+new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',dateStyle:'long'}).format(new Date(current.version.confirmedAt))+'.';if(!note.parentNode)boundary.append(note);
  const reference=boundary.querySelector('a[href="docs/celebration-of-life-rules.md"]');
  if(reference){reference.href='col-rules-version.html?version='+encodeURIComponent(current.version.id)+'&reference=1';reference.textContent='Read the official rules';}
}
