/* Owner-private conservative image-spend journal.
 * Owner-approved: additional USD $5 per America/Toronto month, USD $2 per
 * cocktail including EDIT + VISUAL REVIEW. The signed grant is NOT the ledger.
 * Reserve the full per-cocktail ceiling before the first provider call;
 * never automatically refund uncertain usage or reuse a spent source.
 *
 * One canonical private directory and a single-writer lock are required.
 * Not a replacement for the OpenAI project HARD spending limit.
 */
import {open,readFile,readdir,rename,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';

export const MONTHLY_CENTS=500;
export const PHOTO_CENTS=200;
const FILE='cocktail-editorial-budget-private.json';
const LOCK='cocktail-editorial-budget.lock';
const SHA=/^[a-f0-9]{64}$/;
const KEYS='entryId,period,reservationCents,reservedAt,sourceSha256';

export function torontoPeriod(now=new Date()){
  if(!(now instanceof Date)||!Number.isFinite(now.valueOf()))
    throw Error('Invalid monthly reservation clock');
  const fields=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Toronto',year:'numeric',month:'2-digit'
  }).formatToParts(now).map(p=>[p.type,p.value]));
  return fields.year+'-'+fields.month;
}
export function validateBudgetLedger(data){
  if(!data||typeof data!=='object'||Array.isArray(data)||
     Object.keys(data).sort().join(',')!=='monthlyCeilingCents,perPhotoCeilingCents,reservations,schemaVersion'||
     data.schemaVersion!==1||data.monthlyCeilingCents!==MONTHLY_CENTS||
     data.perPhotoCeilingCents!==PHOTO_CENTS||
     !Array.isArray(data.reservations)||data.reservations.length>2500)
    throw Error('Private image budget ledger invalid');
  const unique=new Set(),months=new Map();
  for(const p of data.reservations){
    if(!p||typeof p!=='object'||Array.isArray(p)||
       Object.keys(p).sort().join(',')!==KEYS||
       !/^[a-z0-9][a-z0-9-]{5,63}$/.test(p.entryId||'')||
       !SHA.test(p.sourceSha256||'')||
       !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.period||'')||
       p.reservationCents!==PHOTO_CENTS||
       !Number.isFinite(Date.parse(p.reservedAt))||
       torontoPeriod(new Date(p.reservedAt))!==p.period||
       unique.has(p.sourceSha256))
      throw Error('Invalid, duplicate or changed private image reservation');
    unique.add(p.sourceSha256);
    months.set(p.period,(months.get(p.period)||0)+p.reservationCents);
    if(months.get(p.period)>MONTHLY_CENTS)
      throw Error('Private image budget oversubscribed');
  }
  return data;
}
export function imageSpendCents(usage){
  const input=usage?.input_tokens_details,output=usage?.output_tokens_details;
  if(!input||!output||
     ![input.image_tokens,input.text_tokens,output.image_tokens].every(
       n=>Number.isInteger(n)&&n>=0))
    return null; // no auditable usage => no additional billable review
  // Direct Images Edit API does NOT receive Responses API cached-image rates.
  return Math.ceil(100*(input.image_tokens*8+
    input.text_tokens*5+output.image_tokens*30)/1000000);
}
export function reviewSpendCents(usage){
  if(!Number.isInteger(usage?.prompt_tokens)||usage.prompt_tokens<0||
     !Number.isInteger(usage?.completion_tokens)||usage.completion_tokens<0)
    return null;
  // gpt-4.1 image/text prompt tokens priced at input rate.
  return Math.ceil(100*(usage.prompt_tokens*2+
    usage.completion_tokens*8)/1000000);
}
export function enforceTotalSpend({editCents,reviewCents=0}){
  if(!Number.isInteger(editCents)||editCents<0||
     !Number.isInteger(reviewCents)||reviewCents<0||
     editCents+reviewCents>PHOTO_CENTS)
    throw Error('Per-photo USD 2 limit exceeded or provider usage unknown');
  return editCents+reviewCents;
}
export async function reserveCocktailBudget({directory,entryId,sourceSha256,permit,now=new Date()}){
  if(typeof directory!=='string'||!path.isAbsolute(directory)||
     !/^[a-z0-9][a-z0-9-]{5,63}$/.test(entryId||'')||
     !SHA.test(sourceSha256||'')||
     permit?.entryId!==entryId||permit?.sourceSha256!==sourceSha256||
     permit?.budgetPeriod!==torontoPeriod(now)||
     permit?.monthlyCeilingCents!==MONTHLY_CENTS||
     permit?.perPhotoCeilingCents!==PHOTO_CENTS||
     permit?.reservedCents!==PHOTO_CENTS||
     permit?.budgetReserved!==true)
    throw Error('Signed monthly budget authorisation not sufficient');
  // Exclusive lock is never silently broken: investigate a stale lock
  // privately instead of guessing whether another process spent money.
  const lockPath=path.join(directory,LOCK),ledgerPath=path.join(directory,FILE);
  let lock;
  try{lock=await open(lockPath,'wx',0o600)}
  catch{throw Error('Private budget lock unavailable; no provider call')}
  try{
    let ledger;
    try{ledger=validateBudgetLedger(JSON.parse(await readFile(ledgerPath,'utf8')))}
    catch(e){
      if(e.code!=='ENOENT')throw Error('Private budget ledger corrupt or inaccessible');
      const contents=await readdir(directory);
      if(contents.some(x=>/-attempt-private\.json$/.test(x)||x.startsWith('.cocktail-budget-')))
        throw Error('Existing one-shot evidence without ledger; refuse reinitialisation');
      ledger={schemaVersion:1,monthlyCeilingCents:MONTHLY_CENTS,
        perPhotoCeilingCents:PHOTO_CENTS,reservations:[]};
    }
    if(ledger.reservations.some(p=>p.sourceSha256===sourceSha256))
      throw Error('Cocktail image already reserved; no automatic repeat');
    const period=torontoPeriod(now),used=ledger.reservations
      .filter(p=>p.period===period)
      .reduce((total,p)=>total+p.reservationCents,0);
    if(used+PHOTO_CENTS>MONTHLY_CENTS)
      throw Error('USD 5 Toronto-month editorial image budget exhausted');
    const reservation={entryId,sourceSha256,period,
      reservationCents:PHOTO_CENTS,reservedAt:now.toISOString()};
    const next=validateBudgetLedger({...ledger,
      reservations:[...ledger.reservations,reservation]});
    const temp=path.join(directory,'.cocktail-budget-'+randomBytes(12).toString('hex'));
    try{
      await writeFile(temp,JSON.stringify(next,null,2)+'\n',{flag:'wx',mode:0o600});
      await rename(temp,ledgerPath);
    }finally{await rm(temp,{force:true})}
    return Object.freeze(reservation);
  }finally{
    await lock.close();
    await rm(lockPath,{force:true});
  }
}
