import { siteHeader, siteFooter } from './EditorialDisplay.mjs';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import Rules from './RulesCore.js';
import {escapeHtml as esc} from './PrivatePreview.mjs';

export const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const digest=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
export const RULES_MODE='verified-member-col-revision-v2';
export const RULE_STATUS_MODE='verified-member-col-status-v2';
const names={fish:'Justin',marc:'Marc',matt:'Matt',ken:'Ken',jamie:'Jamie',jerome:'Jerome'};
const statuses=['awaiting_clarification','awaiting_implementation','scheduled','active','failed','superseded'];
function exact(v,keys){if(!v||Object.keys(v).sort().join(',')!==keys.slice().sort().join(','))throw Error('Unexpected public revision shape');}
function safe(v){if(typeof v!=='string'||/[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|<[^>]+>|\b(?:password|passcode|api key|home address)\b/i.test(v))throw Error('Private material cannot enter register');}
export function validateRegister(register){
  exact(register,['schemaVersion','baseline','revisions','events']);
  if(register.schemaVersion!==1||!Array.isArray(register.revisions)||!Array.isArray(register.events)||register.revisions.length>5000||register.events.length>20000)throw Error('Invalid revision register');
  exact(register.baseline,['id','recordedAt','description']);Rules.stamp(register.baseline.recordedAt);safe(register.baseline.description);
  const seen=new Set();
  for(const r of register.revisions){
    const valid=Rules.publicRecord(r);if(JSON.stringify(canonical(valid))!==JSON.stringify(canonical(r))||seen.has(r.id))throw Error('Invalid or duplicate revision');seen.add(r.id);
    safe(r.explanation);for(const c of r.changes){safe(c.before);safe(c.after);safe(c.provision);}
    if(r.correctionOf&&!seen.has(r.correctionOf))throw Error('Correction must link an existing record');
  }
  const eventIds=new Set();
  for(const e of register.events){exact(e,['id','revisionId','at','state','reason','relatedRevision']);
    if(!seen.has(e.revisionId)||statuses.indexOf(e.state)<0||typeof e.id!=='string'||e.id.length>100||eventIds.has(e.id))throw Error('Invalid status event');
    eventIds.add(e.id);Rules.stamp(e.at);safe(e.reason);if(e.relatedRevision!==null&&!seen.has(e.relatedRevision))throw Error('Unknown linked revision');
  }
  return register;
}
export function applyRuleRelease({current,release,approval,secret,enabled,now=new Date()}){
  validateRegister(current);
  if(enabled!==true||typeof secret!=='string'||secret.length<32)throw Error('Rules release remains disabled');
  exact(approval,['mode','baseDigest','contentSha256','issuedAt','signature']);
  if(approval.mode!==RULES_MODE||approval.baseDigest!==digest(current)||approval.contentSha256!==digest(release)||
    !/^[a-f0-9]{64}$/.test(approval.signature)||now.getTime()-Date.parse(Rules.stamp(approval.issuedAt))>86400000||Date.parse(approval.issuedAt)>now.getTime()+60000)throw Error('Stale or altered release');
  const {signature,...proof}=approval;
  if(!timingSafeEqual(createHmac('sha256',secret).update(JSON.stringify(canonical({release,approval:proof}))).digest(),Buffer.from(signature,'hex')))throw Error('Invalid rule signature');
  validateRegister(release);
  if(JSON.stringify(current.baseline)!==JSON.stringify(release.baseline)||release.revisions.length<current.revisions.length||release.events.length<current.events.length||
    current.revisions.some((r,i)=>digest(r)!==digest(release.revisions[i]))||current.events.some((e,i)=>digest(e)!==digest(release.events[i])))throw Error('Revision history is append-only');
  if(digest(current)===digest(release))throw Error('Duplicate release');return release;
}
export function applyRuleStatus({current,record,approval,secret,enabled,now=new Date()}){
  validateRegister(current);
  if(enabled!==true||typeof secret!=='string'||secret.length<32)throw Error('Rule status release disabled');
  exact(approval,['mode','baseDigest','contentSha256','issuedAt','signature']);
  if(approval.mode!==RULE_STATUS_MODE||approval.baseDigest!==digest(current)||approval.contentSha256!==digest(record)||
    !/^[a-f0-9]{64}$/.test(approval.signature||'')||Date.parse(approval.issuedAt)>now.getTime()+60000||now.getTime()-Date.parse(Rules.stamp(approval.issuedAt))>86400000)throw Error('Stale status release');
  const {signature,...proof}=approval;
  if(!timingSafeEqual(createHmac('sha256',secret).update(JSON.stringify(canonical({record,approval:proof}))).digest(),Buffer.from(signature,'hex')))throw Error('Invalid status authority');
  if(!['awaiting_clarification','awaiting_implementation'].includes(record.state)||record.publishedAt!==null||current.revisions.some(r=>r.id===record.id))throw Error('Status cannot activate, invent publication time, overwrite or replay rules');
  const next={...current,revisions:[...current.revisions,record]};validateRegister(next);return next;
}
export function renderRegister(register){
  validateRegister(register);
  const date=t=>t?'<time datetime="'+esc(t)+'">'+esc(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',dateStyle:'long',timeStyle:'short'}).format(new Date(t)))+' (Toronto)</time>':'Not yet established';
  const rows=[...register.revisions].reverse().map(r=>{
    const events=register.events.filter(e=>e.revisionId===r.id),state=events.at(-1)?.state||r.state;
    return '<article id="'+r.id+'"><h2><a href="#'+r.id+'">Amendment</a></h2><p><img src="assets/members/annals/'+r.member+'-annals.webp" width="64" height="64" alt="Approved illustration of '+names[r.member]+'"> Submitted by '+names[r.member]+'</p><p data-rule-status>'+esc(state==='active'?'In effect':state==='scheduled'?'Scheduled':state==='superseded'?'Superseded':'Not yet in effect')+'</p><dl><dt>Submitted</dt><dd>'+date(r.submittedAt)+'</dd><dt>Published</dt><dd>'+date(r.publishedAt)+'</dd><dt>Effective</dt><dd>'+date(r.effectiveAt||events.find(e=>e.state==='active')?.at)+'</dd></dl><p>'+esc(r.explanation)+'</p><p><a href="col-rules-version.html?version='+r.baseVersion+'">Rules before this amendment</a>'+' · <a href="col-rules-version.html?version='+r.id+'">Rules after this amendment</a>'+(r.correctionOf?' · Corrects or reverses <a href="#'+r.correctionOf+'">'+r.correctionOf+'</a>':'')+'</p>'+register.revisions.filter(x=>x.correctionOf===r.id).map(x=>'<p>Correction or reversal: <a href="#'+x.id+'">'+x.id+'</a></p>').join('')+r.changes.map(c=>'<details><summary>'+esc(c.provision)+' — what changed</summary><h3>Before</h3><pre>'+esc(c.before)+'</pre><h3>After</h3><pre>'+esc(c.after)+'</pre></details>').join('')+events.map(e=>'<p>'+date(e.at)+' · '+esc(e.state==='active'?'In effect':e.state==='scheduled'?'Scheduled':e.state==='superseded'?'Superseded':'Recorded')+(e.relatedRevision?' · <a href="#'+e.relatedRevision+'">Related revision</a>':'')+'</p>').join('')+'</article>';
  }).join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CoL Rules Revision Register | Stammtisch</title><script type="module" src="col-rules-register.mjs?v=col-release-20261017"></script><link rel="stylesheet" href="styles.css"><style>main{padding-block:45px}h1{font-size:clamp(36px,7vw,64px)}article{padding-block:25px;border-top:1px solid #846329}article img{vertical-align:middle}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eae5d8;padding:16px}summary{min-height:44px;cursor:pointer}dd{margin-bottom:12px}article:target{outline:2px solid #846329;outline-offset:8px}</style></head><body><a class="skip-link" href="#main">Skip to content</a>'+siteHeader('col-sub')+'<main id="main" class="shell"><a class="back-link" href="celebration.html#official-rules">← Current Celebration of Life rules</a><p class="eyebrow">Celebration of Life</p><h1>Rules Revision <em>Register.</em></h1><p>Any member may propose an amendment by email. Changes that take effect are recorded here with their dates and previous wording. Historical results remain unchanged unless the club expressly agrees otherwise.</p>'+(rows||'<p>No new amendments have been entered in the Register.</p>')+'<section id="'+esc(register.baseline.id)+'"><h2>Rules as first recorded here</h2><p>'+date(register.baseline.recordedAt)+'</p><p>These were the club’s existing rules when the Register began. This entry does not represent a new amendment.</p><a href="col-rules-version.html?version='+esc(register.baseline.id)+'&amp;reference=1">Read the rules</a></section>'+'</main>'+siteFooter('col-sub')+'</body></html>';
}
