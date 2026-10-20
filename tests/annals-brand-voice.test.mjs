import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const Production = require('../scripts/annals/ProductionCore.js');
const Photos = require('../scripts/annals/PhotoContracts.js');
const history = readFileSync(new URL('../history.html', import.meta.url), 'utf8');
const publicDisplay = readFileSync(new URL('../scripts/annals/PublicDisplay.js', import.meta.url), 'utf8');
const guide = readFileSync(new URL('../docs/brand-editorial-style-guide.md', import.meta.url), 'utf8');
const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const assembly = readFileSync(new URL('../location.html', import.meta.url), 'utf8');
const annals = readFileSync(new URL('../annals.html', import.meta.url), 'utf8');
const generatedAnnals = readFileSync(new URL('../scripts/annals/ApprovedRenderer.mjs', import.meta.url), 'utf8');

function assessment(altText, caption, extras = {}) {
  return { kind: 'drink_or_object', safeToPublish: true, privateDetails: false,
    thirdPartyMaterial: false, childrenOrGuests: false, altText, caption, ...extras };
}

test('public site retains agreed wit and avoids repeated disproportionate claims', () => {
  assert.match(home, /The proceedings are treated with a gravity entirely disproportionate to the business at hand\./);
  assert.doesNotMatch(home, /Our aim is uncomplicated: make time for one another/);
  assert.doesNotMatch(home, /a reputation for structure and significance disproportionate/);
  assert.doesNotMatch(assembly, /shall convene in the mighty Huntsville/);
  assert.match(assembly, /The proceedings must now endeavour to keep pace/);
});

test('History holding page and shared future renderer use the same distinct Club voice', () => {
  const lead = 'A record assembled from what the Club can substantiate.';
  const empty = 'The Club has a history. The formal account is, for the moment, less forthcoming.';
  for (const copy of [history, publicDisplay]) {
    assert.ok(copy.includes(lead));
    assert.ok(copy.includes(empty));
  }
  assert.match(guide, /continuous AI-written historical narrative in the Stammtisch voice/);
});

test('Annals source and generated template share durable History contribution copy', () => {
  const lead = 'The past remains less orderly than the official record would prefer.';
  assert.ok(annals.includes(lead));
  assert.ok(generatedAnnals.includes(lead));
});

test('future AI request differentiates witty visible captions from factual alt text', () => {
  const req = Production.request('A photographed cocktail has been submitted.', []);
  assert.match(req.instructions, /separate caption/);
  assert.match(req.instructions, /Never write a joke in altText/);
  assert.match(req.instructions, /Stammtisch Social Club voice/);
  const itemSchema = req.text.format.schema.properties.imageReviews.items;
  assert.ok(itemSchema.required.includes('caption'));
  assert.equal(itemSchema.properties.caption.maxLength, 200);
});

test('private candidate accepts new caption and older saved image assessments', () => {
  const common = {
    category: 'cocktail', title: 'A photographed cocktail', summary: 'A drink is shown.',
    eventDate: '', quoteVerbatim: '',
    recipe: { drinkIngredients: [], syrupIngredients: [], steps: [] },
    riskFlags: [], imageSafety: { kind: 'drink_or_object', safeToPublish: true, altText: 'Amber drink in a glass' },
    imageReviews: [assessment('Amber drink in a glass', 'An amber drink is duly entered in the record.')],
    interpretation: { intent: 'description', speakerId: 'unknown', evidenceField: 'body' },
  };
  assert.equal(Production.candidate(common, true).imageReviews[0].caption,
    'An amber drink is duly entered in the record.');
  const legacy = structuredClone(common);
  delete legacy.imageReviews[0].caption;
  assert.equal(Production.candidate(legacy, true).imageReviews[0].caption, undefined);
  assert.throws(() => Production.candidate({ ...common,
    imageReviews: [assessment('Amber drink in a glass', 'X'.repeat(201))] }, true),
    /Invalid text/);
});

test('only screened, visually grounded captions pass; absence never blocks the photo', () => {
  const alt = 'Amber drink in a coupe glass';
  const witty = 'An amber drink in a coupe has been entered into the photographic record.';
  assert.equal(Photos.editorialCaption(assessment(alt, witty)), witty);
  assert.equal(Photos.editorialCaption(assessment(alt, '')), '');
  assert.equal(Photos.editorialCaption(assessment(alt, 'A legendary rum from Huntsville was photographed by Marc.')), '');
  assert.equal(Photos.editorialCaption(assessment(alt, 'A 2026 cocktail enters the record.')), '');
  assert.equal(Photos.editorialCaption(assessment(alt, 'The champagne enters the club record.')), '');
  assert.equal(Photos.editorialCaption(assessment(alt, witty, { privateDetails: true })), '');
  assert.equal(Photos.editorialCaption(assessment(alt, witty, { safeToPublish: false })), '');
  assert.equal(Photos.editorialCaption(assessment(alt, witty, { caption: 'See https://example.com' })), '');
});

test('image caption display is optional in existing signed public photo contract', () => {
  const sha = 'a'.repeat(64);
  const entry = { id:'annal-example1', category:'cocktail', title:'Illustrative drink',
    summary:'Source text',year:2026,submittedAt:'2026-10-19T12:00:00Z',
    photos:[{sha256:sha,alt:'Member-submitted drink or object',caption:'An amber drink enters the record.',width:900,height:1200}] };
  const row = Photos.indexRow(entry);
  assert.equal(row.photos[0].caption, 'An amber drink enters the record.');
  assert.equal(row.photos[0].alt, 'Member-submitted drink or object');
});
