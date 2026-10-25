import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {qualifySheetSync} from '../scripts/qualify-col-sheet-sync.mjs';
import {MEMBERS} from '../col-prospective.mjs';
const club=()=>JSON.parse(readFileSync(new URL('../data/col-club-state.json',import.meta.url),'utf8'));
const baseline=(date='2026-10-24')=>({year:2026,asOf:date,capturedAt:`${date}T16:00:00.000Z`,members:MEMBERS.map(id=>({id,name:id,score:0,picks:[{id:`${id}-3`,pick:2,name:id==='fish'?'Fictional Celebrity':`Fictional Celebrity ${id}`,born:'1950-01-01',points:0,counted:false,dateOfPassing:null}]}))});
const addPassing=(data,{diedOn='2026-10-25',reportedOn='2026-10-26',diedAt,recipient='fish'}={})=>{
  const next=structuredClone(data),owner=next.members.find(m=>m.id==='fish'),pick=owner.picks[0];
  const [by,bm,bd]=pick.born.split('-').map(Number),[dy,dm,dd]=diedOn.split('-').map(Number);
  const age=dy-by-Number(dm<bm||(dm===bm&&dd<bd)),points=age===100?10:100-age;
  Object.assign(pick,{dateOfPassing:reportedOn,actualDeathDate:diedOn,points,counted:true,
    actualDeathSource:{sourceUrl:'https://example.test/obituary',sourceLabel:'Independent report',verifiedOn:reportedOn},
    dateSource:{dateOfPassing:reportedOn,sourceUrl:'https://example.test/obituary',sourceLabel:'Independent report',verifiedOn:reportedOn,
      evidenceUrls:['https://example.test/obituary','https://news.example.test/obituary'],...(diedAt?{actualDeathAt:diedAt}:{})},
    ...(diedAt?{actualDeathAt:diedAt}:{})});
  if(recipient!=='fish'){
    pick.counted=false;pick.points=0;
    const target=next.members.find(m=>m.id===recipient);
    target.picks.push({...pick,id:`${recipient}-51`,pick:'BB',points,counted:true});
    target.score=points;
  }else owner.score=points;
  next.asOf=reportedOn;next.capturedAt=`${reportedOn}T23:00:00.000Z`;
  return next;
};
const checkedAt='2026-10-27T00:00:00.000Z';

test('the production check reconciles the complete 301-row historic baseline without rewriting it',()=>{
  const data=JSON.parse(readFileSync(new URL('../data/celebration.json',import.meta.url),'utf8'));
  const before=JSON.stringify(data),result=qualifySheetSync({before:data,after:data,clubState:club(),checkedAt:'2026-10-24T06:00:00Z'});
  assert.equal(result.historicalEntries,301);assert.equal(result.historicalAwards,14);
  assert.equal(result.prospectivePassings,0);assert.equal(JSON.stringify(data),before);
});

test('one independently verified new passing is calculated and must match the Sheet allocation',()=>{
  const before=baseline(),after=addPassing(before);
  const result=qualifySheetSync({before,after,clubState:club(),checkedAt});
  assert.equal(result.status,'qualified');assert.equal(result.prospectivePassings,1);
  const wrong=structuredClone(after);wrong.members[0].score=23;wrong.members[0].picks[0].points=23;
  assert.throws(()=>qualifySheetSync({before,after:wrong,clubState:club(),checkedAt}),/deterministic prospective calculation/);
});

test('a newly reported death is still checked when its death date precedes the moving Sheet snapshot',()=>{
  const before=baseline('2026-10-27');
  const after=addPassing(before,{diedOn:'2026-10-25',reportedOn:'2026-10-28'});
  const checkedAt='2026-10-29T00:00:00Z';
  assert.equal(qualifySheetSync({before,after,clubState:club(),checkedAt}).prospectivePassings,1);
  const wrong=structuredClone(after);
  wrong.members[0].picks[0].points+=1;wrong.members[0].score+=1;
  assert.throws(()=>qualifySheetSync({before,after:wrong,clubState:club(),checkedAt}),
    /deterministic prospective calculation/);
});

test('an event dated on the prior snapshot day is not silently classified as historical',()=>{
  const before=baseline('2026-10-25');
  const after=addPassing(before,{diedOn:'2026-10-25',reportedOn:'2026-10-26'});
  assert.equal(qualifySheetSync({before,after,clubState:club(),
    checkedAt:'2026-10-27T00:00:00Z'}).prospectivePassings,1);
});

test('independent death evidence is read from the existing confirmation record after import',()=>{
  const before=baseline(),after=addPassing(before);
  after.members[0].picks[0].dateSource={dateOfPassing:'2026-10-26'};
  const confirmations=[{name:'Fictional Celebrity',born:'1950-01-01',actualDeathDate:'2026-10-25',
    sourceUrl:'https://example.test/obituary',sourceLabel:'Independent reports',verifiedOn:'2026-10-26',
    evidenceUrls:['https://example.test/obituary','https://news.example.test/obituary']}];
  assert.equal(qualifySheetSync({before,after,clubState:club(),confirmations,checkedAt}).prospectivePassings,1);
  assert.throws(()=>qualifySheetSync({before,after,clubState:club(),checkedAt}),/two independently checked/);
});

test('Birthday Buffet follows the first group-report date and an authenticated correction',()=>{
  const before=baseline('2026-03-24'),after=addPassing(before,{diedOn:'2026-03-25',reportedOn:'2026-03-26',recipient:'marc'});
  assert.equal(qualifySheetSync({before,after,clubState:club(),checkedAt:'2026-03-27T00:00:00Z'}).prospectivePassings,1);
  const corrected=club();corrected.birthdayBuffet.corrections=[{name:'Fictional Celebrity',born:'1950-01-01',reportedOn:'2026-03-27'}];
  const moved=addPassing(before,{diedOn:'2026-03-25',reportedOn:'2026-03-26'});
  assert.equal(qualifySheetSync({before,after:moved,clubState:corrected,checkedAt:'2026-03-28T00:00:00Z'}).prospectivePassings,1);
});

test('January handover date-only events default to the prior season and a recorded season correction cannot enter the old Sheet season',()=>{
  const before=baseline('2027-01-14'),dateOnly=addPassing(before,{diedOn:'2027-01-15',reportedOn:'2027-01-16'});
  assert.equal(qualifySheetSync({before,after:dateOnly,clubState:club(),checkedAt:'2027-01-16T15:00:00Z'}).prospectivePassings,1);
  const afterCutoff=addPassing(before,{diedOn:'2027-01-15',diedAt:'2027-01-15T20:00:00-05:00',reportedOn:'2027-01-16'});
  assert.equal(qualifySheetSync({before,after:afterCutoff,clubState:club(),checkedAt:'2027-01-16T15:00:00Z'}).prospectivePassings,1,
    'an unverified time is ignored and the adopted date-only default applies');
  const corrected=club();corrected.seasonCorrections=[{name:'Fictional Celebrity',born:'1950-01-01',diedOn:'2027-01-15',competitionYear:2027}];
  assert.throws(()=>qualifySheetSync({before,after:dateOnly,clubState:corrected,checkedAt:'2027-01-16T15:00:00Z'}),/active Sheet/);
});

test('sourced handover time prevents a post-8-p.m. death from entering the old Sheet season',()=>{
  const before=baseline('2027-01-14');
  const after=addPassing(before,{diedOn:'2027-01-15',reportedOn:'2027-01-16'});
  const confirmation=actualDeathAt=>[{name:'Fictional Celebrity',born:'1950-01-01',
    actualDeathDate:'2027-01-15',actualDeathAt,
    evidenceUrls:['https://example.test/obituary','https://news.example.test/obituary']}];
  const observed='2027-01-16T23:30:00Z';
  assert.throws(()=>qualifySheetSync({before,after,clubState:club(),
    confirmations:confirmation('2027-01-15T20:05:00-05:00'),checkedAt:observed}),/active Sheet/);
  assert.equal(qualifySheetSync({before,after,clubState:club(),
    confirmations:confirmation('2027-01-15T19:55:00-05:00'),checkedAt:observed}).prospectivePassings,1);
  assert.throws(()=>qualifySheetSync({before,after,clubState:club(),
    confirmations:confirmation('2027-01-16T19:55:00-05:00'),checkedAt:observed}),/time is invalid/);
});

test('a delayed report cannot bypass the January season check by matching the prior snapshot date',()=>{
  const before=baseline('2027-01-16');
  const after=addPassing(before,{diedOn:'2027-01-16',reportedOn:'2027-01-17'});
  assert.throws(()=>qualifySheetSync({before,after,clubState:club(),
    checkedAt:'2027-01-18T00:00:00Z'}),/active Sheet/);
});

test('shared ownership and conflicting evidence fail closed without mutating either source',()=>{
  const before=baseline(),after=addPassing(before);
  after.members.find(m=>m.id==='marc').picks=[{...after.members[0].picks[0],id:'marc-3',pick:3}];
  after.members.find(m=>m.id==='marc').score=after.members[0].score;
  const snapshot=JSON.stringify(after);
  assert.throws(()=>qualifySheetSync({before,after,clubState:club(),checkedAt}),/missing evidence or a qualified correction/);
  assert.equal(JSON.stringify(after),snapshot);
  const bad=addPassing(before);bad.members[0].picks[0].dateSource.evidenceUrls=[];
  const untouched=JSON.stringify(bad);
  assert.throws(()=>qualifySheetSync({before,after:bad,clubState:club(),checkedAt}),/two independently checked/);
  assert.equal(JSON.stringify(bad),untouched);
});

test('already recorded events are treated as silent corrections or retries, never fresh passings',()=>{
  const before=addPassing(baseline()),after=structuredClone(before);
  after.members[0].picks[0].points=25;after.members[0].score=25;
  const result=qualifySheetSync({before,after,clubState:club(),checkedAt:'2026-10-28T00:00:00Z'});
  assert.equal(result.prospectivePassings,0);
});

test('a newly reported historical backfill stays on the silent prior-record path',()=>{
  const before=baseline(),pick=before.members[0].picks[0];
  pick.actualDeathDate='2026-10-20';pick.actualDeathSource={sourceUrl:'https://example.test/obituary',sourceLabel:'Independent report',verifiedOn:'2026-10-21'};
  const after=addPassing(before,{diedOn:'2026-10-20',reportedOn:'2026-10-26'});
  assert.equal(qualifySheetSync({before,after,clubState:club(),checkedAt:'2026-10-27T00:00:00Z'}).prospectivePassings,0);
});
