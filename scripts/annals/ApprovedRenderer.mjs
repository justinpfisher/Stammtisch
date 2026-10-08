/* Public Annals HTML generator — approved TEXT ONLY, not an email processor.
 * This module does not read Gmail, private Drive, API keys or external models.
 * It produces a string; callers must separately obtain authenticated human
 * approval and explicitly authorise a publish/deploy integration.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { escapeHtml } from './PrivatePreview.mjs';

const TYPES = Object.freeze({
  cocktail: 'The Cocktail Register',
  quotation: 'Quotations of Questionable Wisdom',
  monthly_gathering: 'Monthly Proceedings',
  assembly: 'Annual Assemblies',
  club_history: 'Club History',
});

const PUBLIC_KEYS = new Set([
  'id', 'category', 'title', 'summary', 'year', 'dateLabel',
  'sortDate', 'quoteVerbatim', 'recipe', 'credit'
]);
const RECIPE_KEYS = new Set(['drinkIngredients', 'syrupIngredients', 'steps']);
const RECEIPT_KEYS = new Set([
  'entryId', 'approvedAt', 'reviewedBy', 'consents', 'contentSha256', 'signature'
]);
const CONSENT_KEYS = new Set(['publication', 'quotePublication', 'recipeVerified', 'namedAttribution']);

const allowedKeys = (object, keys, context) => {
  if (!object || typeof object !== 'object' || Array.isArray(object) ||
      Object.keys(object).some(k => !keys.has(k))) throw new Error('Unexpected ' + context + ' field');
};
const limited = (value, field, max, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new Error('Invalid public ' + field);
  }
  return value;
};
function arrayOfLines(arr, field) {
  if (!Array.isArray(arr) || arr.length > 30) throw new Error('Invalid ' + field);
  return arr.map(x => limited(x, field, 250, true));
}
export function validatePublicTextEntry(input) {
  allowedKeys(input, PUBLIC_KEYS, 'public entry');
  if (!/^[a-z0-9][a-z0-9-]{5,63}$/.test(input.id ?? '')) throw new Error('Invalid public ID');
  if (!Object.hasOwn(TYPES, input.category)) throw new Error('Unapproved entry category');
  const year = input.year;
  if (!Number.isInteger(year) || year < 1990 || year > 2100) throw new Error('Invalid year');
  const dateLabel = limited(input.dateLabel || '', 'date label', 80);
  const sortDate = limited(input.sortDate || '', 'sort date', 10);
  if (sortDate) {
    const date = new Date(sortDate + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sortDate) ||
        Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== sortDate ||
        date.getUTCFullYear() !== year) throw new Error('Unverified or malformed event date');
  }
  const recipe = input.recipe || { drinkIngredients: [], syrupIngredients: [], steps: [] };
  allowedKeys(recipe, RECIPE_KEYS, 'recipe');
  const outputRecipe = {
    drinkIngredients: arrayOfLines(recipe.drinkIngredients || [], 'drink ingredients'),
    syrupIngredients: arrayOfLines(recipe.syrupIngredients || [], 'syrup ingredients'),
    steps: arrayOfLines(recipe.steps || [], 'preparation'),
  };
  const quoteVerbatim = limited(input.quoteVerbatim || '', 'quote', 1800);
  if (input.category === 'quotation' && !quoteVerbatim.trim()) throw new Error('Quotation requires verbatim text');
  if (input.category !== 'quotation' && quoteVerbatim) throw new Error('Unexpected quotation text');
  if (input.category === 'cocktail' &&
      !outputRecipe.drinkIngredients.length && !outputRecipe.steps.length) {
    throw new Error('Cocktail requires an actual approved recipe');
  }
  if (input.category !== 'cocktail' && Object.values(outputRecipe).some(a => a.length)) {
    throw new Error('Unexpected recipe fields');
  }
  return Object.freeze({
    id: input.id,
    category: input.category,
    title: limited(input.title, 'title', 180, true),
    summary: limited(input.summary, 'summary', 2400, true),
    year, dateLabel, sortDate, quoteVerbatim, recipe: outputRecipe,
    credit: limited(input.credit || 'anonymous', 'credit', 70, true),
  });
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = canonical(value[key]);
    return result;
  }
  return value;
}

export function contentDigest(publicEntry) {
  return createHash('sha256').update(JSON.stringify(canonical(
    validatePublicTextEntry(publicEntry)
  ))).digest('hex');
}

/** Approval signatures are created ONLY by a future private, authenticated
 * human-approval service. This public module intentionally does not sign.
 */
export function verifyApproval(publicEntry, receipt, secret) {
  if (typeof secret !== 'string' || secret.length < 32) return false;
  try {
    const entry = validatePublicTextEntry(publicEntry);
    allowedKeys(receipt, RECEIPT_KEYS, 'private approval');
    allowedKeys(receipt.consents, CONSENT_KEYS, 'consent');
    if (receipt.entryId !== entry.id || !/^\d{4}-\d{2}-\d{2}T/.test(receipt.approvedAt ?? '') ||
        typeof receipt.reviewedBy !== 'string' || !receipt.reviewedBy.trim() ||
        receipt.consents.publication !== true) return false;
    if (entry.category === 'quotation' && receipt.consents.quotePublication !== true) return false;
    if (entry.category === 'cocktail' && receipt.consents.recipeVerified !== true) return false;
    if (entry.credit !== 'anonymous' && entry.credit !== 'a club member' &&
        receipt.consents.namedAttribution !== true) return false;
    const digest = contentDigest(entry);
    if (receipt.contentSha256 !== digest ||
        !/^[a-f0-9]{64}$/.test(receipt.signature ?? '')) return false;
    const signedMaterial = JSON.stringify(canonical({
      entry,
      receipt: {
        entryId: receipt.entryId, approvedAt: receipt.approvedAt,
        reviewedBy: receipt.reviewedBy, consents: receipt.consents,
        contentSha256: receipt.contentSha256,
      },
    }));
    const expected = createHmac('sha256', secret).update(signedMaterial).digest();
    return timingSafeEqual(expected, Buffer.from(receipt.signature, 'hex'));
  } catch {
    return false;
  }
}

function approvedEntryMarkup(entry) {
  const esc = escapeHtml;
  const section = (label, items) => items.length
    ? '<h4>' + label + '</h4><ul>' +
      items.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul>' : '';
  return '<article class="annal-entry" id="' + esc(entry.id) + '">' +
    '<p class="annal-type">' + esc(TYPES[entry.category]) + '</p>' +
    '<h3>' + esc(entry.title) + '</h3>' +
    (entry.dateLabel ? '<p class="annal-date">' + esc(entry.dateLabel) + '</p>' : '') +
    '<p class="annal-summary">' + esc(entry.summary) + '</p>' +
    (entry.category === 'quotation' ? '<blockquote>' + esc(entry.quoteVerbatim) + '</blockquote>' : '') +
    (entry.category === 'cocktail' ? '<div class="annal-recipe">' +
      section('Ingredients', entry.recipe.drinkIngredients) +
      section('Homemade syrup', entry.recipe.syrupIngredients) +
      section('Preparation', entry.recipe.steps) + '</div>' : '') +
    (entry.credit === 'anonymous' ? '' : '<p class="annal-credit">Recorded by ' + esc(entry.credit) + '</p>') +
    '</article>';
}

export function buildApprovedAnnals(entries, receipts, secret) {
  if (!Array.isArray(entries) || !Array.isArray(receipts) || entries.length !== receipts.length ||
      entries.length > 300) throw new Error('Invalid publication batch');
  const ids = new Set();
  const accepted = [];
  for (let i = 0; i < entries.length; i++) {
    const item = validatePublicTextEntry(entries[i]);
    if (ids.has(item.id)) throw new Error('Duplicate entry');
    ids.add(item.id);
    const receipt = receipts.find(r => r && r.entryId === item.id);
    if (!receipt || !verifyApproval(item, receipt, secret)) {
      throw new Error('Missing authenticated exact-content approval');
    }
    accepted.push(item);
  }
  if (new Set(receipts.map(r => r && r.entryId)).size !== receipts.length) {
    throw new Error('Duplicate approval receipt');
  }
  accepted.sort((a, b) => b.year - a.year || b.sortDate.localeCompare(a.sortDate) ||
    a.title.localeCompare(b.title));
  const years = new Map();
  for (const item of accepted) {
    if (!years.has(item.year)) years.set(item.year, []);
    years.get(item.year).push(item);
  }
  const body = [...years].map(([year, items]) =>
    '<section class="annal-year" aria-labelledby="year-' + year + '">' +
    '<h2 id="year-' + year + '">' + year + '</h2>' +
    items.map(approvedEntryMarkup).join('') + '</section>').join('') ||
    '<p class="annal-empty">The first entry awaits its appointed occasion.</p>';
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#193d32">
<title>The Annals of Stammtisch | Stammtisch Social Club</title>
<meta name="description" content="A considered record of Stammtisch traditions, cocktails and shared occasions.">
<link rel="stylesheet" href="styles.css">
<style>
.annal-hero{padding-block:65px 45px;border-bottom:1px solid #d4d3c4}
.annal-hero h1{font-size:clamp(44px,7vw,78px);line-height:1.1;margin-top:15px}
.annal-hero p:last-child{max-width:560px;font-size:14px;color:#64685e;margin-top:18px}
.annal-year{padding-block:38px;border-bottom:1px solid #d4d3c4}
.annal-year h2{font-size:34px;color:#846329;margin-bottom:25px}
.annal-entry{max-width:790px;padding-block:22px 30px;border-top:1px solid #d4d3c4}
.annal-type{font:600 10px/1.6 Arial,sans-serif;color:#846329;text-transform:uppercase;letter-spacing:.17em}
.annal-entry h3{font-size:clamp(27px,4vw,39px);line-height:1.2;margin-top:8px}
.annal-date,.annal-credit{color:#64685e;font-size:12px;margin-top:7px}
.annal-summary{margin-top:18px;line-height:1.8;font-size:15px}
.annal-entry blockquote{border-left:3px solid #846329;padding-left:18px;margin:22px 0;font:italic 22px/1.5 Georgia,serif}
.annal-recipe{margin-top:22px;padding:18px 22px;background:#eae5d8}
.annal-recipe h4{font:600 12px/1.5 Arial,sans-serif;letter-spacing:.09em;text-transform:uppercase;margin:14px 0 8px}
.annal-recipe ul{margin:0 0 15px;padding-left:20px;font-size:14px}
.annal-empty{padding-block:50px;font-style:italic}
@media(max-width:700px){.annal-hero{padding-block:38px 30px}.annal-entry{padding-block:18px 25px}}
</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><div class="shell header-inner">
<a class="wordmark" href="index.html" aria-label="Stammtisch Social Club home"><img src="assets/crest-small.webp" width="56" height="56" alt=""><span>Stammtisch<small>Social Club</small></span></a>
<nav aria-label="Main navigation"><a href="index.html#the-club">The Club</a><a href="celebration.html">Celebration of Life</a><a href="location.html">Annual Assembly</a></nav>
</div></header>
<main id="main" class="shell">
<section class="annal-hero"><p class="eyebrow">The permanent record</p>
<h1>The <em>Annals of Stammtisch.</em></h1>
<p>A considered chronicle of shared occasions, extraordinary refreshments, and matters deemed worthy of posterity.</p></section>
${body}
</main>
<footer class="site-footer"><div class="shell footer-inner"><p>The Stammtisch Social Club<span>A tradition of gathering.</span></p><nav aria-label="Footer navigation"><a href="index.html">The Club</a><a href="celebration.html">Celebration of Life</a></nav></div></footer>
</body></html>`;
  return { html, entryCount: accepted.length };
}
