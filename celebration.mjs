import { ageAt, basePoints, distinctionReason } from './celebration-rules.mjs';
export { ageAt, basePoints } from './celebration-rules.mjs';
import { calculateAwards, awardsMarkup, draftMarkup } from './celebration-awards.mjs';

export function multiplierFor(pick) {
  return pick.pick === 1 || pick.pick === 50 || ['diamond', 'orange'].includes(pick.marker) ? 2 : 1;
}

function actualDeathDate(pick) { return pick.actualDeathDate || pick.dateSource?.dateOfPassing || null; }

export function selectionValue(pick, asOf) {
  if (pick.counted) return pick.points;
  const base = basePoints(ageAt(pick.born, actualDeathDate(pick) || pick.dateOfPassing || asOf));
  return base === null ? pick.points : base * multiplierFor(pick);
}

export function rankedMembers(members) {
  const sorted = [...members].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  let rank = 0;
  return sorted.map((member, index) => {
    if (index === 0 || member.score !== sorted[index - 1].score) rank = index + 1;
    return { ...member, rank };
  });
}

export function normalizeSearch(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’‘]/g, "'").trim();
}

export function matchesPick(pick, query = '', status = 'all') {
  if (!normalizeSearch(pick.name).includes(normalizeSearch(query))) return false;
  if (status === 'commemorations') return Boolean(actualDeathDate(pick) || pick.dateOfPassing);
  if (status === 'unflagged') return !actualDeathDate(pick) && !pick.dateOfPassing && !pick.needsReview;
  if (status === 'double') return multiplierFor(pick) === 2;
  return true;
}

export function commemorationAnchor(person) {
  return `commemoration-${normalizeSearch(person.name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${person.born}`;
}

export function groupedCommemorations(members) {
  const groups = new Map();
  for (const member of members) {
    for (const pick of member.picks) {
      if (!actualDeathDate(pick) && !pick.dateOfPassing) continue;
      const key = `${normalizeSearch(pick.name)}:${pick.born}`;
      if (!groups.has(key)) groups.set(key, { ...pick, members: [] });
      const current = groups.get(key);
      if (!current.dateOfPassing && pick.dateOfPassing) current.dateOfPassing = pick.dateOfPassing;
      if (!actualDeathDate(current) && actualDeathDate(pick)) {
        current.actualDeathDate = actualDeathDate(pick);
        current.actualDeathSource = pick.actualDeathSource || null;
        current.dateSource = pick.dateSource || null;
      }
      groups.get(key).members.push({ id: member.id, name: member.name, points: pick.points, counted: pick.counted });
    }
  }
  const dated = pick => actualDeathDate(pick) || pick.dateOfPassing || '';
  return [...groups.values()].sort((a, b) => dated(b).localeCompare(dated(a)) || a.name.localeCompare(b.name));
}

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function dateLabel(value, options = {}) {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC', ...options }).format(new Date(`${value}T12:00:00Z`));
}

function pointsLabel(points) { return points < 0 ? `−${Math.abs(points)}` : String(points); }
function readableSentence(value) {
  return String(value || '').toLowerCase().replace(/\bcol\b/g, 'CoL').replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix, letter) => prefix + letter.toUpperCase());
}
function safeSourceUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? escapeHtml(url.href) : '#'; } catch { return '#'; }
}

export function pickMarkup(pick, member, data) {
  const e = escapeHtml;
  const deathDate = actualDeathDate(pick);
  const age = ageAt(pick.born, deathDate || pick.dateOfPassing || data.asOf);
  const value = selectionValue(pick, data.asOf);
  const multiplier = multiplierFor(pick);
  const sourceDiffers = value !== pick.points;
  const hasPassing = Boolean(deathDate || pick.dateOfPassing);
  const status = pick.dateOfPassing ? '<span class="record-status">In remembrance</span>' : deathDate ? '<span class="record-status">Passing verified · Club score pending</span>' : pick.needsReview ? '<span class="record-status">Date to confirm</span>' : '';
  const badge = multiplier === 2 ? '<span class="selection-badge" aria-label="Double-point selection">2×</span>' : '';
  const displayedDate = deathDate || pick.dateOfPassing;
  const meta = hasPassing ? `${e(pick.born?.slice(0, 4))}–${e(displayedDate.slice(0, 4))} <span aria-hidden="true">·</span> ${dateLabel(displayedDate)}` : `Born ${dateLabel(pick.born)} <span aria-hidden="true">·</span> Age ${age ?? '—'}`;
  const source = pick.actualDeathSource || pick.dateSource;
  const dateSource = source ? `<a href="${safeSourceUrl(source.sourceUrl)}" target="_blank" rel="noopener noreferrer">${e(source.sourceLabel)} ↗</a>` : 'The Stammtisch register';
  return `<li><details class="pick-entry${hasPassing ? ' remembered' : ''}">
    <summary><span class="pick-number">${e(pick.pick)}</span><span class="pick-name-block"><span class="pick-name">${e(pick.name)} ${badge}</span><span class="record-meta">${meta}</span>${status}</span><span class="pick-points"><strong>${pointsLabel(value)}</strong><small>${pick.counted ? 'Awarded' : deathDate ? 'Not yet awarded' : 'Value'}</small></span><span class="disclosure-icon" aria-hidden="true">+</span></summary>
    <div class="pick-entry-body"><dl><div><dt>Selected by</dt><dd>${e(member.name)} · ${typeof pick.pick === 'number' ? 'Selection' : 'Entry'} ${e(pick.pick)}</dd></div><div><dt>Date of birth</dt><dd>${dateLabel(pick.born)}</dd></div><div><dt>${pick.dateOfPassing ? 'Date recorded by group' : deathDate ? 'Verified date of death' : 'Age on ' + dateLabel(data.asOf)}</dt><dd>${pick.dateOfPassing ? dateLabel(pick.dateOfPassing) + (deathDate ? ' · Actual death: ' + dateLabel(deathDate) : ' · Actual death date unverified') + ' · Aged ' + age : deathDate ? dateLabel(deathDate) + ' · Group discovery date not yet recorded · Aged ' + age : e(pick.ageText || age)}</dd></div><div><dt>${pick.counted ? 'Points in the standings' : deathDate ? 'Potential points (not yet in standings)' : 'Points at this age'}</dt><dd>${pointsLabel(value)}${multiplier === 2 ? ' · Double-point selection' : ''}</dd></div></dl>
    ${sourceDiffers ? `<p>The spreadsheet shows ${pointsLabel(pick.points)}. The value above applies the Club’s age rule to the date shown.</p>` : ''}
    ${pick.pick === 'BB' ? '<p>This additional selection is labelled “BB” in the spreadsheet.</p>' : ''}
    ${pick.needsReview ? '<p>These points are included in the recorded total; a date of passing is still to be confirmed.</p>' : ''}
    ${hasPassing ? `<p class="record-source">${deathDate ? 'Actual death source: ' + dateSource : 'The group-recorded date is not an independently verified date of death'}.</p>` : ''}
    ${deathDate && !pick.dateOfPassing ? `<p class="record-source">Independently verified after the club’s ${dateLabel(data.asOf)} register snapshot; no change has been made to the club’s recorded score.</p>` : ''}
    </div></details></li>`;
}

export async function mountCelebration() {
  let data;
  try {
    const response = await fetch('data/celebration.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load the register (${response.status}).`);
    data = await response.json();
    if (!Array.isArray(data.members) || !data.members.length) throw new Error('The register is empty.');
  } catch (error) {
    document.querySelector('#award-leaders').innerHTML = '<p>Award progress is unavailable until the register loads.</p>';
    document.querySelector('#draft-benefits').innerHTML = '<p>Please reload the page to see the draft preview.</p>';
    document.querySelector('#standings').innerHTML = '<p>The standings could not be loaded.</p>';
    document.querySelector('#member-lists').innerHTML = '<p class="load-message">The register is temporarily unavailable. Please reload the page or use the original spreadsheet linked below.</p>';
    document.querySelector('#commemoration-list').innerHTML = '<p>Please use the original spreadsheet linked below.</p>';
    return;
  }
  const e = escapeHtml;
  const members = rankedMembers(data.members);
  const awards = calculateAwards(data);
  document.querySelector('#award-leaders').innerHTML = awardsMarkup({ ...awards, cards:awards.cards.slice(0,3) });
  document.querySelector('#badge-leaders').innerHTML = awardsMarkup({ ...awards, cards:awards.cards.slice(3) });
  document.querySelector('#draft-benefits').innerHTML = draftMarkup(awards);
  document.querySelector('#awards-date').textContent = data.year + ' season · Register updated ' + dateLabel(data.asOf) + '.';
  let selectedMember = 'all';
  let query = '';
  let status = 'all';
  const results = document.querySelector('#member-lists');
  const filters = document.querySelector('#member-filters');
  const search = document.querySelector('#celebrity-search');
  const statusControl = document.querySelector('#status-filter');
  document.querySelector('[data-year]').textContent = data.year;
  document.querySelector('[data-snapshot-date]').textContent = `Register updated ${dateLabel(data.asOf)}.`;
  document.querySelector('#source-date').textContent = `Club scores and discovery dates reflect the ${dateLabel(data.asOf)} register snapshot. Independently verified deaths may be newer and do not affect standings until the club updates its register.`;
  document.querySelector('#standings').innerHTML = members.map(member => `<a class="standing-card" href="#the-lists" data-member-link="${e(member.id)}" aria-label="${e(member.name)}, rank ${member.rank}, ${member.score} points. View full list."><span class="standing-rank">${String(member.rank).padStart(2, '0')}</span><img src="${e(member.avatar)}" width="240" height="240" alt=""><span class="standing-name">${e(member.name)}</span><span class="standing-score">${pointsLabel(member.score)}<small>points</small></span><span class="standing-cta">View list <span aria-hidden="true">↗</span></span></a>`).join('');
  filters.innerHTML = [{ id: 'all', name: 'Everyone' }, ...members].map(member => `<button type="button" data-member="${e(member.id)}" aria-pressed="${member.id === 'all'}">${e(member.name)}</button>`).join('');
  document.querySelector('#register-controls').hidden = false;

  function renderLists() {
    let matches = 0;
    let visibleMembers = 0;
    const filtered = selectedMember !== 'all' || query.trim() || status !== 'all';
    results.innerHTML = members.filter(member => selectedMember === 'all' || selectedMember === member.id).map(member => {
      const picks = member.picks.filter(pick => matchesPick(pick, query, status));
      if (!picks.length) return '';
      matches += picks.length;
      visibleMembers++;
      const extra = member.picks.some(pick => pick.pick === 'BB');
      return `<details class="member-register" id="list-${e(member.id)}"${filtered ? ' open' : ''}><summary><img src="${e(member.avatar)}" width="48" height="48" alt=""><span class="member-register-name">${e(member.name)}<small>${filtered ? `${picks.length} matching ${picks.length === 1 ? 'entry' : 'entries'}` : '50 selections' + (extra ? ' + 1 BB entry' : '')}</small></span><span class="member-register-score">${pointsLabel(member.score)} <small>points</small></span><span class="disclosure-icon" aria-hidden="true">+</span></summary><ul class="pick-list">${picks.map(pick => pickMarkup(pick, member, data)).join('')}</ul></details>`;
    }).join('');
    if (!matches) results.innerHTML = '<div class="no-results"><h3>No matching selections</h3><p>Try another name, choose Everyone, or reset the filters.</p></div>';
    document.querySelector('#results-count').textContent = `${matches} ${matches === 1 ? 'entry' : 'entries'} across ${visibleMembers} ${visibleMembers === 1 ? 'member' : 'members'}${filtered ? '' : ' · Open a member’s list to see all selections'}.`;
    for (const button of filters.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.member === selectedMember));
  }
  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-member]');
    if (!button) return;
    selectedMember = button.dataset.member;
    renderLists();
  });
  search.addEventListener('input', () => { query = search.value; renderLists(); });
  statusControl.addEventListener('change', () => { status = statusControl.value; renderLists(); });
  document.querySelector('#reset-filters').addEventListener('click', () => {
    selectedMember = 'all'; query = ''; status = 'all'; search.value = ''; statusControl.value = 'all'; renderLists();
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-member-link]');
    if (!link) return;
    selectedMember = link.dataset.memberLink;
    query = ''; status = 'all'; search.value = ''; statusControl.value = 'all'; renderLists();
    document.querySelector('#lists-title').focus({ preventScroll: true });
  });
  renderLists();
  document.querySelector('#commemoration-list').innerHTML = groupedCommemorations(members).map(person => {
    const death = actualDeathDate(person);
    const displayed = death || person.dateOfPassing;
    const source = person.actualDeathSource || person.dateSource;
    const clubDate = person.dateOfPassing ? dateLabel(person.dateOfPassing) : 'Not yet recorded';
    const timing = death
      ? `Verified date of death: ${dateLabel(death)} · Club discovery date: ${clubDate}`
      : `Group recorded: ${dateLabel(person.dateOfPassing)} · Actual death date unverified`;
    const memberLinks = person.members.map(member =>
      `<a href="#the-lists" data-member-link="${e(member.id)}">${e(member.name)}<span>${pointsLabel(member.points)} ${member.counted ? 'points awarded' : 'potential points (not yet awarded)'} <span aria-hidden="true">↗</span></span></a>`).join('');
    const note = death && !person.dateOfPassing
      ? '<p class="record-source">Independently verified; the club register has not yet recorded this passing or awarded the resulting points.</p>' : '';
    const sourceLink = source?.sourceUrl
      ? `<a class="verified-date" href="${safeSourceUrl(source.sourceUrl)}" target="_blank" rel="noopener noreferrer">${e(source.sourceLabel || 'Supporting source')} ↗</a>` : '';
    return `<article class="commemoration-card" id="${e(commemorationAnchor(person))}" tabindex="-1"><div class="commemoration-topline"><span>${e(person.born?.slice(0, 4))}—${e(displayed.slice(0, 4))}</span><span>Aged ${ageAt(person.born, displayed)}</span></div><h3>${e(person.name)}</h3><p class="commemoration-date">${e(timing)}</p>${note}<div class="commemoration-members">${memberLinks}</div>${sourceLink}</article>`;
  }).join('') || '<p>No commemorations have been recorded yet.</p>';
  if (window.location.hash.startsWith('#commemoration-')) {
    const target = document.getElementById(window.location.hash.slice(1));
    target?.scrollIntoView({ block: 'start' });
    target?.focus({ preventScroll: true });
  }
  document.querySelector('#distinctions').innerHTML = data.distinctions.map(item => `<article><h3>${e(readableSentence(item.name))}</h3><p>${e(readableSentence(distinctionReason(item)))}</p>${item.imageIdea ? `<details><summary>Button illustration idea <span aria-hidden="true">+</span></summary><p>${e(readableSentence(item.imageIdea))}</p></details>` : ''}</article>`).join('');
}

if (typeof document !== 'undefined') mountCelebration();

