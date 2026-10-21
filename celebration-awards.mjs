import { ageAt, basePoints, cavalcadeRule, copycatRule } from './celebration-rules.mjs';
import {firstReportDate, isProtectedPick, competitionYearForDeathDate, isJettisonEligible} from './col-club-state.mjs';

const birthdays = { marc: '03-26', jerome: '05-09', matt: '06-25', fish: '07-06', ken: '07-20', jamie: '09-19' };
const birthdayNames = { marc:'Marc', jerome:'Jerome', matt:'Matt', fish:'Justin', ken:'Ken', jamie:'Jamie' };
const metricMonths = ['Renewal','Awaken','Bloom','Thrive','Radiate','Sustain','Gather','Reflect','Diminish','Restore'];
const gregorianMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const isPick = p => Number.isInteger(p.pick) && p.pick >= 1 && p.pick <= 50;
const identity = p => `${p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()}:${p.born}`;
const unique = values => [...new Set(values)];
const daysBetween = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names = entries => unique(entries.map(x => x.name)).join(' & ');
const dateText = date => new Intl.DateTimeFormat('en-CA', { month:'short', day:'numeric', timeZone:'UTC' }).format(new Date(`${date}T00:00:00Z`));

function deathInstant(value, date) {
  // Require the actual date and an explicit offset; never infer midnight or use
  // the reader's timezone to decide who died second.
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value ?? '');
  return match && match[1] === date && validDate(date) ? Date.parse(value) : null;
}

// Calendar labels are supplementary display only. The recorded Gregorian dates
// remain authoritative for eligibility; convert each occurrence's year because
// after February a leap year changes its Metric Calendar ordinal.
export function metricBirthdayLabel(year, monthDay) {
  if (!Number.isInteger(year) || year < 100 || year > 9999 || !/^\d{2}-\d{2}$/.test(monthDay || '')) return null;
  const gregorian = `${year}-${monthDay}`;
  if (!validDate(gregorian)) return null;
  let ordinal = 1 + Math.floor((Date.parse(gregorian+'T00:00:00Z')-Date.UTC(year,0,1))/86400000);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  for (let index=0; index<metricMonths.length; index++) {
    // Metric month 10 has a final day 38 in Gregorian leap years.
    // Gregorian February 29 remains an ordinary metric date; Metric Leap Day
    // is December 31 of that leap year, not February 29.
    const length = index === 9 && leapYear ? 38 : index % 2 ? 37 : 36;
    if (ordinal <= length) return `${metricMonths[index]} ${ordinal}`;
    ordinal -= length;
  }
  return null;
}

export function birthdayCalendar(year) {
  return Object.entries(birthdays).map(([id, monthDay]) => {
    const [month, day] = monthDay.split('-').map(Number);
    return {
      member:birthdayNames[id], metric:metricBirthdayLabel(year,monthDay),
      gregorian:`${gregorianMonths[month-1]} ${day}`
    };
  });
}

// The legacy dateOfPassing field is a group discovery date, except where
// dateSource supplies an independently sourced actual death date.
export function awardEvents(data, clubState = null) {
  const grouped = new Map();
  for (const member of data.members) for (const pick of member.picks) {
    if (!pick.counted && !pick.dateOfPassing && !pick.actualDeathDate && !pick.discoveryDate) continue;
    if (!isPick(pick) && pick.pick !== 'BB') continue;
    const key = identity(pick);
    if (!grouped.has(key)) grouped.set(key, { key, name:pick.name, born:pick.born, entries:[] });
    grouped.get(key).entries.push({ ...pick, memberId:member.id, memberName:member.name });
  }
  return [...grouped.values()].map(event => {
    const discoveries = unique(event.entries.map(p => p.discoveryDate ?? (p.dateSource ? null : p.dateOfPassing)).filter(validDate));
    const deaths = unique(event.entries.map(p => p.actualDeathDate ?? p.dateSource?.dateOfPassing).filter(validDate));
    const discoveredOn = discoveries.length === 1 ? discoveries[0] : null;
    const diedOn = deaths.length === 1 ? deaths[0] : null;
    const deathTimes = unique(event.entries.filter(p => p.actualDeathAt != null).map(p => deathInstant(p.actualDeathAt, diedOn)));
    const diedAt = deathTimes.length === 1 && Number.isFinite(deathTimes[0]) ? deathTimes[0] : null;
    const explicitAges = unique(event.entries.map(p => p.ageAtDeath).filter(n => Number.isInteger(n) && n >= 0));
    const confirmedAge = explicitAges.length === 1 ? explicitAges[0] : ageAt(event.born, diedOn);
    const age = explicitAges.length > 1 || deaths.length > 1 ? null : confirmedAge ?? ageAt(event.born, discoveredOn);
    const at = diedOn || discoveredOn;
    const inSeason = Boolean(at && at <= data.asOf && competitionYearForDeathDate(at,diedAt) === data.year);
    return { ...event, discoveredOn, reportedOn:firstReportDate({...event, discoveredOn},clubState), diedOn, diedAt, at, age, ageConfirmed:confirmedAge !== null,
      ageInDays:validDate(event.born) && diedOn && diedOn >= event.born ? daysBetween(event.born,diedOn) : null,
      allocationDecision:event.entries.find(p => p.allocationDecision)?.allocationDecision ?? null,
      inSeason, dateConflict:discoveries.length > 1 || deaths.length > 1,
      owners:event.entries.filter(isPick),
      diamond:event.entries.some(p => isProtectedPick(p,p.memberId,clubState,diedOn)),
      allocations:event.entries.filter(p => p.counted).map(p => ({id:p.memberId, name:p.memberName, points:p.points})) };
  });
}

export function calculateAwards(data, settings = data.awardSettings ?? {}, policy = {}, clubState = null) {
  const members = data.members;
  const allEvents = awardEvents(data, clubState);
  const events = allEvents.filter(x => x.inSeason && !x.dateConflict);
  const undated = allEvents.filter(x => !x.at || x.dateConflict).length;
  // The Club's competition ends at the recorded first-gathering handover, not
  // December 31. Until the 8 p.m. January handover and the Sheet's January gap are
  // reconciled, this public draft preview must not certify a final winner.
  const final = false;
  const leader = members.filter(m => m.score === Math.max(...members.map(m => m.score)));
  const lowest = members.filter(m => m.score === Math.min(...members.map(m => m.score)));
  const ageEvents = events.filter(x => x.age !== null && x.owners.length);
  const minAge = ageEvents.length ? Math.min(...ageEvents.map(x => x.age)) : null;
  const youngestByYear = ageEvents.filter(x => x.age === minAge);
  const canCompareDays = youngestByYear.length > 1 && youngestByYear.every(x => x.ageInDays !== null);
  const youngest = canCompareDays ? youngestByYear.filter(x => x.ageInDays === Math.min(...youngestByYear.map(x => x.ageInDays))) : youngestByYear;
  const youngestOwners = unique(youngest.flatMap(x => x.owners.map(p => p.memberId)));
  const unconfirmedAges = events.filter(x => !x.ageConfirmed).length;
  // A semantic amendment has no effect until the independent verified release
  // supplies the matching award policy; the baseline has no such benefit.
  const oldestAgeVerified = x => Number.isInteger(x.age) && x.age === ageAt(x.born,x.diedOn) && x.entries.every(p => p.ageAtDeath == null || p.ageAtDeath === x.age);
  const oldestCandidates = policy.oldestDeathSteal === true
    ? events.filter(x => x.owners.length && x.diedOn && x.ageConfirmed && oldestAgeVerified(x) && Number.isFinite(x.ageInDays)) : [];
  const oldestAgeDays = oldestCandidates.length ? Math.max(...oldestCandidates.map(x => x.ageInDays)) : null;
  const oldestEvents = oldestCandidates.filter(x => x.ageInDays === oldestAgeDays);
  const oldestOwners = unique(oldestEvents.flatMap(x => x.owners.map(p => p.memberId)));
  const oldestIncomplete = undated > 0 || events.some(x => x.owners.length && (!x.diedOn || !x.ageConfirmed || !oldestAgeVerified(x) || !Number.isFinite(x.ageInDays)));
  // A tie-breaking rule was not supplied. Show contenders but do not
  // invent an award when distinct members share the oldest verified age.
  const oldestTieUnresolved = oldestOwners.length > 1;
  const oldestFinal = final && !oldestIncomplete && !oldestTieUnresolved;
  const cards = [{ id:'pool-prize', title:'The $100 prize', status:leader.length > 1 ? (final ? 'Shared winners' : 'Tied on points') : final ? 'Winner' : 'Leading',
    value:names(leader), description:`${leader[0]?.score ?? 0} points · ${final ? 'Final register' : 'Recorded so far'}`,
    details:leader.length > 1 ? ['Tied winners share the $100 prize.'] : ['The year changes at 8 p.m. Toronto time on the third Friday of January. Current points remain provisional until that handover is reconciled with the register.'] },
  { id:'youngest', title:'Youngest celebrity', status:youngest.length ? 'Provisional contenders' : 'No dated records',
    value:youngest.length ? names(members.filter(m => youngestOwners.includes(m.id))) : 'No contender yet',
    description:minAge === null ? 'One Blood Diamond at the next draft.' : `Youngest recorded age: ${minAge} · One Blood Diamond at the next draft`,
    details:youngest.map(x => `${x.name} · ${x.age}${x.ageConfirmed ? '' : ' (age estimated at discovery)'}${x.ageInDays === null ? '' : ` · ${x.ageInDays.toLocaleString('en-CA')} days old`} · ${names(x.owners.map(p => ({name:p.memberName})))}`).concat(
      canCompareDays ? ['Equal whole-year ages are compared by age in days, using birth and actual death dates.'] : youngestByYear.length > 1 ? ['The group uses age in days to break a whole-year tie. Actual death dates are needed to complete that comparison.'] : [],
      canCompareDays && youngestOwners.length > 1 ? ['Still tied at the day level; the group must resolve this exact tie.'] : [],
      unconfirmedAges || undated ? ['Actual ages at death must be confirmed before this award is settled.'] : []) },
  { id:'devils-share', title:'Devil’s Share', status:final ? 'Eligible' : lowest.length > 1 ? 'Tied on points' : 'If the year ended now',
    value:names(lowest), description:`${lowest[0]?.score ?? 0} points · Choose one Steal or one Blood Diamond`,
    details:lowest.length > 1 ? ['Every player tied for the lowest score receives Devil’s Share and chooses their own Steal or Blood Diamond.'] : ['Based on the lowest score for the year. The player makes the choice at the draft.'] }];
  if (policy.oldestDeathSteal === true) cards.push({
    id:'oldest', title:'Oldest celebrity',
    status:oldestAgeDays === null ? 'Awaiting verified dates' : oldestTieUnresolved ? 'Tie unresolved' : oldestFinal ? 'Eligible at the next draft' : 'Provisional contenders',
    value:oldestOwners.length ? names(members.filter(m => oldestOwners.includes(m.id))) : 'No confirmed contender yet',
    description:oldestAgeDays === null ? 'One Steal at the next draft.' : 'Oldest verified age: '+oldestEvents[0].age+' years · One Steal at the next draft',
    details:oldestEvents.map(x => x.name+' · '+x.ageInDays.toLocaleString('en-CA')+' days old · '+names(x.owners.map(p => ({name:p.memberName}))))
      .concat(oldestTieUnresolved ? ['An exact tie remains unresolved; no Steal is final until the club records a tie decision.'] : [],
        oldestIncomplete ? ['Some dates or ages remain unverified; final eligibility is not yet established.'] : [])
  });

  // Future semantic releases may retire extra age-100 draft privileges.
  // No current signed rule supplies this policy. It is deliberately dormant
  // unless a separately verified, effective version supplies its timestamp.
  // A passing on the UTC publication date cannot be ordered against a
  // timestamp using only a death DATE: show that benefit as unconfirmed.
  const centuryRetirement = typeof policy.age100PrivilegeEndsAt === 'string' &&
    /^\d{4}-\d\d-\d\dT/.test(policy.age100PrivilegeEndsAt) &&
    Number.isFinite(Date.parse(policy.age100PrivilegeEndsAt))
      ? policy.age100PrivilegeEndsAt.slice(0,10) : null;
  const draft = [...members].sort((a,b) => a.score-b.score || a.name.localeCompare(b.name)).map(member => {
    const owned = events.filter(x => x.owners.some(p => p.memberId === member.id));
    const benefits = [];
    for (const event of owned) {
      const slots = event.owners.filter(p => p.memberId === member.id);
      const blue = slots.some(p => p.pick === 1), brown = slots.some(p => p.pick === 50);
      const birthday = !event.diamond && Object.values(birthdays).includes(event.reportedOn?.slice(5));
      if (blue) benefits.push({ kind:'Steal', event:event.name, at:event.diedOn, confirmed:Boolean(event.diedOn), reason:'Blue Diamond' });
      if (brown) benefits.push({ kind:'Blood Diamond', event:event.name, at:event.diedOn, confirmed:Boolean(event.diedOn), reason:'Brown Diamond' });
      if (event.age === 100 && !birthday) {
        // Only a STRICTLY later death date is safely prospective. The
        // date-of-release case needs actual-time evidence and stays a
        // provisional benefit; never retract historical awarded privileges.
        const retired = centuryRetirement && event.diedOn && event.diedOn > centuryRetirement;
        const boundaryUncertain = centuryRetirement && event.diedOn === centuryRetirement;
        if (!retired) benefits.push({ kind:brown ? 'Blood Diamond' : 'Steal', event:event.name, at:event.diedOn,
          confirmed:!boundaryUncertain && event.ageConfirmed && Boolean(event.diedOn) && (event.diamond || Boolean(event.discoveredOn)),
          reason:boundaryUncertain ? 'Age-100 rule-change date needs individual verification' : brown ? 'Brown Diamond at 100: second Blood Diamond' : blue ? 'Blue Diamond at 100: second Steal' : 'Age 100' });
      }
    }
    if (policy.oldestDeathSteal === true && oldestOwners.includes(member.id)) {
      const matching = oldestEvents.filter(x => x.owners.some(p => p.memberId === member.id));
      benefits.push({kind:'Steal',event:matching.map(x => x.name).join(' & '),at:matching[0]?.diedOn,
        confirmed:oldestFinal,reason:'Oldest celebrity death of the year'});
    }
    const rank = 1 + members.filter(m => m.score < member.score).length;
    const replacements = owned.flatMap(x => x.owners.filter(p => p.memberId === member.id).map(p => ({pick:p.pick, name:x.name})));
    const eligibleJettisons=member.picks.filter(p=>isJettisonEligible(p,member.id,data.asOf,clubState)).length;
    return { id:member.id, name:member.name, score:member.score, rank,
      tied:members.some(m => m.id !== member.id && m.score === member.score), benefits,
      replacements, vacancies:replacements.length,
      optionalJettisons:Math.min(Math.max(0,5-replacements.length),eligibleJettisons),
      youngest:youngestOwners.includes(member.id), devil:lowest.some(m => m.id === member.id) };
  });
  const dated = events.filter(x => x.discoveredOn && x.discoveredOn.slice(0,4) === String(data.year) && x.discoveredOn <= data.asOf);
  const discoveryMissing = events.filter(x => !x.discoveredOn).length + undated;
  const dates = unique(dated.map(x => x.discoveredOn)).sort();
  const gaps = dates.slice(1).map((end,i) => ({ start:dates[i], end, days:daysBetween(dates[i],end) }));
  const longest = gaps.length ? Math.max(...gaps.map(g => g.days)) : null;
  const recordGaps = gaps.filter(g => g.days === longest);
  for (const [id,title,edge] of [['rainmaker','Rainmaker','end'],['droughtmaker','Droughtmaker','start']]) {
    const holders = unique(recordGaps.flatMap(g => dated.filter(x => x.discoveredOn === g[edge]).flatMap(x => x.owners.map(p => p.memberId))));
    cards.push({ id, title, status:'Provisional badge candidate', value:holders.length ? names(members.filter(m => holders.includes(m.id))) : 'No completed gap yet',
      description:longest === null ? 'Needs at least two discovery dates.' : `${longest} days between discoveries · Longest completed gap this year`,
      details:recordGaps.map(g => `${dateText(g.start)} → ${dateText(g.end)}`).concat(
        dates.length ? [`Current gap: ${daysBetween(dates.at(-1),data.asOf)} days since ${dateText(dates.at(-1))}; still open.`] : [],
        discoveryMissing ? [`${discoveryMissing} passing(s) lack a group discovery date; the longest gap may change.`] : [],
        ['Uses group discovery dates within the calendar year, as confirmed by the group.']) });
  }
  const calamity = members.map(member => ({ ...member,
    qualifying:events.filter(event => event.owners.some(p => p.memberId === member.id && p.counted && Number.isFinite(p.points) && p.points < 9)).length
  }));
  const eligible = calamity.filter(m => m.qualifying >= 3);
  const mostDeaths = eligible.length ? Math.max(...eligible.map(m => m.qualifying)) : null;
  const calamityLeaders = eligible.filter(m => m.qualifying === mostDeaths);
  cards.push({ id:'calamity', title:'Cavalcade of Calamity', status:calamityLeaders.length > 1 ? 'Tied badge candidates' : eligible.length ? 'Provisional badge candidate' : 'No one qualifies yet',
    value:names(calamityLeaders) || 'Three low-point deaths needed',
    description:cavalcadeRule,
    details:calamity.map(m => `${m.name}: ${m.qualifying} qualifying deaths${m.qualifying < 3 ? ' · minimum 3 needed' : ''}`).concat(
      ['Counts awarded deaths on the player’s numbered list. Exactly 9 points does not qualify. Birthday-only entries are excluded.'],
      calamityLeaders.length > 1 ? ['The highest count is tied; resolve the tie at the cottage badge ceremony.'] : []) });
  const deathDates = new Map();
  for (const event of events.filter(event => event.diedOn && event.owners.length)) {
    if (!deathDates.has(event.diedOn)) deathDates.set(event.diedOn, []);
    deathDates.get(event.diedOn).push(event);
  }
  const copycatDays = [...deathDates].filter(([,deaths]) => deaths.length > 1 && unique(deaths.flatMap(event => event.owners.map(p => p.memberId))).length > 1);
  const copycatRecipients = [];
  const copycatDetails = copycatDays.map(([date,deaths]) => {
    const description = `${dateText(date)}: ${deaths.map(event => `${event.name} (${names(event.owners.map(p => ({ name:p.memberName })))})`).join(' · ')}`;
    if (deaths.length !== 2 || deaths.some(event => unique(event.owners.map(p => p.memberId)).length !== 1)) return `${description}. Multiple deaths or shared selections need group review.`;
    if (deaths.some(event => event.diedAt === null)) return `${description}. Actual times of death need confirmation; no recipient selected.`;
    if (deaths[0].diedAt === deaths[1].diedAt) return `${description}. Recorded times are equal; no second passing established.`;
    const second = deaths[0].diedAt > deaths[1].diedAt ? deaths[0] : deaths[1];
    copycatRecipients.push(second.owners[0].memberId);
    return `${description}. ${second.name} died second: ${second.owners[0].memberName} is the Copycat candidate.`;
  });
  const missingDeathDates = allEvents.filter(event => event.owners.length && (!event.diedOn || event.dateConflict)).length;
  cards.push({ id:'copycat', title:'Copycat', status:copycatRecipients.length ? 'Provisional badge candidate' : copycatDays.length ? 'Death times or group review needed' : missingDeathDates ? 'Actual death dates needed' : 'No same-day matches',
    value:copycatRecipients.length ? names(members.filter(member => copycatRecipients.includes(member.id))) : copycatDays.length ? 'Recipient unconfirmed' : 'No confirmed match yet',
    description:copycatRule,
    details:copycatDetails.concat(['Matching list positions and discovery dates do not count. Unknown or equal death times cannot establish who died second.'],
      missingDeathDates ? [`${missingDeathDates} passing(s) still need confirmed actual death dates; the preview may be incomplete.`] : []) });
  cards.push({id:'providence', title:'Hand of Providence', status:'By nomination', value:'Chosen by the group', description:'A passing that narrowly avoids a loss or reduction in points.', details:['A date close to a birthday does not establish this award. The group nominates the recipient.']},
    {id:'summit', title:'Summit in Purgatory', status:'Event confirmation needed', value:'Chosen by the group', description:'Multiple CoL deaths in a mass casualty event.', details:['Matching dates alone do not establish a shared event.']});
  const birthdayDisplay = birthdayCalendar(data.year).map(b => `${b.member}: ${b.metric} (${b.gregorian})`).join(' · ');
  const buffet = events.filter(x => !x.diamond && x.reportedOn && Object.values(birthdays).includes(x.reportedOn.slice(5))).map(event => {
    const recipient = members.find(m => birthdays[m.id] === event.reportedOn.slice(5));
    const expected = event.ageConfirmed ? basePoints(event.age) : null;
    return { name:event.name, recipient:recipient?.name, date:event.reportedOn, expected, allocations:event.allocations, decision:event.allocationDecision };
  });
  cards.push({id:'birthday-buffet', title:'Birthday Buffet', status:buffet.length ? 'Recorded birthday dates' : 'No birthday dates noted',
    value:buffet.length ? names(buffet.map(x => ({name:x.recipient}))) : 'No match noted', description:'The Club uses the date recorded in its shared spreadsheet as the first WhatsApp report date, unless corrected.',
    details:buffet.map(x => `${x.name} · ${dateText(x.date)} · Possible birthday member: ${x.recipient}. Recorded allocation: ${x.allocations.map(a => `${a.name} ${a.points}`).join(', ') || 'none'}${x.decision ? `. ${x.decision}` : x.expected === null ? '. Age at death needs confirmation.' : `. Indicative age-based value: ${x.expected} points. The Sheet's recorded awards remain authoritative.`}`).concat(['The spreadsheet date is accepted by default unless a member corrects it. Previous Club awards remain as recorded; this preview does not independently award points.'], [`Birthday register (${data.year}, Metric first): ${birthdayDisplay}.`])});
  return { year:data.year, asOf:data.asOf, final, cards, draft, events, undated,
    officialAwardCards:policy.oldestDeathSteal === true ? 4 : 3 };
}

export function awardsMarkup(model) {
  return model.cards.map(card => `<article class="award-card" id="award-${e(card.id)}"><p class="award-status">${e(card.status)}</p><h3>${e(card.title)}</h3><p class="award-holder">${e(card.value)}</p><p class="award-description">${e(card.description)}</p>${card.details.length ? `<details><summary>How this is worked out <span aria-hidden="true">+</span></summary><ul>${card.details.map(line => `<li>${e(line)}</li>`).join('')}</ul></details>` : ''}</article>`).join('');
}

// Protections are placed before regular Steals. Within the Steal stage the
// actual date of death determines the order, including the oldest-death award.
// Date-only same-day ties between distinct passings remain expressly unsettled.
export function orderedDraftBenefits(benefits) {
  const stage=b=>b.kind==='Blood Diamond'?2:b.kind==='Steal'?3:4;
  const ordered=benefits.map((item,index)=>({item,index})).sort((a,b)=>
    stage(a.item)-stage(b.item) ||
    (a.item.at??'9999-12-31').localeCompare(b.item.at??'9999-12-31') ||
    a.index-b.index);
  return ordered.map(({item},index)=>({
    ...item,
    sameDayOrderUnknown:item.kind==='Steal' && Boolean(item.at) &&
      ordered.some((other,i)=>i!==index && other.item.kind==='Steal' &&
        other.item.at===item.at && other.item.event!==item.event)
  }));
}

export function draftMarkup(model) {
  return model.draft.map(member => `<article class="draft-card"><h3><a href="#the-lists" data-member-link="${e(member.id)}">${e(member.name)}</a></h3><p class="draft-position">${member.tied ? 'Tied at' : 'Pick'} ${member.rank} · ${member.score} points${member.tied ? ' · Rock, paper, scissors decides order' : ''}</p><ul>${orderedDraftBenefits(member.benefits).map(b => `<li><strong>${e(b.kind)}${b.confirmed ? '' : ' to confirm'}</strong> · ${e(b.event)} (${e(b.reason)})${b.sameDayOrderUnknown ? ' · Same-date order needs confirmation' : ''}</li>`).join('')}${member.youngest ? '<li>Youngest-death Blood Diamond contender</li>' : ''}${member.devil ? '<li>Devil’s Share contender: choose a Steal or Blood Diamond</li>' : ''}${!member.benefits.length && !member.youngest && !member.devil ? '<li>No draft benefit indicated yet</li>' : ''}</ul><p>${member.vacancies} listed ${member.vacancies === 1 ? 'passing' : 'passings'} to replace · Up to ${member.optionalJettisons} eligible optional jettisons to make up to five spaces.</p></article>`).join('');
}
