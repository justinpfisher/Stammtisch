import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sections,renderRules,replaceRules,HEADINGS} from '../scripts/render-jerome-rules.mjs';

const source=readFileSync(new URL('../data/col-jerome-rules.txt',import.meta.url),'utf8').replace(/\r\n/g,'\n');

test('member-authored source is complete, structured, and contains no private mail wrapper',()=>{
  assert.equal(source.length,3916);
  assert.ok(source.startsWith('CELEBRATION OF LIFE POOL\n'));
  assert.ok(source.endsWith('they move to the #50 spot on your list.\n'));
  assert.equal(sections(source).length,19);
  assert.equal(HEADINGS.length,19);
  assert.equal(sections(source).map(x=>x.heading+'\n'+x.text).join('\n'),source);
  assert.doesNotMatch(source,/Hello friends and AI colleagues|Here are the complete updated rules|jeromesimpson@gmail.com|private_review_required|sourceId/);
  assert.match(source,/Devli’s Share/);
  assert.match(source,/4\. DEVIL’S SHARE/);
});

test('presentation preserves original headings and text without AI interpolation',()=>{
  const markup=renderRules(source);
  assert.equal((markup.match(/<details class="rule-topic">/g)||[]).length,7);
  assert.equal((markup.match(/class="jerome-verbatim-text"/g)||[]).length,19);
  for(const heading of HEADINGS){
    const encoded=heading.replace('&','&amp;');
    assert.ok(markup.includes('>'+encoded),heading);
  }
  assert.match(markup,/The points equal 100 minus age at death\./);
  assert.match(markup,/BIRTHDAY BUFFET/);
  assert.match(markup,/WINNER DECLARED/);
  assert.match(markup,/Protections can’t be transferred or cancelled\./);
  assert.doesNotMatch(markup,/Matter for Club Deliberation|Clarifications recorded|The Committee will observe the appointed hour/);
});

test('renderer refuses partial source and missing or ambiguous replacement boundaries',()=>{
  assert.throws(()=>sections(source.replace(/^POINTS\r?$/m,'')),/heading/i);
  assert.throws(()=>sections(source.replace(/^STEAL\r?$/m,'STEEL')),/heading/i);
  assert.throws(()=>replaceRules('not a Club page',source),/bounded/i);
  const bounded='<main><!-- Jerome verbatim rules start -->old<!-- Jerome verbatim rules end --></main>';
  const once=replaceRules(bounded,source);
  assert.equal(replaceRules(once,source),once);
});
