import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  validatePublicTextEntry, contentDigest, verifyApproval, buildApprovedAnnals,
} from '../scripts/annals/ApprovedRenderer.mjs';

const TEST_SECRET = 'synthetic-test-only-approval-key-at-least-32-characters-long';

const baseDrink = {
  id: 'sample-cocktail-01', category: 'cocktail',
  title: 'A fictional test cocktail', summary: 'This is invented for automated testing.',
  year: 2026, dateLabel: 'Illustrative month 2026', sortDate: '',
  quoteVerbatim: '',
  recipe: {
    drinkIngredients: ['1/2 oz test syrup', '1 oz fictional juice'],
    syrupIngredients: ['1 cup invented ingredient'],
    steps: ['Stir the synthetic ingredients.'],
  },
  credit: 'anonymous',
};

const baseQuote = {
  id: 'sample-quotation-01', category: 'quotation',
  title: 'An invented line for testing', summary: 'This was not said by anyone.',
  year: 2025, dateLabel: 'Undated synthetic example', sortDate: '',
  quoteVerbatim: 'This is an invented test quotation.',
  recipe: { drinkIngredients: [], syrupIngredients: [], steps: [] },
  credit: 'a club member',
};

const canonical = obj => Array.isArray(obj) ? obj.map(canonical) :
  obj && typeof obj === 'object'
    ? Object.fromEntries(Object.keys(obj).sort().map(k => [k, canonical(obj[k])])) : obj;

function signedTestReceipt(entry, consents = {}) {
  const normalized = validatePublicTextEntry(entry);
  const receipt = {
    entryId: normalized.id, approvedAt: '2026-10-08T13:00:00Z',
    reviewedBy: 'synthetic-test-reviewer',
    consents: {
      publication: true, quotePublication: false, recipeVerified: false,
      namedAttribution: false, photoPublication: false, ...consents,
    },
    contentSha256: contentDigest(normalized),
  };
  const input = JSON.stringify(canonical({
    entry: normalized, receipt,
  }));
  return {
    ...receipt,
    signature: createHmac('sha256', TEST_SECRET).update(input).digest('hex'),
  };
}

test('a text-only fictional cocktail with explicit review and signed receipt can render', () => {
  const receipt = signedTestReceipt(baseDrink, { recipeVerified: true });
  assert.equal(verifyApproval(baseDrink, receipt, TEST_SECRET), true);
  const result = buildApprovedAnnals([baseDrink], [receipt], TEST_SECRET);
  assert.equal(result.entryCount, 1);
  assert.ok(result.html.includes('The Annals of Stammtisch'));
  assert.ok(result.html.includes('1/2 oz test syrup'));
  assert.ok(result.html.includes('Homemade syrup'));
  assert.ok(result.html.includes('id="collection-cocktail"'));
  assert.ok(!result.html.includes('id="collection-quotation"'));
  assert.doesNotMatch(result.html, /class="annal-collections"/);
  assert.ok(!result.html.includes('<script'));
});

test('future or revised content cannot reuse old approval', () => {
  const receipt = signedTestReceipt(baseDrink, { recipeVerified: true });
  assert.equal(verifyApproval({ ...baseDrink, summary: 'Changed after review' },
    receipt, TEST_SECRET), false);
  assert.equal(verifyApproval(baseDrink, receipt, 'not-secret'), false);
  assert.equal(verifyApproval(baseDrink, { ...receipt, approvedAt: '2026-10-09T13:00:00Z' },
    TEST_SECRET), false);
  assert.throws(() => buildApprovedAnnals([baseDrink], [receipt], 'bad-secret'),
    /Missing authenticated/);
});

test('cannot publish a quote without quote consent, including supposedly anonymous quotes', () => {
  const bad = signedTestReceipt(baseQuote);
  assert.equal(verifyApproval(baseQuote, bad, TEST_SECRET), false);
  const good = signedTestReceipt(baseQuote, { quotePublication: true });
  assert.equal(verifyApproval(baseQuote, good, TEST_SECRET), true);
  assert.ok(buildApprovedAnnals([baseQuote], [good], TEST_SECRET).html.includes(
    'This is an invented test quotation.'));
});

test('recipe verification and named attribution are separately consent-gated', () => {
  assert.equal(verifyApproval(baseDrink, signedTestReceipt(baseDrink), TEST_SECRET), false);
  const named = { ...baseDrink, credit: 'Test Contributor' };
  assert.equal(verifyApproval(named, signedTestReceipt(named, { recipeVerified: true }), TEST_SECRET),
    false);
  assert.equal(verifyApproval(named, signedTestReceipt(named,
    { recipeVerified: true, namedAttribution: true }), TEST_SECRET), true);
});

test('cocktail photo publication requires separate image consent and renders only its digest-bound alt text', () => {
  const photo = { ...baseDrink, photo: { sha256: 'c'.repeat(64), alt: 'Synthetic drink <script>alert(1)</script>' } };
  const withoutConsent = signedTestReceipt(photo, { recipeVerified: true });
  assert.equal(verifyApproval(photo, withoutConsent, TEST_SECRET), false);
  const approved = signedTestReceipt(photo, { recipeVerified: true, photoPublication: true });
  assert.equal(verifyApproval(photo, approved, TEST_SECRET), true);
  const html = buildApprovedAnnals([photo], [approved], TEST_SECRET).html;
  assert.match(html, /assets\/annals\/sample-cocktail-01\.jpg/);
  assert.match(html, /alt="Synthetic drink &lt;script&gt;alert\(1\)&lt;\/script&gt;"/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.throws(() => validatePublicTextEntry({ ...baseDrink, photo: { sha256:'bad', alt:'x' } }));
});

test('raw emails, extra photograph properties and unknown categories are forbidden', () => {
  assert.throws(() => validatePublicTextEntry({ ...baseDrink, sourceEmail: 'private@example.test' }),
    /Unexpected public entry field/);
  assert.throws(() => validatePublicTextEntry({ ...baseDrink, image: '/private/photo.jpg' }),
    /Unexpected public entry field/);
  assert.throws(() => validatePublicTextEntry({ ...baseDrink, category: 'unverified' }),
    /Unapproved entry category/);
  assert.throws(() => validatePublicTextEntry({ ...baseDrink, category: 'uncategorised' }),
    /Unapproved entry category/);
  assert.throws(() => validatePublicTextEntry({ ...baseDrink, recipe: {
    ...baseDrink.recipe, privateSource: 'email-001',
  } }), /Unexpected recipe field/);
});

test('invalid dates and unsupported recipe/quote crossovers are refused', () => {
  assert.throws(() => validatePublicTextEntry({ ...baseDrink, sortDate: '2026-02-30' }),
    /Unverified or malformed/);
  assert.throws(() => validatePublicTextEntry({ ...baseDrink, sortDate: '2025-12-15' }),
    /Unverified or malformed/);
  assert.throws(() => validatePublicTextEntry({ ...baseDrink, category: 'club_history' }),
    /Unexpected recipe fields/);
  assert.throws(() => validatePublicTextEntry({ ...baseDrink, quoteVerbatim: 'injected' }),
    /Unexpected quotation text/);
});

test('all public text fields are escaped, including attempted HTML attributes and script', () => {
  const attack = {
    ...baseDrink,
    title: 'A <script>alert(1)</script> test',
    summary: '<img src=x onerror=alert(1)>',
    recipe: { ...baseDrink.recipe, steps: ['<svg onload=alert(1)>'] },
  };
  const receipt = signedTestReceipt(attack, { recipeVerified: true });
  const result = buildApprovedAnnals([attack], [receipt], TEST_SECRET);
  assert.ok(result.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(result.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(result.html.includes('&lt;svg onload=alert(1)&gt;'));
  assert.ok(!result.html.includes('<script>alert'));
});

test('duplicates and invalid receipts stop the entire batch, not just one entry', () => {
  const receipt = signedTestReceipt(baseDrink, { recipeVerified: true });
  assert.throws(() => buildApprovedAnnals([baseDrink, baseDrink], [receipt, receipt], TEST_SECRET),
    /Duplicate entry/);
  assert.throws(() => buildApprovedAnnals([baseDrink], [], TEST_SECRET),
    /Invalid publication batch/);
  assert.throws(() => buildApprovedAnnals([baseDrink], [{ ...receipt, signature: 'bad' }],
    TEST_SECRET), /Missing authenticated/);
});

test('a mixed set of fictional entries sorts newest year first with existing navigation', () => {
  const dReceipt = signedTestReceipt(baseDrink, { recipeVerified: true });
  const qReceipt = signedTestReceipt(baseQuote, { quotePublication: true });
  const html = buildApprovedAnnals(
    [baseQuote, baseDrink], [qReceipt, dReceipt], TEST_SECRET,
  ).html;
  assert.ok(html.indexOf('id="year-cocktail-2026"') < html.indexOf('id="year-quotation-2025"'));
  assert.ok(html.includes('href="celebration.html"'));
  assert.ok(html.includes('href="location.html"'));
  assert.ok(html.includes('width=device-width'));
  assert.ok(html.includes('id="sample-cocktail-01"'));
  assert.ok(html.includes('id="sample-quotation-01"'));
  assert.match(html, /href="#collection-cocktail"/);
  assert.match(html, /href="#collection-quotation"/);
  assert.doesNotMatch(html, /(?:id|href)="(?:#)?collection-(?:monthly-gathering|assembly|club-history|artefact)"/);
});

test('empty publication has no accidental test entry or sender data', () => {
  const result = buildApprovedAnnals([], [], '');
  assert.equal(result.entryCount, 0);
  assert.ok(result.html.includes('The record awaits an approved contribution.'));
  assert.doesNotMatch(result.html, /class="annal-collections"|class="annal-collection"/);
  assert.ok(result.html.includes('href="mailto:annals@stammtischbrewery.com"'));
  for (const label of ['The Cocktail Register', 'The Register of Remarks',
    'Monthly Proceedings', 'Annual Assemblies', 'Club History', 'Club Artefacts']) {
    assert.ok(!result.html.includes(label));
  }
  assert.ok(!result.html.includes('synthetic-test'));
  assert.ok(!result.html.includes('example.test'));
});

test('club artefacts are a supported text-only public category', () => {
  const artefact = {
    ...baseDrink, id: 'sample-artefact-01', category: 'artefact',
    title: 'Fictional test keepsake', summary: 'This invented item exists only in a test.',
    recipe: { drinkIngredients: [], syrupIngredients: [], steps: [] },
  };
  const receipt = signedTestReceipt(artefact);
  const result = buildApprovedAnnals([artefact], [receipt], TEST_SECRET);
  assert.ok(result.html.includes('Club Artefacts'));
  assert.ok(result.html.includes('Fictional test keepsake'));
});


test('approved named member credits use their own Annals portraits without identifying anonymous entries', () => {
  for (const [credit, slug] of [['Justin (Fish)', 'fish'], ['Fish', 'fish'], ['Justin', 'fish'],
    ['Marc', 'marc'], ['Matt', 'matt'], ['Ken', 'ken'], ['Jamie', 'jamie'], ['Jerome', 'jerome']]) {
    const entry = { ...baseDrink, credit };
    const receipt = signedTestReceipt(entry, { recipeVerified: true, namedAttribution: true });
    const html = buildApprovedAnnals([entry], [receipt], TEST_SECRET).html;
    assert.ok(html.includes('src="assets/members/annals/' + slug + '-annals.webp"'));
    assert.ok(html.includes('Recorded by ' + credit));
    assert.throws(() => buildApprovedAnnals([entry], [signedTestReceipt(entry,
      { recipeVerified: true })], TEST_SECRET), /Missing authenticated/);
  }
  for (const credit of ['anonymous', 'a club member', 'Unknown Contributor', 'Marc and Matt', 'constructor']) {
    const entry = { ...baseDrink, credit };
    const receipt = signedTestReceipt(entry, { recipeVerified: true, namedAttribution: true });
    const html = buildApprovedAnnals([entry], [receipt], TEST_SECRET).html;
    assert.doesNotMatch(html, /src="assets\/members\/annals\//);
  }
});

test('Register of Remarks shows a verified speaker instead of the contributor beside the exact quote', () => {
  const record = {...baseQuote,credit:'anonymous',speakerPortrait:'ken'};
  const bad = signedTestReceipt(record,{quotePublication:true});
  assert.equal(verifyApproval(record,bad,TEST_SECRET),false);
  const approved = signedTestReceipt(record,{quotePublication:true,namedAttribution:true});
  assert.equal(verifyApproval(record,approved,TEST_SECRET),true);
  const html = buildApprovedAnnals([record],[approved],TEST_SECRET).html;
  assert.match(html,/The Register of Remarks/);
  assert.match(html,/id="collection-quotation"/);
  assert.match(html,/class="annal-remark-card"/);
  assert.match(html,/class="annal-speaker-portrait"/);
  assert.match(html,/src="assets\/members\/annals\/ken-annals\.webp"/);
  assert.match(html,/alt="Illustrated portrait of Ken, the speaker"/);
  assert.match(html,/This is an invented test quotation/);
  assert.doesNotMatch(html,/class="annal-contributor-portrait"|Recorded by/);
  assert.match(html,/\.annal-speaker-portrait\{width:48px/); // iPhone size
  assert.equal(contentDigest(record)===contentDigest({...record,speakerPortrait:'marc'}),false);
  assert.equal(verifyApproval({...record,speakerPortrait:'marc'},approved,TEST_SECRET),false);
});
test('quotation cannot use sender portrait or unsafe speaker metadata', () => {
  const base={...baseQuote,credit:'anonymous'};
  assert.throws(()=>validatePublicTextEntry({...base,contributorPortrait:'fish'}),/Unexpected public entry field/);
  assert.throws(()=>validatePublicTextEntry({...base,contributorPortrait:'fish',speakerPortrait:'ken'}),/Unexpected public entry field/);
  assert.throws(()=>validatePublicTextEntry({...baseDrink,speakerPortrait:'ken'}),/quotation/i);
  for (const bad of ['Ken','../private','fish.webp','https://bad.test/fish.png','',
    '__proto__','ken@example.test']) {
    assert.throws(()=>validatePublicTextEntry({...base,speakerPortrait:bad}),/portrait/i);
  }
});
test('anonymous quotation archive does not infer a speaker or display a name', () => {
  const q={...baseQuote,credit:'anonymous'};
  const approved=signedTestReceipt(q,{quotePublication:true});
  const html=buildApprovedAnnals([q],[approved],TEST_SECRET).html;
  assert.match(html,/The Register of Remarks/);
  assert.doesNotMatch(html,/class="annal-speaker-portrait"/);
  assert.doesNotMatch(html,/class="annal-contributor-portrait"/);
});

