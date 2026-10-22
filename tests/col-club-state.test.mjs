import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {januaryHandover, competitionYearAt, competitionYearForDeathDate, correctedCompetitionYear,
  isJettisonEligible, readClubState, applyPointsCorrections, firstReportDate,
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
  assert.deepEqual(source.seasonCorrections,[]);
  assert.deepEqual(source.pointsCorrections,[]);
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

test('member-authored GitHub season correction overrides the untimed handover default in previews only',()=>{
  const correction={name:'Fictional',born:'1950-01-01',diedOn:'2027-01-15',competitionYear:2027};
  const changed=copy();changed.seasonCorrections=[correction];
  readClubState(changed);
  assert.equal(correctedCompetitionYear({name:'FICTIONAL',born:'1950-01-01',diedOn:'2027-01-15'},changed),2027);
  assert.equal(correctedCompetitionYear({name:'Fictional',born:'1950-01-01',diedOn:'2027-01-14'},changed),null);
  const data={year:2026,asOf:'2027-01-16',members:[member('fish',[
    pick('Fictional',{actualDeathDate:'2027-01-15',discoveryDate:'2027-01-15'})])]};
  const original=JSON.stringify(data);
  assert.equal(calculateAwards(data,{}, {},copy()).events.length,1,'previous-season default applies');
  assert.equal(calculateAwards(data,{}, {},changed).events.length,0,'member correction applies');
  data.year=2027;
  assert.equal(calculateAwards(data,{}, {},changed).events.length,1);
  assert.equal(data.members[0].score,10,'recorded scores never change');
  assert.equal(JSON.stringify(data.members),JSON.stringify(JSON.parse(original).members),'recorded pick allocations are untouched');
});

test('season overrides require an actual handover date, allowable year and unique celebrity',()=>{
  const valid={name:'Fictional',born:'1950-01-01',diedOn:'2027-01-15',competitionYear:2027};
  for(const incorrect of [
    {...valid,diedOn:'2027-01-14'},
    {...valid,competitionYear:2028},
    {...valid,born:'2027-01-16'},
    {...valid,diedOn:'2026-01-16'},
    {...valid,competitionYear:'2026'},
    {...valid,reason:'unverified private communication'},
  ]){
    const invalid=copy();invalid.seasonCorrections=[incorrect];
    assert.throws(()=>readClubState(invalid),/Season correction|Invalid season correction/);
  }
  const repeated=copy();repeated.seasonCorrections=[valid,{...valid,name:'FICTIONAL',competitionYear:2026}];
  assert.throws(()=>readClubState(repeated),/Duplicate season correction/);
});

test('a GitHub points correction overrides a stale Sheet score without editing the imported ledger',()=>{
  const data=season([member('fish',[
    {...pick('Fictional'),id:'fish-3',points:50}])]);
  data.members[0].score=50;
  const before=JSON.stringify(data);
  const state=copy();state.pointsCorrections=[{
    seasonYear:2026,memberId:'fish',pickId:'fish-3',name:'Fictional',born:'1950-01-01',points:37}];
  readClubState(state);
  const corrected=applyPointsCorrections(data,state);
  assert.equal(corrected.members[0].picks[0].points,37);
  assert.equal(corrected.members[0].score,37);
  assert.equal(data.members[0].score,50);
  assert.equal(JSON.stringify(data),before,'imported, signed historical scores remain intact');
  const newerSheet=structuredClone(data);newerSheet.asOf='2026-10-22';
  assert.equal(applyPointsCorrections(newerSheet,state).members[0].score,37,
    'a later spreadsheet import cannot reverse a GitHub correction');
  assert.equal(corrected.members[0].picks[0].actualDeathDate,'2026-03-25');
});

test('Club corrections permit negative point awards for deaths past age 100',()=>{
  const data=season([member('fish',[{...pick('Fictional'),id:'fish-3',points:4}])]);
  data.members[0].score=4;
  const state=copy();state.pointsCorrections=[{
    seasonYear:2026,memberId:'fish',pickId:'fish-3',name:'Fictional',born:'1950-01-01',points:-18
  }];
  assert.equal(readClubState(state),state);
  const result=applyPointsCorrections(data,state);
  assert.equal(result.members[0].score,-18);
  assert.equal(result.members[0].picks[0].points,-18);
  assert.equal(data.members[0].score,4,'original signed Sheet state remains intact');
});

test('GitHub score overrides reject mismatched identity, unawarded picks and malformed corrections',()=>{
  const data=season([member('fish',[{...pick('Fictional'),id:'fish-3'}])]);
  const c={seasonYear:2026,memberId:'fish',pickId:'fish-3',name:'Fictional',born:'1950-01-01',points:37};
  for(const bad of [{...c,points:-1001},{...c,points:1001},{...c,points:2.5},{...c,memberId:'outsider'},
    {...c,pickId:'marc-3'},{...c,seasonYear:2025},{...c,note:'unverified private detail'}]){
    const state=copy();state.pointsCorrections=[bad];
    assert.throws(()=>readClubState(state),/Invalid GitHub points correction/);
  }
  const dup=copy();dup.pointsCorrections=[c,{...c,points:40}];
  assert.throws(()=>readClubState(dup),/Duplicate GitHub points correction/);
  const incorrect=copy();incorrect.pointsCorrections=[{...c,name:'Not the same person'}];
  assert.throws(()=>applyPointsCorrections(data,readClubState(incorrect)),/does not match/);
  const unscored=structuredClone(data);unscored.members[0].picks[0].counted=false;
  const valid=copy();valid.pointsCorrections=[c];
  assert.throws(()=>applyPointsCorrections(unscored,readClubState(valid)),/does not match/);
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

test('a verified cross-zone death time governs Toronto handover even if its local date is Saturday',()=>{
  const before='2027-01-16T04:00:00+14:00'; // Friday 9 a.m. Toronto
  const atCutoff='2027-01-16T15:00:00+14:00'; // Friday 8 p.m. Toronto
  assert.equal(competitionYearAt(before),2026);
  assert.equal(competitionYearAt(atCutoff),2027);
  assert.equal(competitionYearForDeathDate('2027-01-16',Date.parse(before)),2026);
  assert.equal(competitionYearForDeathDate('2027-01-16',Date.parse(atCutoff)),2027);
  assert.equal(competitionYearForDeathDate('2027-01-16'),2027,
    'without independently verified time, the recorded Saturday date applies');
  assert.equal(competitionYearForDeathDate('2027-01-16',Number.NaN),2027,
    'invalid timestamps never manufacture a different season');
  assert.equal(competitionYearForDeathDate('2026-01-17',Date.parse('2026-01-17T04:00:00+14:00')),2026,
    'signed 2026 history is never retrospectively reassigned');
  const record={year:2026,asOf:'2027-01-20',members:[member('fish',[
    pick('Fictional',{actualDeathDate:'2027-01-16',actualDeathAt:before,discoveryDate:'2027-01-16'})])]};
  const saved=JSON.stringify(record);
  const event=awardEvents(record,readClubState(copy()))[0];
  assert.equal(event.competitionYear,2026);
  assert.equal(event.inSeason,true);
  assert.equal(event.diedOn,'2027-01-16');
  assert.equal(JSON.stringify(record),saved,'preview never mutates signed recorded points');
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
