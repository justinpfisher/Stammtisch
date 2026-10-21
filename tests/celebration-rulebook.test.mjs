/* Current Club rulebook: presentation may advance independently of scorekeeping.
 * All fixtures below are public, with no private workbook or member correspondence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../celebration.html',import.meta.url),'utf8');
const editions=readFileSync(new URL('../col-rules-version.html',import.meta.url),'utf8');
const editorial=readFileSync(new URL('../docs/col-editorial-interpretation.md',import.meta.url),'utf8');
const agents=readFileSync(new URL('../AGENTS.md',import.meta.url),'utf8');
const ledger=JSON.parse(readFileSync(new URL('../data/col-rules-release-state.json',import.meta.url),'utf8'));
const rulebook=page.slice(page.indexOf('<section class="shell rules-section" id="official-rules"'),page.indexOf('<section class="shell distinctions-section"'));

test('one public current Club rulebook is readable without JS and not overwritten by an older signed edition',()=>{
  assert.ok(rulebook.length>5000);
  assert.match(rulebook,/Official <em>rules/);
  assert.match(rulebook,/Clarifications recorded 21 October 2026/);
  assert.doesNotMatch(page,/refreshOfficialRules\s*\(/);
  assert.match(page,/id="official-rules"/);
  assert.match(rulebook,/Earlier signed editions and revisions/);
  assert.match(editions,/Earlier signed <em>editions/);
  assert.match(editions,/celebration\.html#official-rules/);
  assert.doesNotMatch(rulebook,/Rules in effect from|Supplied September 20, 2026/);
});

test('year, dates, birthday entitlement and protections display the actual 21 October decisions',()=>{
  assert.match(rulebook,/first Stammtisch of one calendar year to the first Stammtisch of the next/);
  assert.match(rulebook,/exact handover time is decided and recorded when the company assembles/);
  assert.match(rulebook,/From January 1 until that handover, qualifying deaths belong to the preceding competition year/);
  assert.match(rulebook,/first reported in the Club's WhatsApp group/);
  assert.match(rulebook,/private discovery or a news alert/);
  assert.match(rulebook,/Blue Diamonds, Brown Diamonds and celebrities bearing a placed Protection are excluded/);
  assert.match(rulebook,/honour-bound to report promptly/);
  assert.match(rulebook,/Once placed, a Protection stays with that celebrity until death, even across competition years/);
  assert.match(rulebook,/cannot be cancelled, moved or jettisoned/);
  assert.match(rulebook,/does not double points/);
  assert.match(rulebook,/unplaced.*expires when the draft concludes/);
});

test('agreed annual business is exactly seven stages and Devil’s Share follows earned Steals',()=>{
  const section=rulebook.match(/<summary>THE ANNUAL ORDER OF BUSINESS[\s\S]*?<ol>([\s\S]*?)<\/ol>/)?.[1];
  assert.ok(section,'Expected clearly numbered seven-stage proceedings');
  const items=[...section.matchAll(/<li>/g)].map(m=>m.index);
  assert.equal(items.length,7);
  const labels=[
    'Declare the winner','Place earned Protections','Exercise earned Steals',
    "Devil's Share",'Optional Jettisons','The snake draft','Appoint replacement Diamonds'
  ];
  for(let i=0;i<labels.length;i++) {
    const slice=section.slice(items[i],items[i+1]??section.length);
    assert.ok(slice.includes(labels[i]),'Stage '+(i+1)+' missing '+labels[i]);
  }
  assert.match(rulebook,/oldest-death Steal.*actual date of death, not the later date/);
  assert.match(rulebook,/without exceeding 50 names per member/);
  assert.match(rulebook,/no requirement to manufacture five vacancies/);
  assert.match(rulebook,/unused earned Steal or an unplaced Protection expires/);
});

test('unchanged prior scores and sealed rules remain visibly distinguished from current owner-attested words',()=>{
  assert.match(rulebook,/Earlier scores stand as recorded/);
  assert.match(rulebook,/Current standings show the points actually recorded/);
  assert.match(rulebook,/Previously awarded points and benefits are not rewritten/);
  assert.doesNotMatch(rulebook,/Matter for Club Deliberation \(non-operative\)|implementation class|Viewer|release gate|snapshot digest|qualified implementation/);
  const matters=(rulebook.match(/Matter for Club Deliberation/g)||[]).length;
  assert.equal(matters,1,'Only the still-future precise cutoff is unsettled');
  assert.match(rulebook,/precise hour of the 2027 handover/);
  assert.doesNotMatch(rulebook,/seven-stage order, but its annual boundary.*unresolved/);
  assert.doesNotMatch(rulebook,/Protections last until death.*verified register representation/);
  const ids=new Set(ledger.operations.map(o=>o.revisionId));
  assert.ok(ids.has('col-35a4c1a8b8f7e39be6b52555'));
  assert.ok(ids.has('col-7627d10078568faf30a91294'));
});

test('website-wide instructions favour simple releases and a short Club-voice Matter',()=>{
  assert.match(agents,/Remove avoidable barriers across the entire website/);
  assert.match(agents,/the Club's publicly adopted words can be updated immediately/);
  assert.match(editorial,/one or two graceful sentences/);
  assert.match(editorial,/An established interpretation is not an unresolved debate/);
  assert.match(editorial,/older signed editions in the existing revision history/);
  assert.doesNotMatch(rulebook,/new rule.*needs.*second vote/i);
});
