#!/usr/bin/env node
/* Reconcile new Sheet-reported passings with the deterministic prospective
 * rules before the existing Sheet monitor publishes its ordinary data commit.
 * No network, notification, signing, or write side effects. */
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {migrateBaseline,calculatePassing,annualRights} from '../col-prospective.mjs';
import {celebrityKey,correctedCompetitionYear,competitionYearForDeathDate} from '../col-club-state.mjs';

// Last source observation before the ordinary prospective Sheet reconciliation
// was deployed: the established 301-row / 14-award historical baseline.
// Do not substitute a moving hourly snapshot for this scoring lower bound.
const PUBLISHED_HISTORICAL_SOURCE_AT='2026-10-24T05:53:33.698881+00:00';
const identity=p=>celebrityKey(p.name,p.born);
const reported=p=>Boolean(p.dateOfPassing||p.counted);
const groups=data=>{
  const result=new Map();
  for(const member of data.members)for(const pick of member.picks){
    const key=identity(pick),items=result.get(key)||[];
    items.push({member,pick});result.set(key,items);
  }
  return result;
};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const totals=entries=>{
  const result=new Map();
  for(const {member,pick} of entries)if(pick.counted){
    if(!Number.isInteger(pick.points))throw Error('Counted allocation has unsupported arithmetic');
    result.set(member.id,(result.get(member.id)||0)+pick.points);
  }
  return result;
};
const sameTotals=(a,b)=>a.size===b.size&&[...a].every(([id,points])=>b.get(id)===points);

export function qualifySheetSync({before,after,clubState,confirmations=[],checkedAt}){
  const migration=migrateBaseline(before,clubState);
  migrateBaseline(after,clubState);
  if(before.year!==after.year)throw Error('A new competition year needs its own qualified source transition');
  if(!Number.isFinite(Date.parse(checkedAt))||!Number.isFinite(Date.parse(before.capturedAt))||
    Date.parse(checkedAt)<Date.parse(before.capturedAt))
    throw Error('Source observation time is invalid or regressed');
  // Older synthetic/source baselines retain their genuine earlier observation;
  // live snapshots from 24 October onward use the fixed historical cutover.
  const scoringBaseAt=Date.parse(before.capturedAt)<Date.parse(PUBLISHED_HISTORICAL_SOURCE_AT)
    ?before.capturedAt:PUBLISHED_HISTORICAL_SOURCE_AT;
  const priorGroups=groups(before),nextGroups=groups(after),calculated=[];
  for(const [personKey,entries] of nextGroups){
    const prior=priorGroups.get(personKey)||[];
    if(prior.some(({pick})=>reported(pick)))continue; // corrections and replays are silent
    const reportDates=[...new Set(entries.map(({pick})=>pick.dateOfPassing).filter(Boolean))];
    if(!reportDates.length)continue;
    if(reportDates.length!==1)throw Error('Shared first group-report dates conflict');
    const sources=entries.map(({pick})=>{
      const source=pick.actualDeathSource||pick.dateSource||{};
      const diedOn=pick.actualDeathDate||pick.dateSource?.dateOfPassing;
      return {pick,source,diedOn};
    }).filter(x=>x.diedOn);
    const deathDates=[...new Set(sources.map(x=>x.diedOn))];
    if(deathDates.length!==1)throw Error('Independent death evidence is missing or conflicting');
    const {pick,source}=sources[0],diedOn=deathDates[0];
    const matching=confirmations.filter(c=>celebrityKey(c.name,c.born)===personKey&&
      c.actualDeathDate===diedOn);
    const confirmation=matching.find(c=>Array.isArray(c.evidenceUrls));
    // A Sheet timestamp is not an authenticated death time. Only a matching
    // independently sourced confirmation may resolve the January 8 p.m. boundary.
    const sourcedTimes=[...new Set(matching.filter(c=>c.actualDeathAt!=null&&
      Array.isArray(c.evidenceUrls)&&new Set(c.evidenceUrls).size>=2&&
      c.evidenceUrls.every(url=>typeof url==='string'&&url.startsWith('https://')))
      .map(c=>c.actualDeathAt))];
    if(sourcedTimes.length>1)throw Error('Confirmed death times conflict');
    const diedAt=sourcedTimes[0]??null;
    if(diedAt!==null&&(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])$/.test(diedAt)||
      diedAt.slice(0,10)!==diedOn||!Number.isFinite(Date.parse(diedAt))))
      throw Error('Confirmed death time is invalid or conflicts with death date');
    const event={name:pick.name,born:pick.born,diedOn,discoveredOn:reportDates[0],
      ...(diedAt===null?{}:{diedAt})};
    // Even a delayed report classified as a silent backfill must not assign a
    // post-handover death to the old Sheet season.
    const season=correctedCompetitionYear(event,clubState)??
      competitionYearForDeathDate(diedOn,diedAt===null?null:Date.parse(diedAt));
    if(season!==after.year)
      throw Error('New passing belongs to a competition year not represented by the active Sheet');
    if(diedOn<=scoringBaseAt.slice(0,10))continue; // pre-baseline historical backfills stay silent
    const evidenceUrls=source.evidenceUrls??confirmation?.evidenceUrls??pick.dateSource?.evidenceUrls;
    if(!Array.isArray(evidenceUrls)||new Set(evidenceUrls).size<2||
      evidenceUrls.some(url=>typeof url!=='string'||!url.startsWith('https://')))
      throw Error('New passing lacks two independently checked source reports');
    const evidenceMaterial={personKey,diedOn,diedAt:event.diedAt??null,
      sourceUrls:evidenceUrls,sourceLabel:source.sourceLabel,verifiedOn:source.verifiedOn};
    event.evidence={kind:'independently-verified-death',personKey,diedOn,
      ...(event.diedAt?{diedAt:event.diedAt}:{}),verifiedAt:checkedAt,digest:digest(evidenceMaterial)};
    const members=after.members.map(m=>({id:m.id,name:m.name,score:m.score,
      picks:m.picks.map(p=>({name:p.name,born:p.born,pick:p.pick}))}));
    const previouslyUnawarded=prior.some(({pick})=>pick.actualDeathDate||pick.dateSource?.dateOfPassing) &&
      !prior.some(({pick})=>pick.dateOfPassing||pick.counted);
    const consumedPeople=migration.consumedPeople.filter(key=>key!==personKey||!previouslyUnawarded);
    const calculatedEvent=calculatePassing({members,event,clubState,effectiveAt:new Date(scoringBaseAt).toISOString(),
      observedAt:checkedAt,consumedPeople});
    if(calculatedEvent.status!=='calculated')throw Error('New passing requires missing evidence or a qualified correction');
    if(calculatedEvent.seasonYear!==after.year)
      throw Error('New passing belongs to a competition year not represented by the active Sheet');
    const observed=totals(entries),expected=new Map();
    for(const allocation of calculatedEvent.allocations)
      expected.set(allocation.memberId,(expected.get(allocation.memberId)||0)+allocation.points);
    if(!sameTotals(observed,expected))throw Error('Sheet award differs from the deterministic prospective calculation');
    calculated.push(calculatedEvent);
  }
  const rights=annualRights(calculated,
    Object.fromEntries(migration.corrected.members.map(m=>[m.id,m.score])),after.year);
  return {status:'qualified',historicalEntries:before.members.reduce((n,m)=>n+m.picks.length,0),
    historicalAwards:before.members.reduce((n,m)=>n+m.picks.filter(p=>p.counted).length,0),
    prospectivePassings:calculated.length,unresolvedAnnualTies:rights.held.length};
}

async function main(){
  const args=process.argv.slice(2),options={};
  for(let i=0;i<args.length;i+=2){if(!args[i]?.startsWith('--')||!args[i+1])throw Error('Invalid arguments');options[args[i].slice(2)]=args[i+1];}
  const read=async name=>JSON.parse(await readFile(options[name],'utf8'));
  const result=qualifySheetSync({before:await read('before'),after:await read('after'),
    clubState:await read('club-state'),confirmations:options.confirmations?await read('confirmations'):[],
    checkedAt:options['checked-at']});
  process.stdout.write(JSON.stringify(result)+'\n');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(()=>{process.stderr.write('Prospective CoL source check failed; no website data was published.\n');process.exitCode=1;});
}
