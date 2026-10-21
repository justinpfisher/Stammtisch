import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {januaryHandover, competitionYearAt, competitionYearForDeathDate,
  isJettisonEligible, readClubState, firstReportDate,
  isProtectedPick} from '../col-club-state.mjs';
import {awardEvents,calculateAwards} from '../celebration-awards.mjs';

const source=JSON.parse(readFileSync(new URL('../data/col-club-state.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(source);
const pick=(name,more={})=>({pick:2,name,born:'1950-01-01',actualDeathDate:'2026-03-25',
  discoveryDate:'2026-03-26',counted:true,points:50,...more});
const member=(id,picks=[])=>({id,name:id,score:10,picks});
const season=(members)=>({year:2026,asOf:'2026-10-21',members});

test('official third-Friday January handover is 8 p.m. Toronto, including 2027',()=>{
  assert.deepEqual(januaryHandover(2027),{
    date:'2027-01-15',local:'2027-01-15T20:00:00-05:00',
    utc:'2027-01-16T01:00:00.000Z',timeZone:'America/Toronto'
  });
  assert.equal(januaryHandover(2028).date,'2028-01-21');
  assert.equal(januaryHandover(2031).date,'2031-01-17');
  assert.throws(()=>januaryHandover(2026));
});

test('January gap belongs to the preceding competition until exactly 8 p.m. Toronto',()=>{
  assert.equal(competitionYearAt('2027-01-01T00:00:00-05:00'),2026);
  assert.equal(competitionYearAt('2027-01-15T19:59:59-05:00'),2026);
  assert.equal(competitionYearAt('2027-01-16T00:59:59Z'),2026);
  assert.equal(competitionYearAt('2027-01-15T20:00:00-05:00'),2027);
  assert.equal(competitionYearAt('2027-01-16T01:00:00Z'),2027);
  assert.equal(competitionYearAt('2027-12-31T23:59:59-05:00'),2027);
  assert.equal(competitionYearAt('2028-01-21T19:59:59-05:00'),2027);
  assert.equal(competitionYearAt('2028-01-21T20:00:00-05:00'),2028);
  assert.equal(competitionYearAt('2027-01-15'),null,'date-only evidence cannot establish the side of the 8 p.m. boundary');
  assert.equal(competitionYearAt('2026-01-16T20:00:00-05:00'),null,'historical 2026 handover remains unknown');
});

test('GitHub draft/protection source is empty of unreported actions, never an invented history',()=>{
  const before=JSON.stringify(source);
  assert.equal(readClubState(source),source);
  assert.deepEqual(source.protectionPlacements,[]);
  assert.deepEqual(source.draftActions,[]);
  assert.deepEqual(source.birthdayBuffet.corrections,[]);
  assert.equal(JSON.stringify(source),before);
});

test('incorrect season policy, duplicate corrections and malformed placements fail closed',()=>{
  const broken=copy();broken.yearHandover.localTime='00:00';
  assert.throws(()=>readClubState(broken),/handover/);
  const badCorrection=copy();badCorrection.birthdayBuffet.corrections=[
    {name:'Fictional',born:'1950-01-01',reportedOn:'2026-03-26'},
    {name:'fictional',born:'1950-01-01',reportedOn:'2026-03-27'}];
  assert.throws(()=>readClubState(badCorrection),/Duplicate/);
  const badProtection=copy();badProtection.protectionPlacements=[
    {memberId:'unknown',name:'Fictional',born:'1950-01-01',placedOn:'2027-01-15'}];
  assert.throws(()=>readClubState(badProtection),/Protection/);
  const badAction=copy();badAction.draftActions=[
    {seasonYear:2026,stage:8,summary:'fictional',recordedAt:'2027-01-15T20:01:00-05:00'}];
  assert.throws(()=>readClubState(badAction),/draft/);
});

test('sheet report date is the default, with exact GitHub correction taking precedence',()=>{
  const entry={name:'Fictional',born:'1950-01-01',discoveredOn:'2026-03-26'};
  assert.equal(firstReportDate(entry,readClubState(copy())),'2026-03-26');
  const corrected=copy();corrected.birthdayBuffet.corrections=[
    {name:'Fictional',born:'1950-01-01',reportedOn:'2026-03-27'}];
  assert.equal(firstReportDate(entry,readClubState(corrected)),'2026-03-27');
  assert.equal(firstReportDate({...entry,name:'Another'},readClubState(corrected)),'2026-03-26');
});

test('Blue and Brown Diamonds are protected; earned placements are lasting and member-specific',()=>{
  const state=readClubState(copy());
  assert.equal(isProtectedPick({pick:1,name:'Blue',born:'1950-01-01'},'fish',state),true);
  assert.equal(isProtectedPick({pick:50,name:'Brown',born:'1950-01-01'},'fish',state),true);
  assert.equal(isProtectedPick({pick:10,bloodDiamond:true},'fish',state),true);
  assert.equal(isProtectedPick({pick:10,name:'Ordinary',born:'1950-01-01'},'fish',state),false);
  const placed=copy();placed.protectionPlacements=[
    {memberId:'fish',name:'Ordinary',born:'1950-01-01',placedOn:'2027-01-15'}];
  readClubState(placed);
  const selection={pick:10,name:'Ordinary',born:'1950-01-01'};
  assert.equal(isProtectedPick(selection,'fish',placed,'2028-07-01'),true);
  assert.equal(isProtectedPick(selection,'marc',placed,'2028-07-01'),false);
  assert.equal(isProtectedPick(selection,'fish',placed,'2026-07-01'),false);
});

test('birthday previews use corrected dates and recorded Protections without changing points',()=>{
  const data=season([member('fish',[pick('Fictional')]),member('marc',[])]);
  const before=JSON.stringify(data);
  let result=calculateAwards(data,{}, {},readClubState(copy()));
  let buffet=result.cards.find(x=>x.id==='birthday-buffet');
  assert.match(buffet.details.join(' '),/Fictional/);
  const corrected=copy();corrected.birthdayBuffet.corrections=[
    {name:'Fictional',born:'1950-01-01',reportedOn:'2026-03-27'}];
  result=calculateAwards(data,{}, {},readClubState(corrected));
  buffet=result.cards.find(x=>x.id==='birthday-buffet');
  assert.doesNotMatch(buffet.details.join(' '),/Fictional/);
  const placed=copy();placed.protectionPlacements=[
    {memberId:'fish',name:'Fictional',born:'1950-01-01',placedOn:'2025-01-17'}];
  readClubState(placed);
  const protectedEvent=awardEvents(data,placed).find(x=>x.name==='Fictional');
  assert.equal(protectedEvent.diamond,true);
  buffet=calculateAwards(data,{}, {},placed).cards.find(x=>x.id==='birthday-buffet');
  assert.doesNotMatch(buffet.details.join(' '),/Fictional/);
  assert.equal(JSON.stringify(data),before,'no historical allocation has been edited');
});

test('a source death date belongs to the old year until the 8 p.m. January handover',()=>{
  assert.equal(competitionYearForDeathDate('2026-01-15'),2026,
    'previously awarded 2026 results must not be reassigned');
  assert.equal(competitionYearForDeathDate('2026-12-31'),2026);
  assert.equal(competitionYearForDeathDate('2027-01-01'),2026);
  assert.equal(competitionYearForDeathDate('2027-01-14'),2026);
  assert.equal(competitionYearForDeathDate('2027-01-15'),2026,
    'unknown time on the changeover Friday defaults to the previous season');
  assert.equal(competitionYearForDeathDate('2027-01-15',Date.parse('2027-01-15T19:59:59-05:00')),2026);
  assert.equal(competitionYearForDeathDate('2027-01-15',Date.parse('2027-01-15T20:00:00-05:00')),2027);
  assert.equal(competitionYearForDeathDate('2027-01-16'),2027);
  assert.equal(competitionYearForDeathDate('2028-01-20'),2027);
  assert.equal(competitionYearForDeathDate('2028-01-21'),2027);
  assert.equal(competitionYearForDeathDate('2028-01-21',Date.parse('2028-01-21T20:00:00-05:00')),2028);
  assert.equal(competitionYearForDeathDate('2028-01-22'),2028);
  assert.equal(competitionYearForDeathDate('2027-02-30'),null);
});

test('only living, eligible, unprotected numbered picks may be jettisoned',()=>{
  const state=readClubState(copy()),asOf='2027-01-15';
  const living={pick:2,name:'Fictional',born:'1950-01-01',counted:false};
  assert.equal(isJettisonEligible(living,'fish',asOf,state),true);
  assert.equal(isJettisonEligible({...living,pick:1},'fish',asOf,state),false);
  assert.equal(isJettisonEligible({...living,pick:50},'fish',asOf,state),false);
  assert.equal(isJettisonEligible({...living,born:'1927-01-15'},'fish','2027-01-15',state),true,
    'a celebrity aged exactly 100 remains jettisonable');
  assert.equal(isJettisonEligible({...living,born:'1926-01-14'},'fish','2027-01-15',state),false,
    'a celebrity over 100 cannot be jettisoned');
  assert.equal(isJettisonEligible({...living,bloodDiamond:true},'fish',asOf,state),false);
  assert.equal(isJettisonEligible({...living,dateOfPassing:'2026-11-01'},'fish',asOf,state),false);
  assert.equal(isJettisonEligible({...living,actualDeathDate:'2026-11-01'},'fish',asOf,state),false);
  assert.equal(isJettisonEligible({...living,dateSource:{dateOfPassing:'2026-11-01'}},'fish',asOf,state),false);
  assert.equal(isJettisonEligible({...living,counted:true},'fish',asOf,state),false);
  assert.equal(isJettisonEligible({...living,needsReview:true},'fish',asOf,state),false);
  assert.equal(isJettisonEligible({...living,born:null},'fish',asOf,state),false);
  const placed=copy();placed.protectionPlacements=[
    {memberId:'fish',name:'Fictional',born:'1950-01-01',placedOn:'2027-01-15'}];
  assert.equal(isJettisonEligible(living,'fish','2028-01-15',readClubState(placed)),false,
    'a placed Protection does not lapse between competitions');
  assert.equal(isJettisonEligible(living,'marc','2028-01-15',readClubState(placed)),true,
    'a Protection cannot silently transfer to another member');
});
