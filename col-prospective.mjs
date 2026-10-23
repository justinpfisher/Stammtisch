/* Pure prospective CoL calculations. No network, signing, publication or alerts.
 * This engine is NOT an activation flag: the protected release must qualify its
 * exact implementation and inputs before a production adapter may use results.
 * A held result contains no guessed allocation or draft right. */
import {ageAt, basePoints} from './celebration-rules.mjs';
import {readClubState, celebrityKey, januaryHandover, competitionYearForDeathDate,
  correctedCompetitionYear, firstReportDate, isProtectedPick, applyPointsCorrections} from './col-club-state.mjs';

export const MEMBERS=Object.freeze(['fish','marc','matt','ken','jamie','jerome']);
export const STAGES=Object.freeze(['Winner declared','Protections','Steals',"Devil’s Share",'Jettisons','Draft','Coronation of Diamonds']);
const birthdays={marc:'03-26',jerome:'05-09',matt:'06-25',fish:'07-06',ken:'07-20',jamie:'09-19'};
const key=p=>celebrityKey(p.name,p.born);
const date=x=>typeof x==='string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(x+'T00:00:00Z')) && new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const instant=x=>typeof x==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(x) && date(x.slice(0,10)) && Number.isFinite(Date.parse(x));
const numbered=p=>Number.isInteger(p.pick)&&p.pick>=1&&p.pick<=50;
const person=p=>p&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=160&&date(p.born);
const torontoDay=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
const hold=reason=>({status:'held',reason,allocations:[],rights:[],notificationEligible:false});
const assert=(ok,message)=>{if(!ok)throw Error(message);};

export function validateSelections(members) {
  assert(Array.isArray(members)&&members.length===6,'Exactly six members required');
  assert(new Set(members.map(m=>m.id)).size===6&&members.every(m=>MEMBERS.includes(m.id)),'Member identity mismatch');
  for(const m of members) {
    assert(Array.isArray(m.picks)&&m.picks.length<=51,'Bounded member list required');
    const slots=new Set(),identities=new Set();
    for(const p of m.picks) {
      assert(person(p)&&(numbered(p)||p.pick==='BB'),'Invalid selection');
      assert(!slots.has(p.pick)&&!identities.has(key(p)),'Duplicate member selection');
      slots.add(p.pick);identities.add(key(p));
    }
  }
  return members;
}

// Keep every original imported row and allocation. The separate corrected view
// is calculated afterward; it never changes or rewrites the baseline.
export function migrateBaseline(data, clubState) {
  readClubState(clubState);validateSelections(data.members);
  assert(Number.isInteger(data.year)&&data.year>=2026&&date(data.asOf),'Invalid baseline season');
  const ids=new Set();
  for(const m of data.members) {
    assert(Number.isInteger(m.score),'Invalid historical total');
    for(const p of m.picks) {
      assert(typeof p.id==='string'&&!ids.has(p.id),'Duplicate historical row');ids.add(p.id);
      assert(typeof p.counted==='boolean'&&(!p.counted||Number.isInteger(p.points)),'Invalid historical allocation');
    }
    assert(m.picks.filter(p=>p.counted).reduce((n,p)=>n+p.points,0)===m.score,'Historical total does not reconcile');
  }
  return {schemaVersion:1,baseline:structuredClone(data),corrected:applyPointsCorrections(structuredClone(data),clubState),
    consumedPeople:[...new Set(data.members.flatMap(m=>m.picks.filter(p=>p.counted||p.actualDeathDate||p.dateOfPassing).map(key)))],
    notificationEligible:false};
}

// `evidence` is a public-safe output from the independent death verifier, NOT
// an email claim. The caller must authenticate it and bind the entire input in
// its signed release. URLs alone never establish verification in production.
export function calculatePassing({members,event,clubState,effectiveAt,observedAt,consumedPeople=[]}) {
  readClubState(clubState);validateSelections(members);
  assert(instant(effectiveAt)&&instant(observedAt)&&Date.parse(observedAt)>=Date.parse(effectiveAt),'Invalid prospective clock');
  if(!person(event)||!date(event.diedOn)||event.born>event.diedOn)return hold('actual-death-date-required');
  const evidence=event.evidence;
  if(!evidence||evidence.kind!=='independently-verified-death'||evidence.personKey!==key(event)||
    evidence.diedOn!==event.diedOn||!instant(evidence.verifiedAt)||Date.parse(evidence.verifiedAt)>Date.parse(observedAt)||
    !/^[a-f0-9]{64}$/.test(evidence.digest||''))return hold('independent-death-evidence-required');
  if(consumedPeople.includes(key(event)))return hold('previously-recorded-passing');
  let diedAt=null;
  if(event.diedAt!=null) {
    if(!instant(event.diedAt)||event.diedAt.slice(0,10)!==event.diedOn||evidence.diedAt!==event.diedAt)return hold('actual-death-time-evidence-required');
    diedAt=Date.parse(event.diedAt);
  }
  // A date at the release boundary cannot establish prospective effect. Do not
  // manufacture midnight or use the news/report/verification timestamp.
  const releaseDay=torontoDay(effectiveAt);
  if(diedAt===null&&event.diedOn<=releaseDay||diedAt!==null&&diedAt<Date.parse(effectiveAt))return hold('historical-or-release-boundary-passing');
  // Verified exact death times are compared as instants; the source-local
  // death date may be tomorrow relative to UTC without being in the future.
  // Without a verified time, hold a date beyond today's Toronto calendar day.
  if(diedAt!==null?diedAt>Date.parse(observedAt):event.diedOn>torontoDay(observedAt))return hold('future-passing');
  const owners=members.flatMap(m=>m.picks.filter(p=>numbered(p)&&key(p)===key(event)).map(p=>({...p,memberId:m.id})));
  if(owners.length!==1)return hold(owners.length?'shared-selection-needs-allocation':'numbered-owner-required');
  const owner=owners[0],age=ageAt(event.born,event.diedOn);
  const protectedPick=isProtectedPick(owner,owner.memberId,clubState,event.diedOn);
  const reportedOn=firstReportDate(event,clubState);
  // Group-report dates are Toronto-local; a verified death timestamp can have
  // a different source-local calendar date. Never compare either against UTC's
  // date part, or treat tomorrow in Toronto as a completed WhatsApp report.
  const reportDeathDay=diedAt===null?event.diedOn:torontoDay(diedAt);
  if(!protectedPick&&(!date(reportedOn)||reportedOn<reportDeathDay||
    reportedOn>torontoDay(observedAt)))return hold('club-report-date-required');
  const buffet=!protectedPick&&Object.keys(birthdays).find(id=>birthdays[id]===reportedOn.slice(5));
  const multiplier=[1,50].includes(owner.pick)?2:1;
  const points=basePoints(age)*multiplier;
  const seasonYear=correctedCompetitionYear(event,clubState)??competitionYearForDeathDate(event.diedOn,diedAt);
  const rights=[];
  if(owner.pick===1)rights.push({kind:'Steal',memberId:owner.memberId,reason:'Blue Diamond'});
  if(owner.pick===50)rights.push({kind:'Protection',memberId:owner.memberId,reason:'Brown Diamond'});
  return {status:'calculated',personKey:key(event),name:event.name,born:event.born,diedOn:event.diedOn,diedAt:event.diedAt??null,
    seasonYear,reportedOn:reportedOn??null,age,ageInDays:(Date.parse(event.diedOn)-Date.parse(event.born))/86400000,
    ownerId:owner.memberId,pick:owner.pick,birthdayBuffet:Boolean(buffet),
    allocations:[{memberId:buffet||owner.memberId,points}],rights,
    evidenceDigest:evidence.digest,notificationEligible:false};
}

// Pure totals never re-evaluate a signed historical allocation. Corrections
// remain bound to the existing source row by applyPointsCorrections above.
export function prospectiveTotals(migration,calculated,seasonYear) {
  assert(Number.isInteger(seasonYear)&&seasonYear>=migration.baseline.year,'Invalid totals season');
  const totals=Object.fromEntries(MEMBERS.map(id=>[id,seasonYear===migration.baseline.year?migration.corrected.members.find(m=>m.id===id).score:0]));
  const seen=new Set(migration.consumedPeople);
  for(const e of calculated) {
    assert(e.status==='calculated'&&!seen.has(e.personKey),'Uncalculated or duplicate passing');seen.add(e.personKey);
    if(e.seasonYear!==seasonYear)continue;
    for(const a of e.allocations) {assert(MEMBERS.includes(a.memberId)&&Number.isInteger(a.points),'Invalid allocation');totals[a.memberId]+=a.points;}
  }
  return totals;
}

// Preserve the Club's seven-stage order: Protections, ordinary Steals in actual
// death chronology, then the oldest-death Steal. Source-local dates may differ
// across time zones; exact verified instants override their calendar labels.
function draftRightPriority(right){
  return right.kind==='Protection'?0:right.reason==='Oldest death'?2:1;
}
function compareDraftRights(a,b){
  const priority=draftRightPriority(a)-draftRightPriority(b);
  if(priority)return priority;
  if(a.diedAt&&b.diedAt){
    const delta=Date.parse(a.diedAt)-Date.parse(b.diedAt);
    if(delta)return delta;
  }
  return a.at.localeCompare(b.at)||a.personKey.localeCompare(b.personKey);
}

export function annualRights(events,totals,seasonYear) {
  assert(MEMBERS.every(id=>Number.isInteger(totals[id])),'Complete signed standings required');
  const relevant=events.filter(e=>e.seasonYear===seasonYear);
  const seen=new Set();
  for(const e of relevant) {
    assert(e.status==='calculated'&&!seen.has(e.personKey)&&MEMBERS.includes(e.ownerId)&&Number.isFinite(e.ageInDays),'Qualified unique annual events required');seen.add(e.personKey);
  }
  const rights=relevant.flatMap(e=>e.rights.map((r,index)=>({...r,id:`${seasonYear}:${e.personKey}:${index}`,personKey:e.personKey,at:e.diedOn,diedAt:e.diedAt,seasonYear})));
  const held=[];
  for(const [kind,reason,choose] of [['Steal','Oldest death',Math.max],['Protection','Youngest death',Math.min]]) {
    if(!relevant.length)continue;
    const extreme=choose(...relevant.map(e=>e.ageInDays)),matched=relevant.filter(e=>e.ageInDays===extreme);
    const owners=[...new Set(matched.map(e=>e.ownerId))];
    if(owners.length!==1||matched.length!==1){held.push({reason:`${reason} tie needs a recorded decision`,members:owners});continue;}
    const e=matched[0];rights.push({kind,memberId:e.ownerId,reason,id:`${seasonYear}:${reason}`,personKey:e.personKey,at:e.diedOn,diedAt:e.diedAt,seasonYear});
  }
  rights.sort(compareDraftRights);
  const scores=Object.values(totals),min=Math.min(...scores),max=Math.max(...scores);
  return {rights,held,winners:MEMBERS.filter(id=>totals[id]===max),devil:MEMBERS.filter(id=>totals[id]===min),
    tiedOrder:MEMBERS.filter(id=>MEMBERS.some(other=>id!==other&&totals[id]===totals[other]))};
}

// A draft is an explicit sequence of recorded member actions. Merely crossing
// January's clock never fabricates selections, tie decisions or placements.
export function beginDraft({members,clubState,completedYear,at,awards,totals,order,tieDecisions=[]}) {
  validateSelections(members);readClubState(clubState);
  assert(Number.isInteger(completedYear)&&completedYear>=2026&&MEMBERS.every(id=>Number.isInteger(totals[id])),'Complete draft season and standings required');
  assert(instant(at)&&Date.parse(at)>=Date.parse(januaryHandover(completedYear+1).utc),'Draft precedes handover');
  assert(Array.isArray(order)&&order.length===6&&new Set(order).size===6&&order.every(id=>MEMBERS.includes(id)),'Recorded full draft order required');
  assert(order.every((id,i)=>i===0||totals[order[i-1]]<=totals[id]),'Draft order must follow standings');
  // Decisions are signed/attributed by the adapter, never inferred from names.
  const groups=[...new Set(Object.values(totals))].map(score=>order.filter(id=>totals[id]===score)).filter(g=>g.length>1);
  assert(Array.isArray(tieDecisions)&&tieDecisions.length===groups.length&&groups.every(g=>tieDecisions.some(d=>
    d.method==='rock-paper-scissors'&&Array.isArray(d.order)&&JSON.stringify(d.order)===JSON.stringify(g))),'Recorded rock-paper-scissors results required');
  assert(awards&&Array.isArray(awards.held)&&awards.held.length===0,'Unsettled annual rights');
  assert(Array.isArray(awards.rights)&&awards.rights.length<=1000&&new Set(awards.rights.map(r=>r.id)).size===awards.rights.length&&
    awards.rights.every(r=>typeof r.id==='string'&&r.id.length<=250&&MEMBERS.includes(r.memberId)&&['Steal','Protection'].includes(r.kind)&&r.seasonYear===completedYear&&date(r.at)&&typeof r.personKey==='string'&&
      (r.diedAt==null||instant(r.diedAt)&&r.diedAt.slice(0,10)===r.at)),'Invalid or wrong-season annual rights');
  assert(Array.isArray(awards.devil)&&new Set(awards.devil).size===awards.devil.length&&awards.devil.every(id=>MEMBERS.includes(id)&&totals[id]===Math.min(...Object.values(totals))),'Invalid Devil rights');
  const dead=p=>p.counted||p.dateOfPassing||p.actualDeathDate||p.dateSource?.dateOfPassing;
  return {schemaVersion:1,seasonYear:completedYear+1,stage:1,at,order:[...order],turn:0,
    members:members.map(m=>({...structuredClone(m),picks:m.picks.filter(p=>numbered(p)&&!dead(p)).map(p=>structuredClone(p))})),
    protections:structuredClone(clubState.protectionPlacements.filter(p=>members.some(m=>m.id===p.memberId&&m.picks.some(x=>key(x)===key(p)&&!dead(x))))),
    expiredProtections:structuredClone(clubState.protectionPlacements.filter(p=>members.some(m=>m.picks.some(x=>key(x)===key(p)&&dead(x))))),
    rights:structuredClone(awards.rights).sort(compareDraftRights),devil:[...awards.devil],
    consumedRights:[],stolen:[],jettisons:[],jettisonWaivers:[],actions:[],closed:false,
    deadPeople:[...new Set(members.flatMap(m=>m.picks.filter(dead).map(key)))],
    vacantDiamonds:Object.fromEntries(members.map(m=>[m.id,[1,50].filter(slot=>!m.picks.some(p=>p.pick===slot&&!dead(p)))]))};
}

function member(state,id){const m=state.members.find(m=>m.id===id);assert(m,'Unknown member');return m;}
function protectedInDraft(s,p,id){return isProtectedPick(p,id,{protectionPlacements:s.protections});}
function emptySlot(m){for(let n=2;n<50;n++)if(!m.picks.some(p=>p.pick===n))return n;for(const n of [1,50])if(!m.picks.some(p=>p.pick===n))return n;return null;}
function spend(s,id,kind,memberId){
  const r=s.rights.find(x=>x.id===id&&x.kind===kind&&x.memberId===memberId);
  assert(r&&!s.consumedRights.includes(id),'Missing, expired or spent draft right');
  if(kind==='Steal') {
    const remaining=s.rights.filter(x=>x.kind==='Steal'&&!s.consumedRights.includes(x.id));
    const earliest=remaining[0];assert(earliest,'No remaining Steal');
    assert(!remaining.some(x=>x.personKey!==r.personKey&&draftRightPriority(x)===draftRightPriority(r)&&
      (x.diedAt&&r.diedAt?Date.parse(x.diedAt)===Date.parse(r.diedAt):x.at===r.at)),
      'Same-day Steal order needs evidence');
    assert(earliest.id===id,'Steals must follow actual death chronology');
  }
  s.consumedRights.push(id);
}
function protect(s,memberId,personKey){
  const p=member(s,memberId).picks.find(p=>key(p)===personKey);
  assert(p&&!protectedInDraft(s,p,memberId),'Living unprotected selection required');
  s.protections.push({memberId,name:p.name,born:p.born,placedOn:torontoDay(s.at)});
}
function steal(s,memberId,personKey){
  const holders=s.members.filter(m=>m.picks.some(p=>key(p)===personKey));
  assert(holders.length===1&&holders[0].id!==memberId,'Unique other owner required');
  const from=holders[0],p=from.picks.find(p=>key(p)===personKey),to=member(s,memberId);
  assert(!protectedInDraft(s,p,from.id)&&!s.stolen.includes(personKey),'Protected or already stolen selection');
  const slot=emptySlot(to);assert(slot!==null,'Maximum 50 numbered selections');
  from.picks=from.picks.filter(p=>key(p)!==personKey);to.picks.push({...p,pick:slot});s.stolen.push(personKey);
}
function nextDrafter(s){
  for(let n=0;n<600;n++){
    const round=Math.floor(s.turn/6),position=s.turn%6,id=s.order[round%2?5-position:position];
    if(member(s,id).picks.length<50)return id;
    s.turn++;
    if(s.members.every(m=>m.picks.length===50))return null;
  }
  throw Error('Draft turn bound exceeded');
}
export function applyDraftAction(state,action) {
  assert(!state.closed&&Number.isInteger(state.stage)&&state.stage>=1&&state.stage<=7,'Draft is closed or invalid');
  assert(action&&typeof action.id==='string'&&/^[a-z0-9-]{6,80}$/.test(action.id)&&!state.actions.some(a=>a.id===action.id),'Unique recorded action required');
  assert(action.stage===state.stage,'Seven-stage sequence required');
  const s=structuredClone(state);
  if(action.type==='advance') {
    if(s.stage===2)assert(s.rights.filter(r=>r.kind==='Protection').every(r=>s.consumedRights.includes(r.id)),'Place or waive remaining Protections');
    if(s.stage===3)assert(s.rights.filter(r=>r.kind==='Steal').every(r=>s.consumedRights.includes(r.id)),'Use or waive remaining Steals');
    if(s.stage===4)assert(s.devil.length===0,'Use or waive remaining Devil rights');
    if(s.stage===5)assert(s.members.every(m=>m.picks.length<=45||s.jettisonWaivers.includes(m.id)),'Record remaining jettison choices');
    if(s.stage===6)assert(s.members.every(m=>m.picks.length===50),'Fill all lists before coronation');
    if(s.stage===7){assert(Object.values(s.vacantDiamonds).every(x=>x.length===0),'Replace vacant Diamonds');s.closed=true;}
    else s.stage++;
  }else if(action.type==='waive'&&[2,3].includes(s.stage)) {
    const r=s.rights.find(r=>r.id===action.rightId&&r.memberId===action.memberId);
    assert(r&&(r.kind==='Protection'?2:3)===s.stage&&!s.consumedRights.includes(r.id),'Current unspent right required');s.consumedRights.push(r.id);
  }else if(s.stage===2&&action.type==='protect') {
    spend(s,action.rightId,'Protection',action.memberId);protect(s,action.memberId,action.personKey);
  }else if(s.stage===3&&action.type==='steal') {
    spend(s,action.rightId,'Steal',action.memberId);steal(s,action.memberId,action.personKey);
  }else if(s.stage===4&&['protect','steal','waive'].includes(action.type)) {
    assert(s.devil.includes(action.memberId),'Devil right unavailable');
    if(action.type==='protect')protect(s,action.memberId,action.personKey);
    if(action.type==='steal')steal(s,action.memberId,action.personKey);
    s.devil=s.devil.filter(id=>id!==action.memberId);
  }else if(s.stage===5&&action.type==='waive') {
    member(s,action.memberId);assert(!s.jettisonWaivers.includes(action.memberId),'Jettison choice already recorded');s.jettisonWaivers.push(action.memberId);
  }else if(s.stage===5&&action.type==='jettison') {
    const m=member(s,action.memberId),p=m.picks.find(p=>key(p)===action.personKey);
    assert(!s.jettisonWaivers.includes(m.id)&&m.picks.length>45&&p&&!protectedInDraft(s,p,m.id)&&ageAt(p.born,torontoDay(s.at))<=100,'Jettison unavailable');
    s.jettisons.push({memberId:m.id,name:p.name,born:p.born,at:s.at,age:ageAt(p.born,torontoDay(s.at))});
    m.picks=m.picks.filter(p=>key(p)!==action.personKey);
  }else if(s.stage===6&&action.type==='select') {
    assert(nextDrafter(s)===action.memberId,'Snake draft turn mismatch');
    assert(person(action.selection)&&action.selection.born<=torontoDay(s.at)&&!s.deadPeople.includes(key(action.selection))&&!s.members.some(m=>m.picks.some(p=>key(p)===key(action.selection))),'Unavailable new selection');
    const m=member(s,action.memberId);m.picks.push({name:action.selection.name,born:action.selection.born,pick:emptySlot(m)});s.turn++;
  }else if(s.stage===7&&action.type==='crown') {
    const m=member(s,action.memberId),p=m.picks.find(p=>key(p)===action.personKey);
    assert(p&&s.vacantDiamonds[m.id].includes(action.slot),'Vacant Diamond and owned selection required');
    assert(![1,50].includes(p.pick)||p.pick===action.slot||s.vacantDiamonds[m.id].includes(p.pick),'Cannot move surviving Diamond');
    const other=m.picks.find(p=>p.pick===action.slot),old=p.pick;
    if(other)other.pick=old;p.pick=action.slot;s.vacantDiamonds[m.id]=s.vacantDiamonds[m.id].filter(n=>n!==action.slot);
  }else throw Error('Action is not valid at this draft stage');
  validateSelections(s.members);s.actions.push(structuredClone(action));return s;
}

export function jettisonPenalty(jettison,event) {
  if(jettison.age!==100||key(jettison)!==key(event)||event.status!=='calculated')return null;
  if(!instant(jettison.at))return hold('jettison-death-order-required');
  // Date prefixes refer to different zones. If an exact death instant exists,
  // compare it with the actual jettison instant, not an arbitrary UTC day.
  if(event.diedAt!=null){
    if(!instant(event.diedAt)||event.diedAt.slice(0,10)!==event.diedOn)
      return hold('jettison-death-order-required');
    if(Date.parse(event.diedAt)<=Date.parse(jettison.at))return null;
  }else{
    const jettisonDay=torontoDay(jettison.at);
    if(event.diedOn<jettisonDay)return null;
    // A source-local date through the next calendar day can still be before
    // this Toronto action in a distant time zone. Require exact death-time
    // evidence instead of awarding a penalty on an ambiguous date-only order.
    const nextDay=new Date(Date.parse(jettisonDay+'T00:00:00Z')+86400000).toISOString().slice(0,10);
    if(event.diedOn<=nextDay)return hold('jettison-death-order-required');
  }
  if(ageAt(event.born,event.diedOn)!==100)return null;
  return {memberId:jettison.memberId,points:-10,seasonYear:event.seasonYear,notificationEligible:false};
}
