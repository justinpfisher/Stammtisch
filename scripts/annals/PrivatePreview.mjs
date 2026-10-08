/* Private Annals editorial preview: no external AI calls, mail or GitHub writes.
 * An external model may eventually produce a candidate adhering to this
 * contract, but a valid shape is NOT factual verification or publication consent.
 */
export const CATEGORIES = Object.freeze([
  'cocktail', 'quotation', 'monthly_gathering', 'assembly', 'club_history', 'uncategorised',
]);

export const RISK_FLAGS = Object.freeze([
  'recipe_unverified', 'handwriting_ambiguous', 'possible_personal_identifier',
  'faces_or_reflections', 'location_or_home_context', 'date_unconfirmed',
  'attribution_unconfirmed', 'quote_consent_unconfirmed', 'private_context',
  'unknown_attachment', 'photo_transcription_unverified', 'other_uncertainty',
]);

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function boundedText(value, label, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new Error('Invalid ' + label);
  }
  return value;
}

function recipeLines(lines, label) {
  if (!Array.isArray(lines) || lines.length > 30) throw new Error('Invalid ' + label);
  return lines.map((entry, i) => boundedText(entry, label + '[' + i + ']', 220, true));
}

export function validateCandidate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Expected candidate object');
  if (!CATEGORIES.includes(raw.category)) throw new Error('Unrecognised category');
  const title = boundedText(raw.title, 'title', 160, true);
  const summary = boundedText(raw.summary, 'summary', 1800, true);
  const eventDate = boundedText(raw.eventDate || '', 'eventDate', 32);
  const quote = boundedText(raw.quoteVerbatim || '', 'quoteVerbatim', 1500);
  if (raw.category === 'quotation' && !quote.trim()) throw new Error('A quote must have verbatim source text');
  const flags = raw.riskFlags;
  if (!Array.isArray(flags) || flags.length > RISK_FLAGS.length ||
      flags.some(v => !RISK_FLAGS.includes(v))) throw new Error('Missing or unsupported risk flags');
  const uniqueFlags = [...new Set(flags)];
  const recipe = raw.recipe || { drinkIngredients: [], syrupIngredients: [], steps: [] };
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) throw new Error('Invalid recipe');
  const normalRecipe = {
    drinkIngredients: recipeLines(recipe.drinkIngredients || [], 'drinkIngredients'),
    syrupIngredients: recipeLines(recipe.syrupIngredients || [], 'syrupIngredients'),
    steps: recipeLines(recipe.steps || [], 'steps'),
  };
  if (raw.category !== 'cocktail' && normalRecipe.drinkIngredients.length) {
    throw new Error('Ingredients belong in a cocktail entry');
  }
  if (raw.category === 'cocktail' && !uniqueFlags.includes('recipe_unverified')) {
    // All OCR/AI-extracted recipes need the creator's factual review.
    uniqueFlags.push('recipe_unverified');
  }
  return Object.freeze({
    schemaVersion: 1, category: raw.category, title, summary, eventDate,
    quoteVerbatim: quote, recipe: normalRecipe, riskFlags: uniqueFlags,
    publiclyApproved: false, exactContentApproved: false,
  });
}

export function renderPrivatePreview(candidate, source) {
  if (!source || source.state !== 'private_review_required' ||
      source.publicationApproved !== false || source.publishable !== false) {
    throw new Error('Only an unapproved PRIVATE source can be previewed');
  }
  const c = validateCandidate(candidate);
  const list = (items) => items.length
    ? '<ul>' + items.map(v => '<li>' + escapeHtml(v) + '</li>').join('') + '</ul>'
    : '<p>Not supplied.</p>';
  const maybeQuote = c.category === 'quotation'
    ? '<section><h2>Original quotation (verify consent)</h2><blockquote>' +
      escapeHtml(c.quoteVerbatim) + '</blockquote></section>' : '';
  const recipe = c.category === 'cocktail'
    ? '<section><h2>Drink ingredients</h2>' + list(c.recipe.drinkIngredients) +
      '<h2>Homemade syrup</h2>' + list(c.recipe.syrupIngredients) +
      '<h2>Method</h2>' + list(c.recipe.steps) + '</section>'
    : '';
  const flags = c.riskFlags.length
    ? list(c.riskFlags.map(f => f.replaceAll('_', ' '))) : '<p>None suggested by model; human review still required.</p>';
  // No external assets, stylesheets or links: this is a SELF-CONTAINED PRIVATE preview.
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">' +
    '<meta name="robots" content="noindex, nofollow"><title>PRIVATE — Annals draft</title>' +
    '<style>body{max-width:720px;margin:2rem auto;padding:1rem;font:17px/1.6 Georgia,serif;color:#203e33}' +
    '.banner{padding:1rem;background:#f0e5c7;border:2px solid #956b26}h1{line-height:1.2}' +
    'small{color:#5f655c}li{margin-block:.3rem}</style></head><body>' +
    '<div class="banner"><strong>PRIVATE DRAFT — NOT APPROVED FOR PUBLICATION</strong>' +
    '<p>AI-suggested or synthetic preview. Verify every fact and sensitive detail against the original.</p></div>' +
    '<main><small>' + escapeHtml(c.category.replaceAll('_', ' ')) + '</small><h1>' +
    escapeHtml(c.title) + '</h1><p>' + escapeHtml(c.summary) + '</p>' +
    (c.eventDate ? '<p><strong>Proposed date, not verified: </strong>' +
      escapeHtml(c.eventDate) + '</p>' : '') +
    maybeQuote + recipe + '<section><h2>Review flags</h2>' + flags + '</section>' +
    '<p><strong>Publication:</strong> blocked. No sender or guest information is published.</p>' +
    '</main></body></html>';
}

export function canPublishFromPilot() {
  // No approval authority or public publisher exists in this prototype.
  return false;
}
