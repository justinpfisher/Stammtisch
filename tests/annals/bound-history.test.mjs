import assert from 'node:assert/strict';
import {test} from 'node:test';
import display from '../../scripts/annals/PublicDisplay.js';
import {historyCredits,historyBacklinks,subtractStaleHistory,validateBoundHistory} from '../../scripts/annals/BoundHistory.mjs';
const at=new Date('2026-01-01T00:00:00Z');
const a='annal-'+'a'.repeat(24), b='annal-'+'b'.repeat(24), digest='c'.repeat(64);
const entry=(id,contributorPortrait)=>({id,contributorPortrait});
const receipt=(entryId,contentSha256=digest,namedAttribution=true)=>({entryId,contentSha256,consents:{namedAttribution}});
const source=(entryId,portrait)=>({kind:'annal',entryId,digest,portrait,label:'Original entry'});
const passages=[
  {id:'recollection-a',text:'One member remembers a Tuesday.',sources:[source(a,'fish')]},
  {id:'recollection-b',text:'Another remembers a Thursday.',sources:[source(b,'marc')]},
  {id:'another-b',text:'That member also remembers some rain.',sources:[source(b,'marc')]}
];
function fixture(){return {schemaVersion:2,revision:1,updatedAt:at.toISOString(),chapters:[
  {id:'origins',heading:'Origins',passages:[{id:'independent',text:'An unaffected passage.',sources:[{kind:'record',ref:'club-record'}]}]},
  {id:'traditions',heading:'Traditions',passages:structuredClone(passages)}
]};}
test('duplicate attribution and links are deduplicated without merging accounts',()=>{
  const doc=validateBoundHistory(fixture());
  assert.deepEqual(historyCredits(doc).map(r=>r.name),['Justin','Marc']);
  assert.equal(historyBacklinks(doc).get(b).size,1);
  const html=display.historyPage(doc);
  assert.match(html,/Tuesday/);
  assert.match(html,/Thursday/);
  assert.equal(html.split('marc-annals.webp').length,2);
  assert.ok(html.includes('annals.html#'+a));
  assert.match(html,/aria-current="page">Club History/);
});
test('a signed source correction retracts dependent wording without changing other chapters',()=>{
  const doc=fixture();
  const next=subtractStaleHistory(doc,[entry(a,'fish'),entry(b,'marc')],[receipt(a,'d'.repeat(64)),receipt(b)],at);
  assert.equal(next.revision,2);
  assert.equal(next.chapters[0],doc.chapters[0]);
  assert.deepEqual(next.chapters[1].passages.map(p=>p.id),['recollection-b','another-b']);
  assert.deepEqual(historyCredits(next).map(r=>r.name),['Marc']);
});
test('after one signed source is withdrawn the other account and its contributor survive',()=>{
  const doc=fixture(), entries=[entry(a,'fish')], receipts=[receipt(a)];
  const next=subtractStaleHistory(doc,entries,receipts,at);
  assert.deepEqual(historyCredits(next).map(r=>r.name),['Justin']);
  assert.equal(historyBacklinks(next).has(b),false);
  assert.equal(subtractStaleHistory(next,entries,receipts,at),next);
});
test('portrait permission changes alone do not strip otherwise still-bound text',()=>{
  const doc=fixture();
  const next=subtractStaleHistory(doc,[entry(a,'fish'),entry(b,'marc')],[receipt(a,digest,false),receipt(b)],at);
  assert.equal(next.chapters[1].passages[0].text,doc.chapters[1].passages[0].text);
  assert.deepEqual(historyCredits(next).map(r=>r.name),['Marc']);
});
test('History data rejects a private URL and a forged portrait key',()=>{
  const doc=fixture();
  doc.chapters[1].passages[0].sources[0].portrait='constructor';
  assert.throws(()=>validateBoundHistory(doc));
  const privateLink=fixture();
  privateLink.chapters[0].passages[0].sources[0].ref='https://example.invalid';
  assert.throws(()=>validateBoundHistory(privateLink));
});
