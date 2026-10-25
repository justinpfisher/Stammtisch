/* Public CoL rules are rendered from Jerome's verified source transcript. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderRules} from '../scripts/render-jerome-rules.mjs';

const page=readFileSync(new URL('../celebration.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../data/col-jerome-rules.txt',import.meta.url),'utf8');
const editions=readFileSync(new URL('../col-rules-version.html',import.meta.url),'utf8');
const start='<!-- Jerome verbatim rules start -->';
const end='<!-- Jerome verbatim rules end -->';
const a=page.indexOf(start),b=page.indexOf(end);
const rendered=page.slice(a+start.length,b).replace(/\r\n/g,'\n').trim();

test('official rules display exactly the verified source-renderer output',()=>{
  assert.ok(a>=0&&b>a,'expected one bounded verbatim rules region');
  assert.equal(rendered,renderRules(source).replace(/\r\n/g,'\n'));
  assert.doesNotMatch(rendered,/<pre|jerome-verbatim-text/);
  assert.match(rendered,/<ul class="jerome-bullet-list">/);
  assert.match(rendered,/<ol class="jerome-numbered-list">/);
  assert.equal((rendered.match(/<details class="rule-topic">/g)||[]).length,7);
});

test('verbatim presentation keeps accessible headings, disclosure controls and wrapping text',()=>{
  assert.match(page,/<section class="shell rules-section" id="official-rules" aria-labelledby="rules-title">/);
  assert.match(rendered,/<details class="rule-topic"><summary>POINTS/);
  assert.match(rendered,/<h4 class="jerome-subheading">4\. DEVIL’S SHARE<\/h4>/);
  assert.ok(rendered.includes('<li><p>You can’t steal a Diamond.</p></li>'));
  assert.ok(rendered.includes('If your celebrity dies at 101 or older, you lose one point for every year over 100.'));
  assert.ok(rendered.includes('Birthday Buffet is based on when the death is reported in our group chat (not date of death.)'));
  assert.match(page,/Earlier signed editions and revisions/);
});

test('historical signed editions remain available without replacing Jerome’s current wording',()=>{
  assert.match(editions,/Earlier signed <em>editions/);
  assert.match(editions,/celebration\.html#official-rules/);
  assert.doesNotMatch(rendered,/Clarifications recorded|Matter for Club Deliberation/);
});
