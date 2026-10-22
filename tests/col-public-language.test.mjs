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

test('newest rule revisions appear first without changing chronological source records', () => {
  const record=JSON.parse(read('data/col-rules-register.json'));
  const older={
    id:'col-fixture-older-0001',member:'marc',submittedAt:'2026-10-16T12:00:00Z',
    publishedAt:'2026-10-16T12:05:00Z',effectiveAt:'2026-10-16T12:05:00Z',
    state:'active',baseVersion:record.baseline.id,explanation:'Fictional earlier amendment.',
    changes:[{provision:'PRIZE',before:'Before one.',after:'After one.'}],correctionOf:null
  };
  const newer={
    ...older,id:'col-fixture-newer-0002',member:'ken',
    submittedAt:'2026-10-18T12:00:00Z',publishedAt:'2026-10-18T12:05:00Z',
    effectiveAt:'2026-10-18T12:05:00Z',explanation:'Fictional later correction.',
    changes:[{provision:'PRIZE',before:'After one.',after:'After two.'}],correctionOf:older.id
  };
  record.revisions=[older,newer]; // The immutable public record remains append-ordered.
  const source=JSON.stringify(record);
  const html=renderRegister(record);
  const newerAt=html.indexOf('<article id="'+newer.id+'">');
  const olderAt=html.indexOf('<article id="'+older.id+'">');
  const baselineAt=html.indexOf('<section id="'+record.baseline.id+'">');
  assert.ok(newerAt>=0&&newerAt<olderAt&&olderAt<baselineAt,'newest, older, baseline');
  assert.match(html,/Corrects or reverses <a href="#col-fixture-older-0001"/);
  assert.equal(JSON.stringify(record),source,'display order must not mutate source data');
  const staticHtml=read('col-revisions.html');
  assert.ok(staticHtml.indexOf('No new amendments have been entered')<
    staticHtml.indexOf('<section id="col-baseline-20261015">'));
});
