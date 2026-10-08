import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCandidate, renderPrivatePreview, canPublishFromPilot } from '../scripts/annals/PrivatePreview.mjs';
import { writePreview } from '../scripts/annals/private-preview-cli.mjs';

const source = {
  state: 'private_review_required',
  publicationApproved: false,
  publishable: false,
  sourceId: 'a'.repeat(64),
};

const modelCocktail = {
  category: 'cocktail',
  title: 'Illustrative, not a real club drink',
  summary: 'Synthetic test content. Clarify the handwritten quantities.',
  eventDate: '',
  quoteVerbatim: '',
  recipe: {
    drinkIngredients: ['1/2 oz imaginary syrup', '1 oz test juice'],
    syrupIngredients: ['1 cup test fruit', '1/2 cup water'],
    steps: ['Stir and serve for this test only.'],
  },
  riskFlags: ['handwriting_ambiguous', 'date_unconfirmed'],
};

test('private model candidate is structured and never publication-authorised', () => {
  const c = validateCandidate(modelCocktail);
  assert.equal(c.publiclyApproved, false);
  assert.equal(c.exactContentApproved, false);
  assert.ok(c.riskFlags.includes('recipe_unverified'));
  assert.equal(c.recipe.drinkIngredients[0], '1/2 oz imaginary syrup');
  assert.equal(canPublishFromPilot(), false);
});

test('unknown category, absent risk analysis, or missing quote is rejected', () => {
  assert.throws(() => validateCandidate({ ...modelCocktail, category: 'system_command' }), /Unrecognised category/);
  assert.throws(() => validateCandidate({ ...modelCocktail, riskFlags: undefined }), /Missing or unsupported/);
  assert.throws(() => validateCandidate({ ...modelCocktail, category: 'quotation' }), /verbatim/);
  assert.throws(() => validateCandidate({
    ...modelCocktail, recipe: { ...modelCocktail.recipe, steps: ['x'.repeat(1000)] },
  }), /Invalid steps/);
});

test('previews escape user-provided HTML and never include unapproved runnable markup', () => {
  const html = renderPrivatePreview({
    ...modelCocktail,
    title: 'Test <img src=x onerror=alert(1)>',
    summary: 'An example with <script>not real</script> & a quote.',
    recipe: { ...modelCocktail.recipe, steps: ['<svg onload=alert(2)>'] },
  }, source);
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&lt;script&gt;not real&lt;/script&gt;'));
  assert.ok(html.includes('&lt;svg onload=alert(2)&gt;'));
  assert.ok(!html.includes('<script>not real</script>'));
  assert.match(html, /PRIVATE DRAFT — NOT APPROVED FOR PUBLICATION/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
});

test('a draft cannot be previewed as though it were approved public evidence', () => {
  assert.throws(() => renderPrivatePreview(modelCocktail, { ...source, publishable: true }), /PRIVATE source/);
  assert.throws(() => renderPrivatePreview(modelCocktail, { ...source, state: 'published' }), /PRIVATE source/);
});

test('private preview can be written to a temporary directory outside GitHub without printing secrets', () => {
  const temp = mkdtempSync(join(tmpdir(), 'annals-private-test-'));
  try {
    const sourceFile = join(temp, 'source.json');
    const modelFile = join(temp, 'candidate.json');
    const output = join(temp, 'preview.html');
    writeFileSync(sourceFile, JSON.stringify(source));
    writeFileSync(modelFile, JSON.stringify(modelCocktail));
    assert.deepEqual(writePreview(sourceFile, modelFile, output), { written: true });
    assert.ok(existsSync(output));
    assert.match(readFileSync(output, 'utf8'), /Illustrative, not a real club drink/);
    assert.throws(() => writePreview(sourceFile, modelFile, output), /EEXIST/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('private preview path refuses the public GitHub checkout', () => {
  const temp = mkdtempSync(join(tmpdir(), 'annals-private-test-'));
  try {
    const sourceFile = join(temp, 'source.json');
    const modelFile = join(temp, 'candidate.json');
    writeFileSync(sourceFile, JSON.stringify(source));
    writeFileSync(modelFile, JSON.stringify(modelCocktail));
    const dangerous = new URL('../test-annals-private-preview.html', import.meta.url).pathname;
    assert.throws(() => writePreview(sourceFile, modelFile, dangerous),
      /Refusing to write PRIVATE preview inside the public repository/);
    assert.ok(!existsSync(dangerous));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
