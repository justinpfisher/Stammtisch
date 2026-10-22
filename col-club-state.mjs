/* Public CoL state: the GitHub register records draft actions, individual
 * Protection placements, corrected seasons and Birthday Buffet report dates.
 * The shared Sheet continues to supply existing awarded scores and pick lists.
 * This module does not award points, confirm deaths or activate a CoL rule version.
 */
const members = new Set(['fish', 'marc', 'matt', 'ken', 'jamie', 'jerome']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const isRecord = x => x && typeof x === 'object' && !Array.isArray(x);
const sameKeys = (x, allowed) => isRecord(x) && Object.keys(x).every(k => allowed.includes(k));
const validDate = x => datePattern.test(x ?? '') &&
  Number.isFinite(Date.parse(x+'T00:00:00Z')) &&
  new Date(x+'T00:00:00Z').toISOString().slice(0, 10) === x;
const validTimestamp = x => timestampPattern.test(x ?? '') && Number.isFinite(Date.parse(x));
const validName = x => typeof x === 'string' && x.trim().length > 0 && x.length <= 160;
export const celebrityKey = (name, born) =>
  `${String(name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()}:${born}`;

export function januaryHandover(year) {
  if (!Number.isInteger(year) || year < 2027 || year > 9998)
    throw new Error('Handover year must be 2027 or later');
  const firstDay = new Date(Date.UTC(year, 0, 1)).getUTCDay();
  const thirdFriday = 1 + (5 - firstDay + 7) % 7 + 14;
  const date = `${year}-01-${String(thirdFriday).padStart(2, '0')}`;
  // Ontario's January offset is UTC−05 under the current America/Toronto rules.
  return Object.freeze({date, local:date+'T20:00:00-05:00',
    utc:new Date(date+'T20:00:00-05:00').toISOString(), timeZone:'America/Toronto'});
}

function competitionYearAtInstant(epochMs) {
  if (!Number.isFinite(epochMs)) return null;
  const instant = new Date(epochMs);
  if (!Number.isFinite(instant.getTime())) return null;
  const localYear = Number(new Intl.DateTimeFormat('en-US',
    {year:'numeric', timeZone:'America/Toronto'}).format(instant));
  if (localYear < 2027 || localYear > 9998) return null;
  return epochMs < Date.parse(januaryHandover(localYear).utc) ? localYear - 1 : localYear;
}

export function competitionYearAt(value) {
  // A bare date cannot establish which side of the 8 p.m. handover a death
  // belongs to. Never invent the previous 2026 handover time.
  if (!validTimestamp(value)) return null;
  return competitionYearAtInstant(Date.parse(value));
}

// Dates normally establish the season. On changeover Friday, a genuinely
// verified death instant controls the 8 p.m. boundary. If the actual time is
// unknown, the Club assigns the death to the previous competition year by
// default; an authenticated member may correct it in the GitHub record.
// News publication times and Sheet first-report dates are not death times.
// Preserve already recorded pre-2027 historical allocations.
export function competitionYearForDeathDate(date, verifiedInstant = null) {
  if (!validDate(date)) return null;
  const year=Number(date.slice(0,4));
  if (year < 2027) return year;
  // Verified death time always uses Toronto's clock, even if a source in
  // another time zone records a different calendar day. The date-only
  // fallback retains the Club's previous-year default on handover Friday.
  const fromTime=competitionYearAtInstant(verifiedInstant);
  if (fromTime !== null) return fromTime;
  const cutoff=januaryHandover(year).date;
  return date <= cutoff ? year-1 : year;
}

// A clear member correction is recorded by an authenticated, attributable Git
// commit. Keep only the current corrected assignment here; Git history retains
// preceding values without duplicating an audit database or score ledger.
export function correctedCompetitionYear(event, clubState) {
  const correction=clubState?.seasonCorrections?.find(c =>
    celebrityKey(c.name,c.born)===celebrityKey(event.name,event.born) &&
    c.diedOn===event.diedOn);
  return correction?.competitionYear ?? null;
}

// Apply explicitly GitHub-recorded historical points corrections at display
// time, after a Sheet input import. Never edit the signed imported source or
// create a death event; attribution and earlier values remain in Git history.
export function applyPointsCorrections(data, clubState) {
  const changes=clubState?.pointsCorrections?.filter(c=>c.seasonYear===data.year) ?? [];
  if (!changes.length) return data;
  const result=structuredClone(data),affected=new Set();
  for (const change of changes) {
    const member=result.members.find(m=>m.id===change.memberId);
    const pick=member?.picks.find(p=>p.id===change.pickId);
    if (!pick || !pick.counted ||
        celebrityKey(pick.name,pick.born)!==celebrityKey(change.name,change.born))
      throw new Error('GitHub points correction does not match recorded selection');
    pick.points=change.points;
    affected.add(member.id);
  }
  for (const member of result.members) if (affected.has(member.id)) {
    const scored=member.picks.filter(p=>p.counted);
    if (scored.some(p=>!Number.isFinite(p.points)))
      throw new Error('Corrected standing contains invalid points');
    member.score=scored.reduce((total,p)=>total+p.points,0);
  }
  return result;
}

export function isJettisonEligible(pick, memberId, asOf, clubState = null) {
  if (!isRecord(pick) || !Number.isInteger(pick.pick) ||
      pick.pick < 1 || pick.pick > 50 || !validDate(pick.born) ||
      !validDate(asOf) || pick.born > asOf || pick.counted ||
      pick.dateOfPassing || pick.actualDeathDate || pick.dateSource?.dateOfPassing || pick.needsReview ||
      isProtectedPick(pick,memberId,clubState)) return false;
  const [by,bm,bd]=pick.born.split('-').map(Number);
  const [ay,am,ad]=asOf.split('-').map(Number);
  const age=ay-by-Number(am<bm || (am===bm && ad<bd));
  // An exactly-100-year-old is eligible; older celebrities cannot be
  // jettisoned. Any eventual special penalty still requires an actual action.
  return age <= 100;
}

export function readClubState(raw) {
  if (!sameKeys(raw, ['schemaVersion','yearHandover','birthdayBuffet','seasonCorrections','pointsCorrections','protectionPlacements','draftActions']) ||
      raw.schemaVersion !== 1) throw new Error('Unsupported Club register');
  const h=raw.yearHandover, b=raw.birthdayBuffet;
  if (!sameKeys(h,['month','week','weekday','localTime','timeZone']) ||
      h.month!==1 || h.week!==3 || h.weekday!=='Friday' || h.localTime!=='20:00' ||
      h.timeZone!=='America/Toronto') throw new Error('Club handover rule mismatch');
  if (!sameKeys(b,['dateSource','corrections']) ||
      b.dateSource!=='shared-spreadsheet-unless-corrected' || !Array.isArray(b.corrections) ||
      !Array.isArray(raw.seasonCorrections) || !Array.isArray(raw.pointsCorrections) || !Array.isArray(raw.protectionPlacements) || !Array.isArray(raw.draftActions) ||
      b.corrections.length>200 || raw.seasonCorrections.length>200 || raw.pointsCorrections.length>200 || raw.protectionPlacements.length>300 || raw.draftActions.length>500)
    throw new Error('Invalid Club register lists');
  const corrected = new Set(), placed = new Set();
  for (const c of b.corrections) {
    if (!sameKeys(c,['name','born','reportedOn']) || !validName(c.name) ||
        !validDate(c.born) || !validDate(c.reportedOn))
      throw new Error('Invalid Birthday Buffet correction');
    const id=celebrityKey(c.name,c.born);
    if (corrected.has(id)) throw new Error('Duplicate Birthday Buffet correction');
    corrected.add(id);
  }
  const pointIds=new Set();
  for(const correction of raw.pointsCorrections) {
    const prefix=String(correction.memberId)+'-';
    const row=Number(String(correction.pickId).slice(prefix.length));
    if (!sameKeys(correction,['seasonYear','memberId','pickId','name','born','points']) ||
        !Number.isInteger(correction.seasonYear) || correction.seasonYear<2026 ||
        !members.has(correction.memberId) || !validName(correction.name) ||
        !validDate(correction.born) ||
        typeof correction.pickId!=='string' ||
        !correction.pickId.startsWith(prefix) ||
        !Number.isInteger(row) || row<3 || row>9999 ||
        correction.pickId!==prefix+String(row) ||
        !Number.isInteger(correction.points) || correction.points< -1000 || correction.points>1000)
      throw new Error('Invalid GitHub points correction');
    const id=correction.seasonYear+':'+correction.pickId;
    if(pointIds.has(id))throw new Error('Duplicate GitHub points correction');
    pointIds.add(id);
  }
  const seasons = new Set();
  for (const c of raw.seasonCorrections) {
    if (!sameKeys(c,['name','born','diedOn','competitionYear']) ||
        !validName(c.name) || !validDate(c.born) || !validDate(c.diedOn) ||
        c.born > c.diedOn || !Number.isInteger(c.competitionYear))
      throw new Error('Invalid season correction');
    const dateYear=Number(c.diedOn.slice(0,4));
    // A narrowly scoped override of the Club's previous-year default.
    // Other historical/score corrections follow the authenticated source route.
    if (dateYear<2027 || c.diedOn!==januaryHandover(dateYear).date ||
        ![dateYear-1,dateYear].includes(c.competitionYear))
      throw new Error('Season correction must identify the January handover');
    const id=celebrityKey(c.name,c.born)+':'+c.diedOn;
    if (seasons.has(id)) throw new Error('Duplicate season correction');
    seasons.add(id);
  }
  for (const p of raw.protectionPlacements) {
    if (!sameKeys(p,['memberId','name','born','placedOn']) || !members.has(p.memberId) ||
        !validName(p.name) || !validDate(p.born) || !validDate(p.placedOn))
      throw new Error('Invalid Protection placement');
    const id=p.memberId+':'+celebrityKey(p.name,p.born);
    if (placed.has(id)) throw new Error('Duplicate lifelong Protection');
    placed.add(id);
  }
  for (const action of raw.draftActions) {
    if (!sameKeys(action,['seasonYear','stage','summary','recordedAt']) ||
        !Number.isInteger(action.seasonYear) || action.seasonYear<2026 ||
        !Number.isInteger(action.stage) || action.stage<1 || action.stage>7 ||
        !validName(action.summary) || !validTimestamp(action.recordedAt))
      throw new Error('Invalid draft record');
  }
  return raw;
}

export function firstReportDate(event, clubState) {
  const correction=clubState?.birthdayBuffet?.corrections?.find(x =>
    celebrityKey(x.name,x.born) === celebrityKey(event.name,event.born));
  return correction?.reportedOn ?? event.discoveredOn ?? null;
}

export function isProtectedPick(pick, memberId, clubState, deathDate = null) {
  // The designated Blue/Brown Diamond slots are protected without an extra
  // register entry. A previously confirmed Blood Diamond also remains protected.
  if (pick.pick===1 || pick.pick===50 || pick.bloodDiamond===true) return true;
  return Boolean(clubState?.protectionPlacements?.some(p =>
    p.memberId===memberId && celebrityKey(p.name,p.born)===celebrityKey(pick.name,pick.born) &&
    (!deathDate || p.placedOn<=deathDate)));
}
