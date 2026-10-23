import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MEMBERS,migrateBaseline,calculatePassing,prospectiveTotals,annualRights,beginDraft,applyDraftAction,jettisonPenalty,validateSelections} from '../col-prospective.mjs';
import {celebrityKey} from '../col-club-state.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const club=()=>read('../data/col-club-state.json');
const person=(name='Fictional One',more={})=>({name,born:'1950-01-01',pick:2,...more});
const members=(p=person())=>MEMBERS.map(id=>({id,name:id,score:0,picks:id==='fish'?[p]:[]}));
const k=p=>celebrityKey(p.name,p.born);
const event=(p=person(),more={})=>{
  const e={name:p.name,born:p.born,diedOn:'2027-02-01',discoveredOn:'2027-02-02',...more};
  e.evidence={kind:'independently-verified-death',personKey:k(e),diedOn:e.diedOn,verifiedAt:'2028-02-01T00:00:00Z',digest:'a'.repeat(64),...(e.diedAt?{diedAt:e.diedAt}:{})};return e;
};
const calculate=(p=person(),e=event(p),more={})=>calculatePassing({members:members(p),event:e,clubState:club(),effectiveAt:'2026-10-25T12:00:00Z',observedAt:'2028-02-02T00:00:00Z',...more});

test('migration preserves all 301 actual rows, 14 signed allocations and all six totals',()=>{
  const data=read('../data/celebration.json'),before=JSON.stringify(data),m=migrateBaseline(data,club());
  assert.equal(m.baseline.members.flatMap(x=>x.picks).length,301);
  assert.equal(m.baseline.members.flatMap(x=>x.picks).filter(x=>x.counted).length,14);
  assert.deepEqual(m.baseline,data);assert.deepEqual(m.corrected,data);assert.equal(JSON.stringify(data),before);
  assert.ok(m.baseline.members.flatMap(x=>x.picks).some(x=>x.counted&&x.points<0));
  assert.equal(m.notificationEligible,false);
});
test('migration applies an explicit GitHub correction without rewriting the original signed allocation',()=>{
  const data=read('../data/celebration.json'),owner=data.members.find(m=>m.picks.some(p=>p.counted));
  const pick=owner.picks.find(p=>p.counted),c=club();
  c.pointsCorrections=[{seasonYear:data.year,memberId:owner.id,pickId:pick.id,name:pick.name,born:pick.born,points:-17}];
  const migrated=migrateBaseline(data,c);
  assert.equal(migrated.baseline.members.find(m=>m.id===owner.id).score,owner.score);
  assert.equal(migrated.corrected.members.find(m=>m.id===owner.id).score,owner.score-pick.points-17);
  data.members[0].score++;assert.throws(()=>migrateBaseline(data,club()),/reconcile/);
});
test('signed arithmetic at ages 99, 100 and 101 for ordinary and both Diamond slots',()=>{
  for(const [born,points] of [['1928-01-01',1],['1927-01-01',10],['1926-01-01',-1]])for(const pick of [2,1,50]){
    const p=person('Fictional '+born,{born,pick}),out=calculate(p,event(p));
    assert.equal(out.status,'calculated');assert.equal(out.allocations[0].points,points*(pick===2?1:2));
    assert.equal(out.rights.length,pick===2?0:1,'no revived centenary bonus');assert.equal(out.notificationEligible,false);
  }
});
test('Birthday Buffet uses group report date and GitHub correction; placed Protections and Diamonds are excluded',()=>{
  const p=person(),e=event(p,{diedOn:'2027-03-25',discoveredOn:'2027-03-26'}),c=club();
  assert.equal(calculate(p,e).allocations[0].memberId,'marc');
  c.birthdayBuffet.corrections=[{name:p.name,born:p.born,reportedOn:'2027-03-27'}];
  assert.equal(calculate(p,e,{clubState:c}).allocations[0].memberId,'fish');
  c.birthdayBuffet.corrections=[];c.protectionPlacements=[{memberId:'fish',name:p.name,born:p.born,placedOn:'2027-01-15'}];
  assert.equal(calculate(p,e,{clubState:c}).allocations[0].memberId,'fish');
  assert.equal(calculate({...p,pick:1},e).allocations[0].memberId,'fish');
});
test('missing, conflicting and future evidence cannot award points; duplicates and history cannot replay',()=>{
  const p=person();
  for(const e of [event(p,{discoveredOn:null}),event(p,{discoveredOn:'2027-01-01'}),event(p,{diedOn:'2029-01-01'}),{...event(p),evidence:null},event(p,{diedOn:'2026-10-24'})])assert.equal(calculate(p,e).status,'held');
  assert.equal(calculate(p,event(p),{consumedPeople:[k(p)]}).status,'held');
  const e=event(p);e.evidence.personKey='wrong';assert.equal(calculate(p,e).status,'held');
  const shared=members(p);shared[1].picks=[{...p}];assert.equal(calculate(p,event(p),{members:shared}).reason,'shared-selection-needs-allocation');
});
test('release-day date alone cannot establish prospectivity',()=>{
  const p=person();assert.equal(calculate(p,event(p,{diedOn:'2026-10-25'})).reason,'historical-or-release-boundary-passing');
  assert.equal(calculate(p,event(p,{diedOn:'2026-10-25',diedAt:'2026-10-25T13:00:00Z'})).status,'calculated');
});
test('January handover uses 8 p.m. Toronto, verified cross-zone instant and previous-season date-only default',()=>{
  const p=person();
  for(const [diedOn,diedAt,expected] of [['2027-01-01',null,2026],['2027-01-15',null,2026],['2027-01-15','2027-01-15T19:59:59-05:00',2026],['2027-01-15','2027-01-15T20:00:00-05:00',2027],['2027-01-16','2027-01-16T09:00:00+09:00',2026],['2027-01-16',null,2027]]){
    assert.equal(calculate(p,event(p,{diedOn,diedAt})).seasonYear,expected);
  }
  const c=club();c.seasonCorrections=[{name:p.name,born:p.born,diedOn:'2027-01-15',competitionYear:2027}];
  assert.equal(calculate(p,event(p,{diedOn:'2027-01-15'}),{clubState:c}).seasonYear,2027);
});
test('prospective totals never double-count consumed events and retain historical scores',()=>{
  const m=migrateBaseline(read('../data/celebration.json'),club()),e=calculate();
  assert.equal(prospectiveTotals(m,[e],2027).fish,23);
  assert.equal(prospectiveTotals(m,[e],2026).fish,m.corrected.members.find(x=>x.id==='fish').score);
  assert.throws(()=>prospectiveTotals(m,[e,e],2027),/duplicate/);
});
const zero=()=>Object.fromEntries(MEMBERS.map(id=>[id,0]));
test('oldest/youngest use full lifespan days, distinct-member exact ties stay held',()=>{
  const a=calculate(person('Fictional Old',{born:'1900-01-01'})),b=calculate(person('Fictional Young',{born:'1950-02-01'}));
  b.ownerId='marc';const rights=annualRights([a,b],zero(),2027);
  assert.equal(rights.rights.find(x=>x.reason==='Oldest death').memberId,'fish');
  assert.equal(rights.rights.find(x=>x.reason==='Youngest death').memberId,'marc');
  const tied={...a,personKey:'different',ownerId:'ken'};
  assert.ok(annualRights([a,tied],zero(),2027).held.length>0);
  assert.throws(()=>annualRights([a,a],zero(),2027),/unique/);
});
const fullMembers=()=>MEMBERS.map(id=>({id,name:id,score:0,picks:Array.from({length:50},(_,i)=>person('Fictional '+id+' '+(i+1),{pick:i+1}))}));
function draft(m=fullMembers(),awards={rights:[],held:[],devil:[]},more={}){
  return beginDraft({members:m,clubState:club(),completedYear:2026,at:'2027-01-16T01:00:00Z',awards,totals:zero(),order:[...MEMBERS],tieDecisions:[{method:'rock-paper-scissors',order:[...MEMBERS]}],...more});
}
let serial=0;
const act=(s,type,more={})=>applyDraftAction(s,{id:'action-'+(++serial),stage:s.stage,type,...more});
const advance=s=>{if(s.stage===5)for(const m of s.members)if(m.picks.length>45&&!s.jettisonWaivers.includes(m.id))s=act(s,'waive',{memberId:m.id});return act(s,'advance');};
test('draft cannot begin before handover or silently invent a tied order',()=>{
  assert.throws(()=>draft(undefined,undefined,{at:'2027-01-16T00:59:59Z'}),/handover/);
  assert.throws(()=>draft(undefined,undefined,{order:null}),/order/);
  assert.throws(()=>draft(undefined,{rights:[],held:[{reason:'tie'}],devil:[]}),/Unsettled/);
});
test('all seven stages are sequential and completed draft rejects replay',()=>{
  let d=draft();for(let i=1;i<=7;i++){assert.equal(d.stage,i);d=advance(d);}assert.equal(d.closed,true);
  assert.throws(()=>advance(d),/closed/);
  assert.throws(()=>applyDraftAction(draft(),{id:'action-test',stage:3,type:'steal'}),/sequence/);
});
test('Protection stays on its celebrity across years and cannot be stolen, jettisoned, moved or cancelled',()=>{
  const m=fullMembers(),p=m[0].picks[2],r={id:'right-protection',memberId:'fish',kind:'Protection',seasonYear:2026,at:'2026-02-01',personKey:'historical'};
  let d=advance(draft(m,{rights:[r],held:[],devil:[]}));
  d=act(d,'protect',{rightId:r.id,memberId:'fish',personKey:k(p)});
  assert.equal(d.protections.length,1);assert.throws(()=>act(d,'cancel',{memberId:'fish',personKey:k(p)}),/valid/);
  d=advance(d);d=advance(d);d=advance(d);
  assert.throws(()=>act(d,'jettison',{memberId:'fish',personKey:k(p)}),/unavailable/);
  const c=club();c.protectionPlacements=d.protections;
  const next=draft(m,undefined,{clubState:c,completedYear:2027,at:'2028-01-22T01:00:00Z'});
  assert.deepEqual(next.protections,d.protections);
});
test('Steals enforce chronological order, target protection, no repeated theft and ceiling',()=>{
  const m=fullMembers();m[0].picks.pop();m[1].picks.pop();
  const rights=[{id:'right-first',memberId:'fish',kind:'Steal',seasonYear:2026,at:'2026-02-01',personKey:'first'},
    {id:'right-second',memberId:'marc',kind:'Steal',seasonYear:2026,at:'2026-03-01',personKey:'second'}];
  let d=advance(advance(draft(m,{rights,held:[],devil:[]})));
  assert.throws(()=>act(d,'steal',{rightId:rights[1].id,memberId:'marc',personKey:k(m[2].picks[2])}),/chronology/);
  assert.throws(()=>act(d,'steal',{rightId:rights[0].id,memberId:'fish',personKey:k(m[2].picks[0])}),/Protected/);
  const target=k(m[2].picks[2]);d=act(d,'steal',{rightId:rights[0].id,memberId:'fish',personKey:target});
  assert.throws(()=>act(d,'steal',{rightId:rights[1].id,memberId:'marc',personKey:target}),/stolen/);
  assert.equal(d.members[0].picks.length,50);assert.equal(d.members[2].picks.length,49);
});
test('optional jettisons stop at five vacancies and exclude age 101, Diamonds and Protections',()=>{
  const m=fullMembers();m[0].picks[2].born='1926-01-01';let d=draft(m);
  for(let i=0;i<4;i++)d=advance(d);
  assert.throws(()=>act(d,'jettison',{memberId:'fish',personKey:k(m[0].picks[2])}),/unavailable/);
  for(let i=4;i<9;i++)d=act(d,'jettison',{memberId:'fish',personKey:k(m[0].picks[i])});
  assert.equal(d.members[0].picks.length,45);
  assert.throws(()=>act(d,'jettison',{memberId:'fish',personKey:k(m[0].picks[9])}),/unavailable/);
});
test('snake drafting skips full lists, excludes existing/dead identities, caps 50 and crowns vacant Diamonds',()=>{
  const m=fullMembers();for(const x of m){x.picks[0].counted=true;x.picks[1].counted=true;}
  let d=draft(m);for(let i=0;i<5;i++)d=advance(d);
  assert.throws(()=>act(d,'select',{memberId:'fish',selection:m[0].picks[0]}),/Unavailable/);
  const order=[...MEMBERS,...MEMBERS].slice(0,6).concat([...MEMBERS].reverse());
  for(let i=0;i<12;i++)d=act(d,'select',{memberId:order[i],selection:person('Fictional New '+i)});
  assert.ok(d.members.every(m=>m.picks.length===50));d=advance(d);
  for(const id of MEMBERS)d=act(d,'crown',{memberId:id,personKey:k(d.members.find(m=>m.id===id).picks[2]),slot:1});
  d=advance(d);assert.equal(d.closed,true);
});
test('jettison-at-100 penalty stays negative and requires actual order and identity',()=>{
  const p=person('Fictional Century',{born:'1927-01-01'}),e=calculate(p,event(p));
  const j={...p,memberId:'fish',age:100,at:'2027-01-16T01:00:00Z'};
  assert.equal(jettisonPenalty(j,e).points,-10);
  assert.equal(jettisonPenalty({...j,age:101},e),null);
  assert.equal(jettisonPenalty({...j,at:'2027-02-01T01:00:00Z'},e).status,'held');
});
test('selection validation rejects duplicate slots, member IDs and over-capacity lists',()=>{
  const m=fullMembers();m[0].picks[1].pick=1;assert.throws(()=>validateSelections(m),/Duplicate/);
  assert.throws(()=>validateSelections([...m,m[0]]),/six/);
});

test('dead Protections expire while retaining their historical placement evidence',()=>{
  const m=fullMembers(),p=m[0].picks[2],c=club();p.counted=true;
  c.protectionPlacements=[{memberId:'fish',name:p.name,born:p.born,placedOn:'2026-02-01'}];
  const d=draft(m,undefined,{clubState:c});assert.equal(d.protections.length,0);assert.deepEqual(d.expiredProtections,c.protectionPlacements);
});
test('wrong-season rights, duplicate rights, invented members and missing RPS record are rejected',()=>{
  const r={id:'right-genuine-shape',memberId:'fish',kind:'Steal',seasonYear:2026,at:'2026-02-01',personKey:'fictional'};
  for(const rights of [[{...r,seasonYear:2025}],[r,r],[{...r,memberId:'unknown'}],[{...r,kind:'arbitrary'}]])assert.throws(()=>draft(undefined,{rights,held:[],devil:[]}),/rights/);
  assert.throws(()=>draft(undefined,undefined,{tieDecisions:[]}),/rock-paper/);
});
test('jettison stage cannot silently advance without members completing or waiving their choices',()=>{
  let d=draft();for(let i=0;i<4;i++)d=advance(d);
  assert.throws(()=>act(d,'advance'),/jettison choices/);
  d=act(d,'waive',{memberId:'fish'});
  assert.throws(()=>act(d,'jettison',{memberId:'fish',personKey:k(d.members[0].picks[3])}),/unavailable/);
});
test('same-date Steals without verified chronological order stay held',()=>{
  const m=fullMembers();m[0].picks.pop();m[1].picks.pop();
  const rights=['fish','marc'].map((memberId,i)=>({id:'right-'+i,memberId,kind:'Steal',seasonYear:2026,at:'2026-02-01',personKey:'person-'+i}));
  const d=advance(advance(draft(m,{rights,held:[],devil:[]})));
  assert.throws(()=>act(d,'steal',{rightId:rights[0].id,memberId:'fish',personKey:k(m[2].picks[2])}),/Same-day/);
});
