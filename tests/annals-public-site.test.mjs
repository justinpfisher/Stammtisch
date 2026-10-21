import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPublishedAnnals, contentDigest, validatePublicTextEntry } from '../scripts/annals/ApprovedRenderer.mjs';
import { recipeIntroduction, editorialHtml, EDITORIAL_NOTICE } from '../scripts/annals/EditorialDisplay.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Annals archive is discoverable and matches the approved public index', () => {
  const data = JSON.parse(read('../data/annals-approved.json'));
  const annals = read('../annals.html');
  assert.equal(data.schemaVersion, 1);
  assert.ok(Array.isArray(data.entries));
  assert.ok(Array.isArray(data.approvals));
  assert.equal(data.entries.length, data.approvals.length);
  assert.equal(new Set(data.entries.map(entry => entry.id)).size, data.entries.length);
  assert.equal(new Set(data.approvals.map(approval => approval.entryId)).size, data.approvals.length);
  for (const entry of data.entries) {
    validatePublicTextEntry(entry);
    const approval = data.approvals.find(item => item.entryId === entry.id);
    assert.ok(approval, 'Every indexed entry has its matching public attestation');
    assert.equal(approval.contentSha256, contentDigest(entry));
    assert.equal(approval.consents.publication, true);
  }
  const renderedIds = [...annals.matchAll(/<article class="annal-entry[^"\n]*" id="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(renderedIds.sort(), data.entries.map(entry => entry.id).sort());
  assert.match(annals, /The Annals of Stammtisch/);
  assert.match(annals, /Members only\./);
  if (data.entries.length === 0) {
    assert.match(annals, /The record awaits an approved contribution/);
    assert.doesNotMatch(annals, /class="annal-collections"|class="annal-collection"/);
  } else {
    assert.doesNotMatch(annals, /The record awaits an approved contribution/);
    for (const category of new Set(data.entries.map(entry => entry.category))) {
      assert.ok(annals.includes('id="collection-' + category.replaceAll('_', '-') + '"'));
    }
  }
  assert.doesNotMatch(annals, /No approved entries in this collection yet/);
  assert.match(annals, /mailto:annals@stammtischbrewery\.com/);
  assert.doesNotMatch(annals, /Only verified material approved for public use|A submission is considered privately/);
  assert.doesNotMatch(annals, /sample-cocktail|example\.test/i);
  const home = read('../index.html');
  const assembly = read('../location.html');
  assert.match(home, /href="annals\.html"/);
  assert.match(home, /annals-teaser-title/);
  assert.match(assembly, /href="annals\.html"/);
  assert.match(annals, /href="annals\.html" aria-current="page"/);
});

test('an empty approved archive retains the empty state without invented collections', () => {
  const { html } = buildPublishedAnnals([], [], 'invented-empty-archive-test-secret');
  assert.match(html, /The record awaits an approved contribution/);
  assert.doesNotMatch(html, /class="annal-collections"|class="annal-collection"|class="annal-entry/);
  assert.doesNotMatch(html, /<h2[^>]*>(?:The Cocktail Register|The Register of Remarks|Monthly Proceedings|Annual Assemblies|Club History|Club Artefacts)<\/h2>/);
  assert.match(html, /The Editorial Committee reserves the right/);
});


test('published cocktails show their description once while each recorded ingredient and step stays in its proper section',()=>{
  const data=JSON.parse(read('../data/annals-approved.json'));
  const html=read('../annals.html');
  for(const entry of data.entries.filter(e=>e.category==='cocktail')){
    const intro=recipeIntroduction(entry);
    assert.ok(intro,'Cocktail has a readable introduction');
    const tag='<p class="annal-summary">'+intro+'</p>';
    assert.ok(html.includes(tag),'Published description matches deterministic safe display source');
    const section=html.split('id="'+entry.id+'"')[1]?.split('</article>')[0]||'';
    assert.ok(section.includes('<h4>Preparation</h4>'));
    for(const step of entry.recipe.steps){
      assert.equal(section.split('<li>'+step+'</li>').length-1,1,'Each preparation step is rendered once');
    }
    assert.doesNotMatch(intro,/Instructions\s*[-:]|\*\b(?:Combine|Shake|Strain|Garnish)\b/);
    assert.doesNotMatch(section.split('<div class="annal-recipe">')[0],/Instructions\s*[-:]|<li>.*(?:Shake|Strain|Garnish)/);
    assert.equal(data.approvals.find(a=>a.entryId===entry.id)?.contentSha256,contentDigest(entry),'Presentation does not mutate signed material');
  }
});

test('signed-source-safe editorial language uses approved visible euphemisms without hidden redaction bars',()=>{
 const example=editorialHtml('The [expletive] <account> and [POOP].');
 assert.equal(example,'The [EXPLETIVE] &lt;account&gt; and [POOP].');
 assert.doesNotMatch(example,/annal-redaction|<span/i);
 const annals=read('../annals.html'),history=read('../history.html');
 assert.ok(annals.includes(EDITORIAL_NOTICE),'archive notice must match shared renderer');
 assert.doesNotMatch(annals+history,/annal-redaction|black redaction bars/i);
 const page=buildPublishedAnnals([],[],'',undefined).html;
 assert.ok(page.includes(EDITORIAL_NOTICE),'republication retains approved notice');
 assert.doesNotMatch(page,/annal-redaction/,'no hidden redaction scaffolding reintroduced');
});
