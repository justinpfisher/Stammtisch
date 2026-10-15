import { createHash,createHmac,timingSafeEqual } from 'node:crypto';
import { readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from './PrivatePreview.mjs';
import { editorialHtml,REDACTION_CSS,EDITORIAL_NOTICE,displayDate } from './EditorialDisplay.mjs';

export const HISTORY_MODE='source-grounded-history-revision-v1';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export const historyDigest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export const emptyHistory=()=>({schemaVersion:1,revision:0,chapters:[],updatedAt:''});
export function validateHistory(value){
  if(!exact(value,['schemaVersion','revision','chapters','updatedAt'])||value.schemaVersion!==1||!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.chapters)||value.chapters.length>4||typeof value.updatedAt!=='string'||value.revision>0&&!Number.isFinite(Date.parse(value.updatedAt)))throw Error('Invalid public history');
  const ids=new Set();
  for(const c of value.chapters){
    if(!exact(c,['id','heading','paragraphs'])||!['origins','gatherings','assemblies','traditions'].includes(c.id)||ids.has(c.id)||typeof c.heading!=='string'||c.heading.length>80||!c.heading.trim()||!Array.isArray(c.paragraphs)||!c.paragraphs.length||c.paragraphs.length>150)throw Error('Invalid history chapter');
    ids.add(c.id);
    for(const text of [c.heading,...c.paragraphs])if(typeof text!=='string'||!text.trim()||text.length>1500||/\b(?:motherfucker|motherfucking|fucking|fucked|fucker|fuck|bullshit|shitty|shit|asshole|bastard|bitch|cunt|dickhead)\b/i.test(text)||/[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|<[^>]+>/i.test(text))throw Error('Unsafe history text');
  }
  return value;
}
export function applyHistoryRevision({current,event,secret,enabled,now=new Date()}){
  validateHistory(current);
  if(enabled!==true||typeof secret!=='string'||secret.length<32||event?.action!=='annals-history-revision'||!exact(event.client_payload,['document','approval']))throw Error('History authority unavailable');
  const {document,approval}=event.client_payload;
  validateHistory(document);
  if(!exact(approval,['mode','previousDigest','contentSha256','issuedAt','signature'])||approval.mode!==HISTORY_MODE||approval.previousDigest!==historyDigest(current)||approval.contentSha256!==historyDigest(document)||document.revision!==current.revision+1||approval.issuedAt!==document.updatedAt||!Number.isFinite(Date.parse(approval.issuedAt))||now.getTime()-Date.parse(approval.issuedAt)>86400000||Date.parse(approval.issuedAt)>now.getTime()+60000||!/^[a-f0-9]{64}$/.test(approval.signature))throw Error('Stale or altered history revision');
  const {signature,...proof}=approval;
  const expected=createHmac('sha256',secret).update(JSON.stringify(canonical({document,approval:proof}))).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))throw Error('Invalid history signature');
  return document;
}
export function renderHistory(document){
  validateHistory(document);
  return `<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#193d32"><title>Club History | Stammtisch Social Club</title><link rel="stylesheet" href="styles.css"><style>${REDACTION_CSS}
  .history-reading{max-width:720px;padding-block:40px 60px;overflow-wrap:anywhere}.history-reading h1{font-size:clamp(38px,8vw,64px);margin-block:20px}.history-reading h2{font-size:30px;color:#846329;margin-block:38px 16px}.history-reading p{font-size:17px;line-height:1.85;margin-block:18px}.history-reading .history-meta,.history-reading footer{font-size:13px;color:#64685e}.history-reading a{color:#193d32;display:inline-flex;align-items:center;min-height:44px}.history-reading footer{border-top:1px solid #d4d3c4;padding-top:22px;margin-top:38px}</style></head><body><a class="skip-link" href="#main">Skip to content</a><main id="main" class="shell history-reading" data-history-revision="${document.revision}"><a href="annals.html">← The Annals</a><p class="eyebrow">The living record</p><h1>Club History</h1><p>A story maintained from the recollections and evidence entrusted to the Annals. The record remains open to correction.</p>${document.updatedAt?'<p class="history-meta">'+escapeHtml(displayDate('Submitted '+document.updatedAt.slice(0,7)).replace('Submitted','Updated'))+'</p>':''}${document.chapters.length?document.chapters.map(c=>'<section id="chapter-'+escapeHtml(c.id)+'"><h2>'+escapeHtml(c.heading)+'</h2>'+c.paragraphs.map(p=>'<p>'+editorialHtml(p)+'</p>').join('')+'</section>').join(''):'<p class="history-meta">The record awaits a source-grounded contribution.</p>'}<footer>${escapeHtml(EDITORIAL_NOTICE)}<p><a href="mailto:annals@stammtischbrewery.com">Members: contribute a recollection or correction</a></p></footer></main></body></html>`;
}
async function main(){
  if(process.env.ANNALS_HISTORY_RELEASE_ENABLED!=='true'||!process.env.ANNALS_HISTORY_SIGNING_KEY||process.env.ANNALS_HISTORY_SIGNING_KEY===process.env.ANNALS_PUBLISH_SIGNING_KEY)throw Error('History release not qualified');
  const current=JSON.parse(await readFile('data/club-history.json','utf8'));
  const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
  const document=applyHistoryRevision({current,event,secret:process.env.ANNALS_HISTORY_SIGNING_KEY,enabled:true});
  const {buildPublishedAnnals}=await import('./ApprovedRenderer.mjs');
  const archive=JSON.parse(await readFile('data/annals-approved.json','utf8'));
  const rendered=buildPublishedAnnals(archive.entries,archive.approvals,process.env.ANNALS_PUBLISH_SIGNING_KEY,document);
  await writeFile('data/club-history.json',JSON.stringify(document,null,2)+'\n');
  await writeFile('history.html',renderHistory(document)+'\n');
  await writeFile('annals.html',rendered.html+'\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('History revision rejected; no private details logged.');process.exitCode=1;});
