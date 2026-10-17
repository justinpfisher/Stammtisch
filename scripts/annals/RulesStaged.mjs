/* V3 immutable candidate + independently authenticated activation protocol.
 * No live call is made when imported. No supplied code/HTML is executed.
 * Only registered deterministic templates may change meaning. Other semantic changes stay held.
 */
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import Rules from './RulesCore.js';
import {canonical,digest,renderRegister,validateRegister} from './RulesPublisher.mjs';
import {escapeHtml} from './PrivatePreview.mjs';
import {COL_RULE_PUBLIC_FILES} from './observe-hosted-col.mjs';
import {validateProducer,validateSealedWitness} from '../../col-rules-witness.mjs';

export const STATE_PATH='data/col-rules-release-state.json';
export const LITERAL_EXPLANATION='Literal spacing or apostrophe typography updated; words, numbers and qualifications preserved.';
export const MAX_LEDGER_BYTES=1024*1024;
export const MAX_PACKAGE_BYTES=1024*1024;
const serializedBytes=value=>Buffer.byteLength(JSON.stringify(value,null,2)+'\n');
export const MODES=Object.freeze({stage:'col-literal-candidate-v3',authorize:'col-hosted-activation-v3',confirm:'col-independent-confirmation-v3',seal:'col-retain-completion-witness-v3',cancel:'col-cancel-staged-v3'});
export const EMPTY_STATE=Object.freeze({schemaVersion:3,operations:[],events:[]});
export const bytesHash=value=>createHash('sha256').update(value).digest('hex');
const hex=v=>/^[a-f0-9]{64}$/.test(v||'');
const clone=v=>JSON.parse(JSON.stringify(v));
function exact(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join('|')!==[...keys].sort().join('|'))throw Error('Unexpected staged rule shape');}
function clock(value){if(!(value instanceof Date)||!Number.isFinite(value.getTime()))throw Error('Invalid release clock');return value.toISOString();}
function fresh(value,now,max=300000){Rules.stamp(value);if(Date.parse(value)>now.getTime()||now.getTime()-Date.parse(value)>max)throw Error('Stale or future independent evidence');}
export function validateState(state){
  exact(state,['schemaVersion','operations','events']);
  if(state.schemaVersion!==3||!Array.isArray(state.operations)||state.operations.length>5000||!Array.isArray(state.events)||state.events.length>20000||serializedBytes(state)>MAX_LEDGER_BYTES)throw Error('Invalid staged ledger size');
  const ids=new Set();
  for(const op of state.operations){
    exact(op,['candidateDigest','revisionId','previous','phase','stagedAt','activationDigest','confirmation']);
    if(!hex(op.candidateDigest)||ids.has(op.candidateDigest)||!/^col-[a-z0-9-]{6,60}$/.test(op.revisionId)||
      op.previous!==null&&!hex(op.previous)||!['candidate','activation_pending','release_pending','failed'].includes(op.phase))throw Error('Invalid staged operation');
    Rules.stamp(op.stagedAt);ids.add(op.candidateDigest);
    if(op.phase==='candidate'&&(op.activationDigest!==null||op.confirmation!==null)||['activation_pending','release_pending'].includes(op.phase)&&!hex(op.activationDigest))throw Error('Invalid activation phase');
    if(op.phase==='release_pending'||op.phase==='failed'&&op.confirmation!==null){
      exact(op.confirmation,['observedAt','sourceDigest','candidateDigest','activationDigest','baseStateDigest','snapshotDigest','producer','sealDigest']);
      validateProducer(op.confirmation.producer);
      Rules.stamp(op.confirmation.observedAt);
      if(op.confirmation.candidateDigest!==op.candidateDigest||op.confirmation.activationDigest!==op.activationDigest||!hex(op.confirmation.sourceDigest)||!hex(op.confirmation.baseStateDigest)||!hex(op.confirmation.snapshotDigest)||op.confirmation.sealDigest!==null&&!hex(op.confirmation.sealDigest))throw Error('Invalid confirmation');
    }else if(op.confirmation!==null)throw Error('Unconfirmed operation cannot be operative');
  }
  for(const event of state.events){
    exact(event,['revisionId','candidateDigest','phase','at','evidenceDigest','reason']);Rules.stamp(event.at);
    if(!/^col-[a-z0-9-]{6,60}$/.test(event.revisionId)||event.candidateDigest!==null&&!hex(event.candidateDigest)||!hex(event.evidenceDigest)||!['candidate','activation_pending','release_pending','sealed','failed'].includes(event.phase)||
      !['','expired','deployment_failed','withdrawn','source_changed'].includes(event.reason))throw Error('Invalid immutable phase event');
  }
  return state;
}
function eventFor(op,at,envelope,reason=''){return {revisionId:op.revisionId,candidateDigest:op.candidateDigest,phase:op.phase,at,evidenceDigest:digest(envelope),reason};}
export function currentOperation(state){validateState(state);return state.operations.filter(op=>op.phase==='release_pending').at(-1)||null;}
export function snapshot(files){
  exact(files,COL_RULE_PUBLIC_FILES);
  if(COL_RULE_PUBLIC_FILES.some(p=>typeof files[p]!=='string'||!files[p].length||Buffer.byteLength(files[p])>512*1024))throw Error('Bounded five-file snapshot required');
  const register=JSON.parse(files['data/col-rules-register.json']),versions=JSON.parse(files['data/col-rules-versions.json']);
  validateRegister(register);
  if(versions.schemaVersion!==1||!Array.isArray(versions.versions))throw Error('Invalid version snapshot');
  return {register,versions,markdown:files['docs/celebration-of-life-rules.md'],html:files['celebration.html']};
}
export function snapshotHashes(files){snapshot(files);return Object.fromEntries(COL_RULE_PUBLIC_FILES.map(p=>[p,bytesHash(files[p])]));}
function verifyEnvelope(envelope,kind,state,secret,now){
  clock(now);validateState(state);exact(envelope,['content','approval']);
  exact(envelope.approval,['mode','baseStateDigest','issuedAt','signature']);
  const {signature,...approval}=envelope.approval;
  if(typeof secret!=='string'||secret.length<32||approval.mode!==MODES[kind]||approval.baseStateDigest!==digest(state)||!hex(signature))throw Error('Staged authority or base mismatch');
  fresh(approval.issuedAt,now);
  const expected=createHmac('sha256',secret).update(JSON.stringify(canonical({content:envelope.content,approval}))).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))throw Error('Staged signature mismatch');
  return envelope.content;
}
export function validateSource(source,expected,implementationCommit,now){
  exact(source,['sourceDigest','observedAt','repoCommit','workflowRun']);
  exact(expected,['sourceDigest','observedAt','repoCommit','workflowRun']);
  // `expected` must come from the independently authenticated Viewer artifact,
  // never from the submitted bundle or a boolean/member statement.
  if(source.sourceDigest!==expected.sourceDigest||!hex(source.sourceDigest)||!/^\d{1,20}$/.test(source.workflowRun)||!/^\d{1,20}$/.test(expected.workflowRun)||
    expected.repoCommit!==implementationCommit||!/^[a-f0-9]{40}$/.test(source.repoCommit))throw Error('Independent source witness mismatch');
  Rules.stamp(source.observedAt);fresh(expected.observedAt,now);return expected;
}
function checkWording(revision,base){
  if(revision.state!=='awaiting_implementation'||revision.baseVersion!==base.id||revision.baseDigest!==base.digest||
    revision.publishedAt!==null||revision.correctionOf!==null||revision.explanation!==LITERAL_EXPLANATION||revision.changes.length!==1)throw Error('Only new literal wording candidates are implemented');
  const c=revision.changes[0];
  if(c.before!==base.provisions[c.provision]||c.after===c.before||Rules.typography(c.after)!==Rules.typography(c.before)||c.after.split('\n')[0]!==c.before.split('\n')[0])throw Error('Parameters, formulas, allocations and semantic edits require engineering');
  const clean=Rules.publicRecord(revision);if(digest({...clean,baseDigest:revision.baseDigest})!==digest(revision))throw Error('Private or extra candidate fields');
}
function checkOldest(revision,base){
  if(revision.state!=='awaiting_implementation'||revision.baseVersion!==base.id||revision.baseDigest!==base.digest||
    revision.publishedAt!==null||revision.effectiveAt!==null||revision.correctionOf!==null||
    revision.explanation!==Rules.OLDEST_DEATH_STEAL_EXPLANATION||
    revision.changes.length!==1)throw Error('Oldest-death amendment requires fresh prospective exact-base authority');
  const c=revision.changes[0],before=base.provisions['DRAFT - ORDER OF BUSINESS'];
  const marker='\n\n### THIRD - Devil’s Share';
  if(c.provision!=='DRAFT - ORDER OF BUSINESS'||c.before!==before||typeof before!=='string'||
    before.indexOf('### SECOND - Steals')<0||before.split(marker).length!==2||
    before.indexOf(Rules.OLDEST_DEATH_STEAL_CLAUSE)>=0||
    c.after!==before.replace(marker,'\n\n'+Rules.OLDEST_DEATH_STEAL_CLAUSE+marker))
    throw Error('Exact supported oldest-death calculation and wording required');
  const clean=Rules.publicRecord(revision);
  if(digest({...clean,baseDigest:revision.baseDigest})!==digest(revision))throw Error('Unexpected oldest-death candidate fields');
}
export function stageCandidate({state,files,envelope,secret,enabled=false,now=new Date(),implementationCommit,behaviorDigest,sourceWitness,basePublishedAt=null}){
  if(enabled!==true)throw Error('Staged rules disabled');
  const content=verifyEnvelope(envelope,'stage',state,secret,now);
  exact(content,['revision','qualification','baseFiles','implementationCommit','behaviorDigest','source']);
  if(state.operations.length>=5000||state.events.length>=19996||serializedBytes(state)>MAX_LEDGER_BYTES-16384)throw Error('Release ledger capacity reached; preserve current version');
  if(state.operations.some(op=>!['release_pending','failed'].includes(op.phase)))throw Error('Reconcile the single pending operation first');
  if(!['literal-typography-v1','oldest-death-steal-v1'].includes(content.qualification)||content.implementationCommit!==implementationCommit||content.behaviorDigest!==behaviorDigest||!hex(behaviorDigest)||digest(content.baseFiles)!==digest(snapshotHashes(files)))throw Error('Candidate implementation or exact base mismatch');
  if(content.source!==null)throw Error('Candidate source comes only from the independent Viewer observation');
  validateSource(sourceWitness,sourceWitness,implementationCommit,now);
  const projected=currentOperation(state)?materializeFiles(files,currentOperation(state),basePublishedAt):files;
  const {register,versions,markdown,html}=snapshot(projected),base=Rules.select(versions.versions,clock(now));
  if(currentOperation(state)&&currentOperation(state).revisionId!==base.id)throw Error('Current snapshot differs from operative release');
  if(content.qualification==='literal-typography-v1')checkWording(content.revision,base);
  else checkOldest(content.revision,base);
  if(digest(Rules.provisions(markdown))!==digest(base.provisions)||register.revisions.some(r=>r.id===content.revision.id)||state.events.some(op=>op.revisionId===content.revision.id)||state.operations.some(op=>op.revisionId===content.revision.id))throw Error('Stale narrative or replayed revision');
  const c=content.revision.changes[0],provisions={...base.provisions,[c.provision]:c.after};
  if(markdown.split(c.before).length!==2)throw Error('Exact narrative boundary required');
  const begin=html.indexOf('<details class="rule-topic">'),end=html.indexOf('      <p class="rules-reference">',begin);
  if(begin<0||end<begin)throw Error('Official website boundary changed');
  const topics=Object.entries(provisions).map(([heading,text])=>'<details class="rule-topic"><summary>'+escapeHtml(heading)+'<span aria-hidden="true">+</span></summary><div class="rule-body"><p style="white-space:pre-wrap">'+escapeHtml(text.slice(text.indexOf('\n')+1).trim())+'</p></div></details>').join('\n');
  const record=Rules.publicRecord(content.revision),nextRegister={...register,revisions:[...register.revisions,record]};
  const version={id:record.id,previous:base.id,provisions,effectiveAt:null,publishedAt:null,verified:false,parameters:clone(base.parameters),januaryGap:base.januaryGap,protocol:3,digest:digest({id:record.id,previous:base.id,provisions})};
  const nextFiles={
    'data/col-rules-register.json':JSON.stringify(nextRegister,null,2)+'\n',
    'data/col-rules-versions.json':JSON.stringify({...versions,versions:[...versions.versions,version]},null,2)+'\n',
    'docs/celebration-of-life-rules.md':markdown.replace(c.before,c.after),
    'celebration.html':html.slice(0,begin)+topics+'\n'+html.slice(end),
    'col-revisions.html':renderRegister(nextRegister)+'\n'
  };
  const candidate={schemaVersion:3,kind:'non-operative-col-candidate',revisionId:record.id,baseVersion:base.id,baseDigest:base.digest,
    previous:currentOperation(state)?.candidateDigest||null,requestedEffectiveAt:record.effectiveAt,stagedAt:clock(now),
    implementationCommit,behaviorDigest,source:clone(sourceWitness),baseFiles:content.baseFiles,files:nextFiles,hashes:snapshotHashes(nextFiles)};
  if(serializedBytes(candidate)>MAX_PACKAGE_BYTES)throw Error('Complete candidate package exceeds readable byte bound');
  const candidateDigest=digest(candidate),operation={candidateDigest,revisionId:record.id,previous:candidate.previous,phase:'candidate',stagedAt:candidate.stagedAt,activationDigest:null,confirmation:null};
  const nextState={...state,operations:[...state.operations,operation],events:[...state.events,eventFor(operation,clock(now),envelope)]};validateState(nextState);
  return {state:nextState,candidate,candidateDigest};
}
export function validateCandidate(candidate,hash){
  exact(candidate,['schemaVersion','kind','revisionId','baseVersion','baseDigest','previous','requestedEffectiveAt','stagedAt','implementationCommit','behaviorDigest','source','baseFiles','files','hashes']);
  if(candidate.schemaVersion!==3||candidate.kind!=='non-operative-col-candidate'||digest(candidate)!==hash||digest(snapshotHashes(candidate.files))!==digest(candidate.hashes))throw Error('Candidate byte discrepancy');
  const {versions,register}=snapshot(candidate.files),version=versions.versions.at(-1),record=register.revisions.at(-1);
  if(version.id!==candidate.revisionId||version.verified!==false||version.effectiveAt!==null||version.publishedAt!==null||record.id!==candidate.revisionId||record.state!=='awaiting_implementation'||record.publishedAt!==null)throw Error('Candidate must be non-operative');
  return candidate;
}
function selectedCandidate(state,candidate,candidateDigest,phase){
  validateState(state);validateCandidate(candidate,candidateDigest);
  const op=state.operations.at(-1);
  if(!op||op.candidateDigest!==candidateDigest||op.phase!==phase||op.previous!==candidate.previous||candidate.previous!==(currentOperation(state)?.candidateDigest||null))throw Error('Competing or stale activation');
  return op;
}
export function authorizeActivation({state,candidate,envelope,secret,enabled=false,now=new Date(),implementationCommit,behaviorDigest,sourceWitness,acceptanceUntil=null}){
  if(enabled!==true)throw Error('Staged activation disabled');
  const content=verifyEnvelope(envelope,'authorize',state,secret,now);
  exact(content,['candidateDigest','observation','source','baseFiles']);
  const op=selectedCandidate(state,candidate,content.candidateDigest,'candidate');
  exact(content.observation,['candidateDigest','observedAt']);fresh(content.observation.observedAt,now);
  if(content.observation.candidateDigest!==op.candidateDigest||Date.parse(content.observation.observedAt)<Date.parse(candidate.stagedAt)||
    candidate.implementationCommit!==implementationCommit||candidate.behaviorDigest!==behaviorDigest||digest(content.baseFiles)!==digest(candidate.baseFiles))throw Error('Candidate hosted proof or current implementation mismatch');
  validateSource(content.source,sourceWitness,sourceWitness.repoCommit,now);
  if(content.source.sourceDigest!==candidate.source.sourceDigest)throw Error('Source changed after staging');
  if(candidate.requestedEffectiveAt&&Date.parse(candidate.requestedEffectiveAt)>now.getTime())throw Error('Scheduled candidate awaits due-time current-base qualification');
  // An explicit missed date is never silently backdated or changed. A new,
  // authenticated member clarification is needed; no scheduled replay.
  if(candidate.requestedEffectiveAt&&Date.parse(candidate.requestedEffectiveAt)<now.getTime()-60000)throw Error('Explicit effective time missed; clarification required');
  if(acceptanceUntil!==null){Rules.stamp(acceptanceUntil);if(Date.parse(acceptanceUntil)<=now.getTime())throw Error('Acceptance deadline expired');}
  const expiresAt=Math.min(now.getTime()+2700000,acceptanceUntil===null?Infinity:Date.parse(acceptanceUntil));
  const activation={schemaVersion:3,kind:'col-activation-awaiting-independent-readback',candidateDigest:op.candidateDigest,
    previous:op.previous,baseStateDigest:digest(state),candidateObservedAt:content.observation.observedAt,authorizedAt:clock(now),
    expiresAt:new Date(expiresAt).toISOString(),source:clone(sourceWitness),effectiveAt:null,publishedAt:null};
  const activationDigest=digest(activation);
  const next={...op,phase:'activation_pending',activationDigest};
  const nextState={...state,operations:[...state.operations.slice(0,-1),next],events:[...state.events,eventFor(next,clock(now),envelope)]};validateState(nextState);
  return {state:nextState,activation,activationDigest};
}
export function confirmActivation({state,candidate,activation,envelope,secret,enabled=false,now=new Date(),implementationCommit,behaviorDigest,sourceWitness,producer}){
  if(enabled!==true)throw Error('Staged confirmation disabled');
  const content=verifyEnvelope(envelope,'confirm',state,secret,now);
  exact(content,['candidateDigest','activationDigest','observedAt','source','baseFiles']);
  const op=selectedCandidate(state,candidate,content.candidateDigest,'activation_pending');
  if(digest(activation)!==op.activationDigest||content.activationDigest!==op.activationDigest||activation.candidateDigest!==op.candidateDigest||
    activation.effectiveAt!==null||activation.publishedAt!==null||activation.kind!=='col-activation-awaiting-independent-readback')throw Error('Activation readback discrepancy');
  fresh(content.observedAt,now);
  if(Date.parse(content.observedAt)<Date.parse(activation.authorizedAt)||now.getTime()>Date.parse(activation.expiresAt))throw Error('Delayed activation expired; retain previous version');
  if(candidate.requestedEffectiveAt&&Date.parse(content.observedAt)>Date.parse(candidate.requestedEffectiveAt))throw Error('Missed explicit effective time; never backdate');
  if(candidate.implementationCommit!==implementationCommit||candidate.behaviorDigest!==behaviorDigest||digest(content.baseFiles)!==digest(candidate.baseFiles))throw Error('Current base or implementation changed');
  validateSource(content.source,sourceWitness,sourceWitness.repoCommit,now);
  validateProducer(producer);
  if(producer.checkoutHead!==sourceWitness.repoCommit||producer.runId!==sourceWitness.workflowRun)throw Error('Release producer differs from observed checkout or Viewer run');
  if(content.source.sourceDigest!==candidate.source.sourceDigest)throw Error('Source readback discrepancy');
  const confirmation={observedAt:content.observedAt,sourceDigest:content.source.sourceDigest,candidateDigest:op.candidateDigest,activationDigest:op.activationDigest,baseStateDigest:digest(state),producer:clone(producer),sealDigest:null};
  const confirmed={...op,phase:'release_pending',confirmation},files=clone(candidate.files);
  const confirmedSnapshot={schemaVersion:3,kind:'col-ready-snapshot-awaiting-job-witness',candidateDigest:op.candidateDigest,activationDigest:op.activationDigest,observedAt:content.observedAt,producer:clone(producer),files,hashes:snapshotHashes(files)};
  if(serializedBytes(confirmedSnapshot)>MAX_PACKAGE_BYTES)throw Error('Complete ready package exceeds readable byte bound');
  confirmation.snapshotDigest=digest(confirmedSnapshot);
  const next={...state,operations:[...state.operations.slice(0,-1),confirmed],events:[...state.events,eventFor(confirmed,clock(now),envelope)]};validateState(next);return {state:next,confirmedSnapshot};
}
export function sealCompletion({state,envelope,secret,enabled=false,now=new Date(),independentWitness,activation}){
  if(enabled!==true)throw Error('Completion retention disabled');
  const content=verifyEnvelope(envelope,'seal',state,secret,now);
  exact(content,['candidateDigest','snapshotDigest','producer','completedAt']);
  const op=state.operations.find(o=>o.candidateDigest===content.candidateDigest);
  if(!op||op.phase!=='release_pending'||op.confirmation.sealDigest!==null||content.snapshotDigest!==op.confirmation.snapshotDigest||digest(content.producer)!==digest(op.confirmation.producer))throw Error('Completion retention identity or replay mismatch');
  if(!independentWitness||independentWitness.successful!==true||independentWitness.completedAt!==content.completedAt||
    digest(activation)!==op.activationDigest||Date.parse(content.completedAt)>Date.parse(activation.expiresAt))throw Error('Independent completed job proof required');
  const receipt={schemaVersion:3,kind:'col-completion-witness-v1',candidateDigest:op.candidateDigest,activationDigest:op.activationDigest,
    snapshotDigest:op.confirmation.snapshotDigest,producer:clone(op.confirmation.producer),publishedAt:content.completedAt,verifiedAt:clock(now)};
  validateSealedWitness(receipt,op,{now:now.getTime()});
  const nextOp={...op,confirmation:{...op.confirmation,sealDigest:digest(receipt)}};
  const next={...state,operations:state.operations.map(o=>o===op?nextOp:o),events:[...state.events,{...eventFor(nextOp,clock(now),envelope),phase:'sealed'}]};
  validateState(next);return {state:next,receipt};
}
export function cancelStaged({state,envelope,secret,enabled=false,now=new Date(),failedFinalWitness=false}){
  if(enabled!==true)throw Error('Staged cancellation disabled');
  const content=verifyEnvelope(envelope,'cancel',state,secret,now);exact(content,['revisionId','candidateDigest','reason','stageEvidenceDigest']);
  if(!/^col-[a-z0-9-]{6,60}$/.test(content.revisionId)||!hex(content.stageEvidenceDigest)||!['expired','deployment_failed','withdrawn','source_changed'].includes(content.reason))throw Error('Bounded cancellation evidence required');
  const op=state.operations.find(o=>o.revisionId===content.revisionId);
  if(state.events.some(e=>e.revisionId===content.revisionId&&e.phase==='failed')||op&&(op.confirmation?.sealDigest||op.phase==='release_pending'&&!failedFinalWitness||op.candidateDigest!==content.candidateDigest)||!op&&content.candidateDigest!==null)throw Error('Cannot cancel an operative, unrelated or already cancelled revision');
  if(op&&state.events.find(e=>e.revisionId===op.revisionId&&e.phase==='candidate')?.evidenceDigest!==content.stageEvidenceDigest)throw Error('Cancellation must bind the original staging authority');
  const failed={revisionId:content.revisionId,candidateDigest:content.candidateDigest,phase:'failed'};
  const next={...state,operations:state.operations.map(o=>o===op?{...o,phase:'failed'}:o),events:[...state.events,eventFor(failed,clock(now),envelope,content.reason)]};
  validateState(next);return {state:next};
}
export function materializeConfirmed(candidate,operation,publicationAt){
  validateCandidate(candidate,operation.candidateDigest);
  return materializeFiles(candidate.files,operation,publicationAt);
}
export function materializeFiles(files,operation,publicationAt){
  if(operation.phase!=='release_pending'||operation.confirmation?.candidateDigest!==operation.candidateDigest||!publicationAt)throw Error('No independently confirmed activation clock');
  const at=Rules.stamp(publicationAt),{register,versions}=snapshot(files),record=register.revisions.at(-1);
  if(Date.parse(at)<Date.parse(operation.confirmation.observedAt)||record.id!==operation.revisionId)throw Error('Publication clock precedes independent observation');
  const version={...versions.versions.at(-1),verified:true,publishedAt:at,effectiveAt:at,confirmedAt:at};
  const nextRegister={...register,revisions:[...register.revisions.slice(0,-1),{...record,publishedAt:at,effectiveAt:at,state:'active'}]};
  return {...files,'data/col-rules-register.json':JSON.stringify(nextRegister,null,2)+'\n','data/col-rules-versions.json':JSON.stringify({...versions,versions:[...versions.versions.slice(0,-1),version]},null,2)+'\n','col-revisions.html':renderRegister(nextRegister)+'\n'};
}
