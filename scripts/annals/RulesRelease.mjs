/* Bounded coordinated release. Input is a signed, sanitised engineering bundle,
 * never a raw email or instructions for a runner. Does not execute supplied code.
 * Calculation changes must already exist in a reviewed implementation commit. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import Rules from './RulesCore.js';
import {digest,canonical,renderRegister,validateRegister,applyRuleStatus} from './RulesPublisher.mjs';
import {escapeHtml as esc} from './PrivatePreview.mjs';

export const RELEASE_MODE='coordinated-col-implementation-v2';
// The prospective reducer and the Club's GitHub-first correction precedence
// must be bound to the same signed implementation digest as existing CoL logic.
// This alone does not qualify or activate numerical changes.
export const BEHAVIOR_FILES=['col-prospective.mjs','col-club-state.mjs','celebration-rules.mjs','celebration-awards.mjs','col-award-policy.mjs','celebration.mjs','scripts/import-celebration.py','scripts/monitor-celebration-sheet.py','scripts/annals/RulesCore.js','scripts/annals/RulesStaged.mjs','scripts/annals/run-staged-col.mjs','scripts/annals/RulesProduction.gs','scripts/annals/Production.gs','scripts/annals/RulesPublisher.mjs','col-rules-reader.mjs','col-rules-version.mjs','col-rules-register.mjs','scripts/annals/RulesRelease.mjs','scripts/observe-col-source.py','.github/workflows/annals-col-rules-v3.yml','col-rules-witness.mjs','scripts/annals/verify-staged-col-hosted.mjs'];
export async function behaviorDigest(){return digest(await Promise.all(BEHAVIOR_FILES.map(async name=>({name,text:(await readFile(name,'utf8')).replace(/\r\n/g,'\n')}))));}
function exact(v,keys){if(!v||Object.keys(v).sort().join(',')!==keys.slice().sort().join(','))throw Error('Unexpected release shape');}
function topics(provisions){
  return Object.entries(provisions).map(([heading,text])=>{
    const body=text.slice(text.indexOf('\n')+1).trim();
    // Exact words and paragraph structure, including table/source text, remain
    // readable. Source markdown is escaped, never interpreted as HTML or code.
    return '<details class="rule-topic"><summary>'+esc(heading)+'<span aria-hidden="true">+</span></summary><div class="rule-body">'+body.split(/\n\s*\n/).map(p=>'<p style="white-space:pre-wrap">'+esc(p)+'</p>').join('')+'</div></details>';
  }).join('\n');
}
export function coordinate({register,versions,markdown,html,bundle,secret,enabled,now,implementationCommit,behavior,sourceDigest}){
  if(enabled!==true||typeof secret!=='string'||secret.length<32)throw Error('Coordinated rule release disabled');
  exact(bundle,['revision','evidence','behaviorDigest','sourceDigest','approval']);
  exact(bundle.approval,['mode','baseRegisterDigest','baseVersionsDigest','issuedAt','signature']);
  const {signature,...approval}=bundle.approval,{approval:ignored,...content}=bundle;
  if(approval.mode!==RELEASE_MODE||approval.baseRegisterDigest!==digest(register)||approval.baseVersionsDigest!==digest(versions)||
    !/^[a-f0-9]{64}$/.test(signature||'')||Date.parse(approval.issuedAt)>now.getTime()+60000||now.getTime()-Date.parse(Rules.stamp(approval.issuedAt))>86400000||
    !timingSafeEqual(createHmac('sha256',secret).update(JSON.stringify(canonical({content,approval}))).digest(),Buffer.from(signature,'hex')))throw Error('Invalid or stale coordinated authority');
  validateRegister(register);
  const base=Rules.select(versions.versions,now.toISOString());
  if(bundle.behaviorDigest!==behavior||bundle.evidence.implementationCommit!==implementationCommit||
    (bundle.evidence.sourceRequired&&(bundle.sourceDigest!==sourceDigest||bundle.evidence.sourceDigest!==sourceDigest)))throw Error('Installed implementation or authoritative source mismatch');
  if(digest(Rules.provisions(markdown))!==digest(base.provisions))throw Error('Official narrative differs from operative structured rules');
  const existing=register.revisions.find(r=>r.id===bundle.revision.id);
  const recordedState=existing&&(register.events.filter(e=>e.revisionId===existing.id).at(-1)?.state||existing.state);
  const pending=existing&&['awaiting_implementation','awaiting_clarification'].includes(recordedState)&&!register.events.some(e=>e.revisionId===existing.id&&e.state==='active');
  const scheduled=existing&&recordedState==='scheduled'&&!register.events.some(e=>e.revisionId===existing.id&&e.state==='active');
  if(existing&&!scheduled&&!pending)throw Error('Revision already reserved or published');
  if(scheduled&&(Date.parse(existing.effectiveAt)>now.getTime()||digest(existing.changes)!==digest(Rules.publicRecord(bundle.revision).changes)||existing.baseVersion!==base.id))throw Error('Scheduled revision needs base/meaning requalification');
  if(pending&&(digest(existing.changes)!==digest(Rules.publicRecord(bundle.revision).changes)||existing.member!==bundle.revision.member||existing.baseVersion!==base.id))throw Error('Pending revision meaning/base changed');
  const qualified=Rules.qualify(bundle.revision,base,bundle.evidence);
  if(scheduled){qualified.revision.state='scheduled';qualified.revision.publishedAt=existing.publishedAt;qualified.revision.effectiveAt=existing.effectiveAt;}
  const result=Rules.publish(qualified,base,approval.issuedAt,base.id);
  const publicRevision=Rules.publicRecord(result.revision);
  const nextRegister={...register,revisions:existing?register.revisions:[...register.revisions,publicRevision],events:existing?[...register.events,{id:existing.id+(result.revision.state==='scheduled'?'-scheduled':'-activation'),revisionId:existing.id,at:approval.issuedAt,state:result.revision.state,reason:'Change qualified against the current base, implementation and source.',relatedRevision:null}]:[...register.events]},nextVersions={...versions,versions:[...versions.versions,
    {...result.version,digest:digest(result.version),verified:result.revision.state==='active',behaviorDigest:behavior,parameters:base.parameters,januaryGap:base.januaryGap}]};
  if(publicRevision.correctionOf&&result.revision.state==='active'){
    const previous=register.revisions.find(r=>r.id===publicRevision.correctionOf);
    if(!previous)throw Error('Correction must reference an existing revision');
    if(previous.changes.every(c=>publicRevision.changes.some(n=>n.provision===c.provision)))nextRegister.events.push({id:publicRevision.id+'-supersedes',revisionId:previous.id,at:approval.issuedAt,state:'superseded',reason:'A linked correction or reversal replaced the affected provisions.',relatedRevision:publicRevision.id});
  }
  validateRegister(nextRegister);
  if(result.revision.state==='scheduled')return {register:nextRegister,versions:nextVersions,markdown,html,registerHtml:renderRegister(nextRegister)};
  let nextMarkdown=markdown.replace(/\r\n/g,'\n');
  for(const change of bundle.revision.changes){if(nextMarkdown.split(change.before).length!==2)throw Error('Exact official provision not unique');nextMarkdown=nextMarkdown.replace(change.before,change.after);}
  const start=html.indexOf('<details class="rule-topic">'),end=html.indexOf('      <p class="rules-reference">',start);
  if(start<0||end<start)throw Error('Official website narrative boundary changed');
  const nextHtml=html.slice(0,start)+topics(result.version.provisions)+'\n'+html.slice(end);
  return {register:nextRegister,versions:nextVersions,markdown:nextMarkdown,html:nextHtml,registerHtml:renderRegister(nextRegister)};
}
/** Temporary fail-closed runtime boundary.
 * Engineering attestations and a successful GitHub commit do not establish
 * a verified *hosted* activation clock or retention of the previous live
 * version on deployment failure. The existing pure coordinator remains
 * testable, but no live release may alter operative rules until a separately
 * qualified two-phase publication protocol replaces this boundary.
 * Scheduled, non-operative records can still be prepared under the existing
 * disabled-by-default owner/security gates.
 */
export function requireNonActivatingRuleRelease(after,before,now=new Date()){
  const deny=()=>{throw Error('CoL activation blocked pending verified hosted publication clock and failure-safe prior-version retention');};
  const equal=(a,b)=>digest(a)===digest(b);
  const prefix=(oldList,newList)=>Array.isArray(oldList)&&Array.isArray(newList)&&
    oldList.length<=newList.length&&oldList.every((item,i)=>equal(item,newList[i]));
  if(!(now instanceof Date)||!Number.isFinite(now.getTime())||
    !after||!before||!after.register||!before.register||!after.versions||!before.versions||
    !Array.isArray(before.versions.versions)||!Array.isArray(after.versions.versions)||
    !Array.isArray(before.register.revisions)||!Array.isArray(after.register.revisions)||
    !Array.isArray(before.register.events)||!Array.isArray(after.register.events)||
    typeof before.markdown!=='string'||typeof before.html!=='string'||
    after.markdown!==before.markdown||after.html!==before.html||
    after.register.schemaVersion!==before.register.schemaVersion||
    after.versions.schemaVersion!==before.versions.schemaVersion||
    !equal(after.register.baseline,before.register.baseline)||
    !prefix(before.register.revisions,after.register.revisions)||
    !prefix(before.register.events,after.register.events)||
    !prefix(before.versions.versions,after.versions.versions)||
    after.register.revisions.length>before.register.revisions.length+1||
    after.register.events.length>before.register.events.length+1||
    after.versions.versions.length!==before.versions.versions.length+1)deny();

  const candidate=after.versions.versions.at(-1);
  let base;
  try{
    Rules.stamp(candidate?.effectiveAt);
    Rules.stamp(candidate?.publishedAt);
    base=Rules.select(before.versions.versions,now.toISOString());
  }catch{deny();}
  // A proposed future version must never become operative by an ordinary
  // dispatch, retroactively or by modifying any previous verified record.
  if(candidate.verified!==false||candidate.previous!==base.id||
    Date.parse(candidate.effectiveAt)<=now.getTime()||
    Date.parse(candidate.publishedAt)>now.getTime()+60000||
    !equal(candidate.parameters,base.parameters)||
    candidate.januaryGap!==base.januaryGap)deny();

  const matches=after.register.revisions.filter(r=>r.id===candidate.id);
  const newEvents=after.register.events.slice(before.register.events.length);
  if(matches.length!==1||newEvents.some(e=>e.revisionId!==candidate.id||e.state!=='scheduled')||
    (matches[0].state!=='scheduled'&&!newEvents.some(e=>e.state==='scheduled'))||
    (after.register.revisions.length===before.register.revisions.length+1&&
      matches[0]!==after.register.revisions.at(-1)))deny();
  return after;
}

async function main(){
  if(process.env.ANNALS_RULES_V2_RELEASE_ENABLED!=='true'||process.env.ANNALS_SIGNING_REMEDIATION_VERIFIED!=='true')throw Error('Final hosted authority is unverified');
  const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
  if(event.action==='annals-col-rule-release')throw Error('Legacy implementation dispatch retired; staged hosted activation is required');
  if(event.action==='annals-col-rule-status'){
    if(Object.keys(event.client_payload||{}).sort().join(',')!=='approval,record')throw Error('Bounded status payload required');
    const current=JSON.parse(await readFile('data/col-rules-register.json','utf8'));
    const next=applyRuleStatus({current,...event.client_payload,secret:process.env.ANNALS_PUBLISH_SIGNING_KEY,enabled:true});
    await writeFile('data/col-rules-register.json',JSON.stringify(next,null,2)+'\n');await writeFile('col-revisions.html',renderRegister(next)+'\n');return;
  }
  if(event.action!=='annals-col-rule-release'||Object.keys(event.client_payload||{}).join(',')!=='bundle')throw Error('Not a constrained rule release');
  const register=JSON.parse(await readFile('data/col-rules-register.json','utf8')),versions=JSON.parse(await readFile('data/col-rules-versions.json','utf8'));
  const markdown=await readFile('docs/celebration-of-life-rules.md','utf8');
  const html=await readFile('celebration.html','utf8');
  const before={register,versions,markdown,html};
  const result=coordinate({register,versions,markdown,html,
    bundle:event.client_payload.bundle,secret:process.env.ANNALS_PUBLISH_SIGNING_KEY,enabled:true,now:new Date(),
    implementationCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),behavior:await behaviorDigest(),
    // Source proof is independently verified by the bounded implementation PR.
    // Existing read-only monitor credentials are never expanded or used to write.
    sourceDigest:process.env.COL_VERIFIED_SOURCE_DIGEST||''});
  // A signed engineering bundle is necessary but insufficient for activation.
  // Refuse to write any operative rule or active event before a verified clock.
  requireNonActivatingRuleRelease(result,before);
  await writeFile('data/col-rules-register.json',JSON.stringify(result.register,null,2)+'\n');
  await writeFile('data/col-rules-versions.json',JSON.stringify(result.versions,null,2)+'\n');
  await writeFile('col-revisions.html',result.registerHtml+'\n');
  await writeFile('docs/celebration-of-life-rules.md',result.markdown);
  await writeFile('celebration.html',result.html);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Coordinated CoL release held; prior operative version retained.');process.exitCode=1;});
