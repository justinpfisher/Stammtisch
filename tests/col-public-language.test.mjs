import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderRegister} from '../scripts/annals/RulesPublisher.mjs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');

test('public CoL pages explain club rules without engineering status or source-system links', () => {
  for(const path of ['celebration.html','col-revisions.html','col-rules-version.html']){
    const html=read(path);
    assert.doesNotMatch(html, /Recorded reference:|New rule-email automation awaits|signing remediation|coordinated publication|versioned rules reference|GitHub|open the original spreadsheet/i, path);
  }
  assert.match(read('celebration.html'), /href="col-revisions.html"/);
  assert.match(read('col-revisions.html'), /href="col-rules-version.html\?version=col-baseline-20261015&amp;reference=1"/);
});

test('version reader shows only operative structured provisions and avoids internal source documents', () => {
  const script=read('col-rules-version.mjs');
  assert.match(script, /version\.verified===true/);
  assert.match(script, /Object\.entries\(version\.provisions\)/);
  assert.doesNotMatch(script, /source\.textContent=hosted\.files|version\.id\+' · '|due-time requalification/);
});

test('generated revision register uses the same club-facing language', () => {
  const register=JSON.parse(read('data/col-rules-register.json'));
  const html=renderRegister(register);
  assert.match(html, /Rules as first recorded here/);
  assert.match(html, /No new amendments have been entered in the Register/);
  assert.match(html, /href="col-rules-version.html\?version=col-baseline-20261015&amp;reference=1"/);
  assert.doesNotMatch(html, /Base version:|Dated baseline|Versioned rules reference|technical|source consistency|coordinated publication/);
  assert.doesNotMatch(html, /href="(?:docs\/celebration-of-life-rules\.md|data\/col-rules-versions\.json)"/);
});

test('recorded rules include the unchanged official preamble only after admission',()=>{
  const html=read('col-rules-version.html'),reference=read('docs/celebration-of-life-rules.md');
  const preamble=html.match(/<p id="rules-preamble" hidden>(.*?)<\/p>/)[1].split('<br>');
  for(const line of preamble)assert.ok(reference.includes(line));
  assert.match(read('col-rules-version.mjs'),/querySelector\('#rules-preamble'\)\.hidden=false/);
});
