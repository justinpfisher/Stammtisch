import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import display from '../scripts/annals/PublicDisplay.js';
import { buildPublishedAnnals } from '../scripts/annals/ApprovedRenderer.mjs';
import { emptyHistory, renderHistory } from '../scripts/annals/HistoryPublisher.mjs';
import { renderRegister } from '../scripts/annals/RulesPublisher.mjs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const pages = {
  'index.html': 'home',
  'celebration.html': 'col',
  'location.html': 'assembly',
  'annals.html': 'annals',
  'photos.html': 'annals-sub',
  'history.html': 'annals-sub',
  'col-revisions.html': 'col-sub',
  'col-rules-version.html': 'col-sub',
};
const destinations = [
  'index.html#monthly-stammtisch',
  'index.html#the-club',
  'annals.html',
  'celebration.html',
  'location.html',
];
test('every public page uses identical accessible navigation and branded chrome', () => {
  for (const [path,section] of Object.entries(pages)) {
    const html=read(path);
    assert.ok(html.includes(display.siteHeader(section)),path+' header drift');
    assert.ok(html.includes(display.siteFooter(section)),path+' footer drift');
    assert.equal((html.match(/class="site-header"/g)||[]).length,1,path+' duplicate header');
    assert.equal((html.match(/aria-label="Main navigation"/g)||[]).length,1,path+' main navigation');
    assert.equal((html.match(/aria-label="Mobile navigation"/g)||[]).length,1,path+' accessible mobile navigation');
    assert.equal((html.match(/aria-label="Footer navigation"/g)||[]).length,1,path+' footer navigation');
    assert.ok(html.includes('<summary>Menu <span aria-hidden="true">+</span></summary>'),path+' no-JS menu');
    for (const href of destinations) assert.ok(html.includes('href="'+href+'"'),path+' missing '+href);
    assert.match(html,/<a class="wordmark" href="index\.html"/,path+' crest wordmark');
  }
});
test('each template used in automatic publication regenerates the same navigation', () => {
  const archive=buildPublishedAnnals([],[],'',emptyHistory()).html;
  const history=renderHistory(emptyHistory());
  const register=renderRegister(JSON.parse(read('data/col-rules-register.json')));
  for(const [page,markup,section] of [
    ['annals',archive,'annals'],['history',history,'annals-sub'],['rules register',register,'col-sub']
  ]) {
    assert.ok(markup.includes(display.siteHeader(section)),page+' publisher header');
    assert.ok(markup.includes(display.siteFooter(section)),page+' publisher footer');
  }
});
test('monthly gathering is the homepage centre; Assembly remains separate', () => {
  const html=read('index.html');
  const monthly=html.indexOf('id="monthly-stammtisch"');
  const club=html.indexOf('id="the-club"');
  const assembly=html.indexOf('class="assembly-notice"');
  assert.ok(monthly>0 && club>monthly && assembly>club,'The monthly hero must precede club principles and Assembly');
  assert.match(html,/<h1 id="monthly-gathering-title">The next <em>Stammtisch\.<\/em><\/h1>/);
  assert.match(html,/data-monthly-gathering/);
  assert.match(html,/data-monthly-date/);
  assert.match(html,/8 p\.m\. Toronto time/);
  assert.match(html,/date-only/i);
  assert.doesNotMatch(html,/RSVP|private (?:address|contact)/i);
  assert.match(read('celebration.html'),/href="index\.html#monthly-stammtisch">next Stammtisch<\/a>/);
});
test('calendar remains an honest recurring date reminder without a fictional duration or location', () => {
  const ics=read('stammtisch-monthly.ics');
  assert.match(ics,/DTSTART;VALUE=DATE:20261016\r\n/);
  assert.match(ics,/DTEND;VALUE=DATE:20261017\r\n/);
  assert.match(ics,/RRULE:FREQ=MONTHLY;BYDAY=3FR\r\n/);
  assert.match(ics.replace(/\r\n[ \t]/g,''),/8 p\.m\. Toronto time/);
  assert.doesNotMatch(ics,/DTSTART;TZID=|DURATION:|LOCATION:/);
  for(const line of ics.split('\r\n'))assert.ok(line.length<=75,'Unfolded calendar line');
});
