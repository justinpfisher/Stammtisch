import { ageAt, basePoints } from './celebration-rules.mjs';

const birthdays = { marc: '03-26', jerome: '05-09', matt: '06-25', fish: '07-06', ken: '07-20', jamie: '09-19' };
const isPick = p => Number.isInteger(p.pick) && p.pick >= 1 && p.pick <= 50;
const identity = p => `${p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()}:${p.born}`;
const unique = values => [...new Set(values)];
const daysBetween = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names = entries => unique(entries.map(x => x.name)).join(' & ');
const dateText = date => new Intl.DateTimeFormat('en-CA', { month:'short', day:'numeric', timeZone:'UTC' }).format(new Date(`${date}T00:00:00Z`));

// The legacy dateOfPassing field is a group discovery date, except where
// dateSource supplies an independently sourced actual death date.
export function awardEvents(data) {
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
    const explicitAges = unique(event.entries.map(p => p.ageAtDeath).filter(n => Number.isInteger(n) && n >= 0));
    const confirmedAge = explicitAges.length === 1 ? explicitAges[0] : ageAt(event.born, diedOn);
    const age = explicitAges.length > 1 || deaths.length > 1 ? null : confirmedAge ?? ageAt(event.born, discoveredOn);
    const at = diedOn || discoveredOn;
    const inSeason = Boolean(at && at.slice(0,4) === String(data.year) && at <= data.asOf);
    return { ...event, discoveredOn, diedOn, at, age, ageConfirmed:confirmedAge !== null,
      inSeason, dateConflict:discoveries.length > 1 || deaths.length > 1,
      owners:event.entries.filter(isPick),
      diamond:event.entries.some(p => p.pick === 1 || p.pick === 50 || p.bloodDiamond === true),
      allocations:event.entries.filter(p => p.counted).map(p => ({id:p.memberId, name:p.memberName, points:p.points})) };
  });
}

export function calculateAwards(data, settings = data.awardSettings ?? {}) {
  const members = data.members;
  const allEvents = awardEvents(data);
  const events = allEvents.filter(x => x.inSeason && !x.dateConflict);
  const undated = allEvents.filter(x => !x.at || x.dateConflict).length;
  // Finishing the calendar year never finalizes an old or incomplete snapshot.
  const final = settings.finalizedYear === data.year && data.asOf >= `${data.year}-12-31`;
  const leader = members.filter(m => m.score === Math.max(...members.map(m => m.score)));
  const lowest = members.filter(m => m.score === Math.min(...members.map(m => m.score)));
  const ageEvents = events.filter(x => x.age !== null && x.owners.length);
  const minAge = ageEvents.length ? Math.min(...ageEvents.map(x => x.age)) : null;
  const youngest = ageEvents.filter(x => x.age === minAge);
  const youngestOwners = unique(youngest.flatMap(x => x.owners.map(p => p.memberId)));
  const unconfirmedAges = events.filter(x => !x.ageConfirmed).length;
  const cards = [{ id:'pool-prize', title:'The $100 prize', status:leader.length > 1 ? 'Tied on points' : final ? 'Winner' : 'Leading',
    value:names(leader), description:`${leader[0]?.score ?? 0} points · ${final ? 'Final register' : 'Year to date'}`,
    details:leader.length > 1 ? ['The rules do not specify a tie-break.'] : ['The highest score from January 1 to December 31 wins.'] },
  { id:'youngest', title:'Youngest celebrity', status:youngest.length ? 'Provisional contenders' : 'No dated records',
    value:youngest.length ? names(members.filter(m => youngestOwners.includes(m.id))) : 'No contender yet',
    description:minAge === null ? 'One Blood Diamond at the next draft.' : `Youngest recorded age: ${minAge} · One Blood Diamond at the next draft`,
    details:youngest.map(x => `${x.name} · ${x.age}${x.ageConfirmed ? '' : ' (age estimated at discovery)'} · ${names(x.owners.map(p => ({name:p.memberName})))}`).concat(
      youngestOwners.length > 1 ? ['Tied at the same whole-year age; a tie-break needs the group’s decision.'] : [],
      unconfirmedAges || undated ? ['Actual ages at death must be confirmed before this award is settled.'] : []) },
  { id:'devils-share', title:'Devil’s Share', status:lowest.length > 1 ? 'Tied on points' : final ? 'Eligible' : 'If the year ended now',
    value:names(lowest), description:`${lowest[0]?.score ?? 0} points · Choose one Steal or one Blood Diamond`,
    details:lowest.length > 1 ? ['The group needs to resolve the tie before assigning this benefit.'] : ['Based on the lowest score for the year. The player makes the choice at the draft.'] }];

  const draft = [...members].sort((a,b) => a.score-b.score || a.name.localeCompare(b.name)).map(member => {
    const owned = events.filter(x => x.owners.some(p => p.memberId === member.id));
    const benefits = [];
    for (const event of owned) {
      const slots = event.owners.filter(p => p.memberId === member.id);
      const blue = slots.some(p => p.pick === 1), brown = slots.some(p => p.pick === 50);
      const birthday = !event.diamond && Object.values(birthdays).includes(event.discoveredOn?.slice(5));
      if (blue) benefits.push({ kind:'Steal', event:event.name, at:event.diedOn, confirmed:Boolean(event.diedOn), reason:'Blue Diamond' });
      if (brown) benefits.push({ kind:'Blood Diamond', event:event.name, at:event.diedOn, confirmed:Boolean(event.diedOn), reason:'Brown Diamond' });
      if (event.age === 100 && !birthday) {
        if (blue) benefits.push({ kind:'Review', event:event.name, reason:'Blue Diamond died at 100: confirm whether the two Steal triggers stack.', confirmed:false });
        else benefits.push({ kind:'Steal', event:event.name, at:event.diedOn,
          confirmed:event.ageConfirmed && Boolean(event.diedOn) && (event.diamond || Boolean(event.discoveredOn)), reason:'Age 100' });
      }
    }
    const rank = 1 + members.filter(m => m.score < member.score).length;
    const replacements = owned.flatMap(x => x.owners.filter(p => p.memberId === member.id).map(p => ({pick:p.pick, name:x.name})));
    return { id:member.id, name:member.name, score:member.score, rank,
      tied:members.some(m => m.id !== member.id && m.score === member.score), benefits,
      replacements, vacancies:replacements.length,
      optionalJettisons:Math.max(0,5-replacements.length), youngest:youngestOwners.includes(member.id), devil:lowest.some(m => m.id === member.id) };
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
        ['Uses group discovery dates within the calendar year. Button criteria still need the group’s confirmation.']) });
  }
  const calamity = members.map(member => {
    const picks = events.flatMap(x => x.owners.filter(p => p.memberId === member.id && p.counted));
    const low = picks.filter(p => p.points <= 9);
    const sample = settings.calamityAverage === 'low-only' ? low : picks;
    return { ...member, qualifying:low.length, average:sample.length ? sample.reduce((sum,p) => sum+p.points,0)/sample.length : null };
  });
  const eligible = calamity.filter(m => m.qualifying >= 3);
  const lowestAverage = eligible.length ? Math.min(...eligible.map(m => m.average)) : null;
  cards.push({ id:'calamity', title:'Cavalcade of Calamity', status:eligible.length ? 'Provisional badge candidate' : 'No one qualifies yet',
    value:eligible.length ? names(eligible.filter(m => m.average === lowestAverage)) : 'Three low-point deaths needed',
    description:'At least three deaths worth 9 points or less.',
    details:calamity.map(m => `${m.name}: ${m.qualifying}/3 qualifying deaths${m.average === null ? '' : ` · ${m.average.toFixed(1)} average points`}`).concat(
      [`Average uses ${settings.calamityAverage === 'low-only' ? 'only qualifying low-point deaths' : 'all awarded deaths on the player’s numbered list'}. Birthday-only entries are excluded.`]) });
  const slots = new Map();
  for (const event of events) for (const owner of event.owners) {
    if (!slots.has(owner.pick)) slots.set(owner.pick,[]);
    slots.get(owner.pick).push({name:owner.memberName, id:owner.memberId, celebrity:event.name});
  }
  const matches = [...slots].filter(([,entries]) => unique(entries.map(p => p.id)).length > 1);
  cards.push({ id:'copycat', title:'Copycat', status:'Matches for group review', value:matches.length ? `${matches.length} matching pick positions` : 'No matching positions',
    description:'Recorded passings in the same numbered slot on different lists.',
    details:matches.map(([slot,picks]) => `#${slot}: ${picks.map(p => `${p.name} (${p.celebrity})`).join(' · ')}`).concat(['These are candidates; confirm the intended meaning of “same CoL pick position” before awarding the button.']) });
  cards.push({id:'providence', title:'Hand of Providence', status:'By nomination', value:'Chosen by the group', description:'A passing that narrowly avoids a loss or reduction in points.', details:['A date close to a birthday does not establish this award. The group nominates the recipient.']},
    {id:'summit', title:'Summit in Purgatory', status:'Event confirmation needed', value:'Chosen by the group', description:'Multiple CoL deaths in a mass casualty event.', details:['Matching dates alone do not establish a shared event.']});
  const buffet = events.filter(x => !x.diamond && x.discoveredOn && Object.values(birthdays).includes(x.discoveredOn.slice(5))).map(event => {
    const recipient = members.find(m => birthdays[m.id] === event.discoveredOn.slice(5));
    const expected = event.ageConfirmed ? basePoints(event.age) : null;
    return { name:event.name, recipient:recipient?.name, date:event.discoveredOn, expected, allocations:event.allocations };
  });
  cards.push({id:'birthday-buffet', title:'Birthday Buffet', status:buffet.length ? 'Recorded birthday matches' : 'No dated matches',
    value:buffet.length ? names(buffet.map(x => ({name:x.recipient}))) : 'No match yet', description:'Uses the group’s discovery date. Diamonds are excluded.',
    details:buffet.map(x => `${x.name} · ${dateText(x.date)} · Birthday: ${x.recipient}. Recorded allocation: ${x.allocations.map(a => `${a.name} ${a.points}`).join(', ') || 'none'}${x.expected === null ? '. Age at death needs confirmation.' : `. Rule value: ${x.expected} points.`}`).concat(buffet.length ? ['Birthday matches are flagged for review; recorded scores are not reassigned automatically.'] : [])});
  return { year:data.year, asOf:data.asOf, final, cards, draft, events, undated };
}

export function awardsMarkup(model) {
  return model.cards.map(card => `<article class="award-card" id="award-${e(card.id)}"><p class="award-status">${e(card.status)}</p><h3>${e(card.title)}</h3><p class="award-holder">${e(card.value)}</p><p class="award-description">${e(card.description)}</p>${card.details.length ? `<details><summary>How this is worked out <span aria-hidden="true">+</span></summary><ul>${card.details.map(line => `<li>${e(line)}</li>`).join('')}</ul></details>` : ''}</article>`).join('');
}

export function draftMarkup(model) {
  return model.draft.map(member => `<article class="draft-card"><h3><a href="#the-lists" data-member-link="${e(member.id)}">${e(member.name)}</a></h3><p class="draft-position">${member.tied ? 'Tied at' : 'Pick'} ${member.rank} · ${member.score} points</p><ul>${member.benefits.map(b => `<li><strong>${e(b.kind)}${b.confirmed ? '' : ' to confirm'}</strong> · ${e(b.event)} (${e(b.reason)})</li>`).join('')}${member.youngest ? '<li>Youngest-death Blood Diamond contender</li>' : ''}${member.devil ? '<li>Devil’s Share contender: choose a Steal or Blood Diamond</li>' : ''}${!member.benefits.length && !member.youngest && !member.devil ? '<li>No draft benefit indicated yet</li>' : ''}</ul><p>${member.vacancies} listed ${member.vacancies === 1 ? 'passing' : 'passings'} to replace · Up to ${member.optionalJettisons} optional jettisons to make five spaces.</p></article>`).join('');
}
