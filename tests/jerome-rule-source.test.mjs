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

test('semantic HTML displays original headings, paragraphs, bullets and seven draft stages',()=>{
  const markup=renderRules(source);
  assert.equal((markup.match(/<details class="rule-topic">/g)||[]).length,7);
  assert.equal((markup.match(/<ul class="jerome-bullet-list">/g)||[]).length,6);
  assert.equal((markup.match(/<ol class="jerome-numbered-list">/g)||[]).length,2);
  assert.equal((markup.match(/<li>/g)||[]).length,24);
  assert.doesNotMatch(markup,/<pre\b|class="jerome-verbatim-text"/);
  for(const heading of HEADINGS){
    const encoded=heading.replace('&','&amp;');
    assert.ok(markup.includes('>'+encoded),heading);
  }
  assert.match(markup,/<li><p>You can’t steal a Diamond\.<\/p><\/li>/);
  assert.match(markup,/<li><p>Protections last until the celebrity dies\.<\/p><\/li>/);
  assert.match(markup,/<strong class="jerome-list-title">Devli’s Share<\/strong>/);
  assert.match(markup,/<h4 class="jerome-subheading">4\. DEVIL’S SHARE<\/h4>/);
  assert.doesNotMatch(markup,/Matter for Club Deliberation|Clarifications recorded|The Committee will observe the appointed hour/);
});

test('rendered visible words and original heading order match Jerome without editorial additions',()=>{
  const markup=renderRules(source);
  const expected=source.replace(/^[ \t]*-[ \t]*$/gm,'').replace(/^[ \t]*\d+\.[ \t]*$/gm,'').replace(/\s+/g,' ').trim();
  const actual=markup.replace(/<span aria-hidden="true">\+<\/span>/g,'')
    .replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/\s+/g,' ').trim();
  assert.equal(actual,expected,'formatting must not change words or reorder headings');
});

test('renderer refuses partial source and missing or ambiguous replacement boundaries',()=>{
  assert.throws(()=>sections(source.replace(/^POINTS\r?$/m,'')),/heading/i);
  assert.throws(()=>sections(source.replace(/^STEAL\r?$/m,'STEEL')),/heading/i);
  assert.throws(()=>replaceRules('not a Club page',source),/bounded/i);
  const bounded='<main><!-- Jerome verbatim rules start -->old<!-- Jerome verbatim rules end --></main>';
  const once=replaceRules(bounded,source);
  assert.equal(replaceRules(once,source),once);
});
