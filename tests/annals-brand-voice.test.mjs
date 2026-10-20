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
const photoViewer = readFileSync(new URL('../annals-photos.mjs', import.meta.url), 'utf8');
const signedArchive = JSON.parse(readFileSync(new URL('../data/annals-approved.json', import.meta.url), 'utf8'));

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
  assert.equal(itemSchema.properties.caption.type, 'string');
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
  assert.equal(Production.candidate({ ...common,
    imageReviews: [assessment('Amber drink in a glass', 'X'.repeat(201))] }, true).imageReviews[0].caption, '');
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

test('recipe titles, descriptions, ingredient quantities and preparations retain source authority', () => {
  const req = Production.request('Kingston Windfall cocktail recipe and submitted method.', []);
  assert.match(req.instructions, /recipe name, original description, ingredient list and preparation instructions must NEVER be rewritten/);
  assert.match(req.instructions, /The separate imageReviews caption is a photograph description only/);
  assert.match(guide, /Do not rewrite the recipe name, recipe description, ingredient list or preparation instructions/);
  const recipe = signedArchive.entries.find(entry => entry.id === 'annal-96b5ae266a36793c6a203033');
  assert.equal(recipe.title, 'Kingston Windfall cocktail recipe');
  assert.match(recipe.summary, /fall-inspired craft cocktail/);
  assert.deepEqual(recipe.recipe.drinkIngredients, [
    '1½ oz (45 ml) Jamaican rum',
    '¾ oz (22 ml) Freshly squeezed lemon juice',
    '¾ oz (22 ml) Apple cider syrup (or cinnamon apple cider syrup)',
    '¼ oz (7.5 ml) Honey syrup (3:1 ratio of honey to water)',
    '1 dash Angostura bitters'
  ]);
  assert.equal(recipe.recipe.steps.length, 4);
  assert.match(recipe.recipe.steps[3], /light dusting of cinnamon/);
});

test('photo viewer presents a distinct editorial caption when signed and retains alt fallback', () => {
  assert.match(photoViewer, /closest\('figure'\)\?\.querySelector\('figcaption'\)/);
  assert.match(photoViewer, /\(caption\|\|img\.alt\)/);
  assert.match(photoViewer, /dialog\.querySelector\('img'\)\.alt=hasStyle\?a\.dataset\.editorialAlt\|\|img\.alt:img\.alt/);
});
