/* Public Annals HTML generator — approved public content only, not an email processor.
 * This module does not read Gmail, private Drive, API keys or external models.
 * It produces a string; callers must separately obtain authenticated human
 * approval and explicitly authorise a publish/deploy integration.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { escapeHtml } from './PrivatePreview.mjs';

const TYPES = Object.freeze({
  cocktail: 'The Cocktail Register',
  quotation: 'The Register of Remarks',
  monthly_gathering: 'Monthly Proceedings',
  assembly: 'Annual Assemblies',
  club_history: 'Club History',
  artefact: 'Club Artefacts',
});

const PUBLIC_KEYS = new Set([
  'id', 'category', 'title', 'summary', 'year', 'dateLabel',
  'sortDate', 'quoteVerbatim', 'recipe', 'credit', 'photo', 'contributorPortrait', 'speakerPortrait'
]);
const RECIPE_KEYS = new Set(['drinkIngredients', 'syrupIngredients', 'steps', 'suggestedSteps']);
// Already-public illustrated portraits used in Celebration of Life; no private images.
const CONTRIBUTOR_PORTRAITS = Object.freeze({
  fish: 'Justin', marc: 'Marc', matt: 'Matt',
  ken: 'Ken', jamie: 'Jamie', jerome: 'Jerome',
});
const RECEIPT_KEYS = new Set([
  'entryId', 'approvedAt', 'reviewedBy', 'consents', 'contentSha256', 'signature'
]);
const PUBLIC_APPROVAL_KEYS = new Set(['entryId', 'approvedAt', 'consents', 'contentSha256', 'signature', 'mode']);
const PUBLIC_REMOVAL_KEYS = new Set(['entryId', 'approvedAt', 'contentSha256', 'signature']);
const CONSENT_KEYS = new Set(['publication', 'quotePublication', 'recipeVerified', 'namedAttribution', 'photoPublication']);
const UNCENSORED_STRONG = /\b(?:motherfucker|motherfucking|fucking|fucked|fucker|fuck|bullshit|shitty|shit|asshole|bastard|bitch|cunt|dickhead)\b/i;

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
  const suggestedSteps = arrayOfLines(recipe.suggestedSteps || [], 'editorial suggested preparation');
  if (suggestedSteps.length > 3 || (suggestedSteps.length && !outputRecipe.drinkIngredients.length)) {
    throw new Error('Invalid suggested method');
  }
  if (suggestedSteps.length) outputRecipe.suggestedSteps = suggestedSteps;
  const quoteVerbatim = limited(input.quoteVerbatim || '', 'quote', 1800);
  if (input.category === 'quotation' && !quoteVerbatim.trim()) throw new Error('Quotation requires verbatim text');
  if (input.category !== 'quotation' && quoteVerbatim) throw new Error('Unexpected quotation text');
  if (input.category === 'cocktail' &&
      !outputRecipe.drinkIngredients.length && !outputRecipe.steps.length && !input.photo) {
    throw new Error('Cocktail requires an actual approved recipe');
  }
  if (input.category !== 'cocktail' && Object.values(outputRecipe).some(a => a.length)) {
    throw new Error('Unexpected recipe fields');
  }
  const output = {
    id: input.id,
    category: input.category,
    title: limited(input.title, 'title', 180, true),
    summary: limited(input.summary, 'summary', 2400, true),
    year, dateLabel, sortDate, quoteVerbatim, recipe: outputRecipe,
    credit: limited(input.credit || 'anonymous', 'credit', 70, true),
  };
  if (input.contributorPortrait !== undefined && input.contributorPortrait !== null) {
    if (typeof input.contributorPortrait !== 'string' ||
        !Object.hasOwn(CONTRIBUTOR_PORTRAITS, input.contributorPortrait) ||
        output.credit !== 'anonymous')
      throw new Error('Invalid public contributor portrait');
    output.contributorPortrait = input.contributorPortrait;
  }
  if (input.speakerPortrait !== undefined && input.speakerPortrait !== null) {
    if (typeof input.speakerPortrait !== 'string' ||
        !Object.hasOwn(CONTRIBUTOR_PORTRAITS, input.speakerPortrait) ||
        input.category !== 'quotation' || input.contributorPortrait != null ||
        output.credit !== 'anonymous') throw new Error('Invalid quotation speaker portrait');
    output.speakerPortrait = input.speakerPortrait;
  }
  if (input.category === 'quotation' && input.contributorPortrait != null)
    throw new Error('A quotation must identify its speaker, never the email submitter');
  if (input.photo !== undefined && input.photo !== null) {
    allowedKeys(input.photo, new Set(['sha256', 'alt']), 'photo');
    if (input.category === 'quotation' || !/^[a-f0-9]{64}$/.test(input.photo.sha256 ?? '')) throw new Error('Invalid cocktail photo');
    output.photo = { sha256: input.photo.sha256, alt: limited(input.photo.alt, 'photo alt text', 180, true) };
  }
  const publicTexts = [output.title, output.summary, output.dateLabel, output.credit, output.quoteVerbatim,
    ...outputRecipe.drinkIngredients, ...outputRecipe.syrupIngredients, ...outputRecipe.steps, ...(outputRecipe.suggestedSteps || [])];
  if (publicTexts.some(s => UNCENSORED_STRONG.test(s))) throw new Error('Uncensored strong profanity must not enter the public archive');
  return Object.freeze(output);
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
    if (!!entry.photo !== (receipt.consents.photoPublication === true)) return false;
    if ((entry.credit !== 'anonymous' && entry.credit !== 'a club member' || entry.speakerPortrait) &&
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

/** Public attestation omits reviewer identity and private consent evidence. */
export function verifyPublicApproval(publicEntry, approval, secret) {
  if (typeof secret !== 'string' || secret.length < 32) return false;
  try {
    const entry = validatePublicTextEntry(publicEntry);
    allowedKeys(approval, PUBLIC_APPROVAL_KEYS, 'public approval');
    allowedKeys(approval.consents, CONSENT_KEYS, 'consent');
    const automatedText = approval.mode === 'standing-consent-text-v1';
    const automatedImage = approval.mode === 'standing-consent-image-v1';
    const automatedRemark = approval.mode === 'standing-consent-quote-v1';
    const automated = automatedText || automatedImage || automatedRemark;
    if (approval.mode !== undefined && !automated) return false;
    // A distinct signed mode is required for an identified quotation speaker.
    if (automated && (entry.credit !== 'anonymous' ||
        approval.consents.quotePublication !== (entry.category === 'quotation') ||
        (automatedRemark && (entry.category !== 'quotation' || !entry.speakerPortrait ||
          entry.contributorPortrait || entry.photo || approval.consents.namedAttribution !== true ||
          approval.consents.photoPublication !== false)) ||
        (!automatedRemark && (entry.speakerPortrait || approval.consents.namedAttribution !== false)) ||
        (automatedText && (entry.photo || approval.consents.photoPublication !== false)) ||
        (automatedImage && (entry.category === 'quotation' || !entry.photo || approval.consents.photoPublication !== true)))) return false;
    if (approval.entryId !== entry.id || !/^\d{4}-\d{2}-\d{2}T/.test(approval.approvedAt ?? '') ||
        approval.consents.publication !== true ||
        (entry.category === 'quotation' && approval.consents.quotePublication !== true) ||
        (entry.category === 'cocktail' && approval.consents.recipeVerified !== true) ||
        (!!entry.photo !== (approval.consents.photoPublication === true)) ||
        ((entry.credit !== 'anonymous' && entry.credit !== 'a club member' || entry.speakerPortrait) && approval.consents.namedAttribution !== true)) return false;
    if (approval.contentSha256 !== contentDigest(entry) || !/^[a-f0-9]{64}$/.test(approval.signature ?? '')) return false;
    const signedMaterial = JSON.stringify(canonical({
      entry,
      approval: { entryId: approval.entryId, approvedAt: approval.approvedAt,
        consents: approval.consents, contentSha256: approval.contentSha256,
        ...(automated ? { mode: approval.mode } : {}) },
    }));
    const expected = createHmac('sha256', secret).update(signedMaterial).digest();
    return timingSafeEqual(expected, Buffer.from(approval.signature, 'hex'));
  } catch { return false; }
}

export function verifyPublicRemoval(publicEntry, removal, secret) {
  if (typeof secret !== 'string' || secret.length < 32) return false;
  try {
    const entry = validatePublicTextEntry(publicEntry);
    allowedKeys(removal, PUBLIC_REMOVAL_KEYS, 'public removal');
    if (removal.entryId !== entry.id || !/^\d{4}-\d{2}-\d{2}T/.test(removal.approvedAt ?? '') ||
        removal.contentSha256 !== contentDigest(entry) || !/^[a-f0-9]{64}$/.test(removal.signature ?? '')) return false;
    const signedMaterial = JSON.stringify(canonical({ operation: 'remove', removal: {
      entryId: removal.entryId, approvedAt: removal.approvedAt, contentSha256: removal.contentSha256,
    } }));
    const expected = createHmac('sha256', secret).update(signedMaterial).digest();
    return timingSafeEqual(expected, Buffer.from(removal.signature, 'hex'));
  } catch { return false; }
}

function approvedEntryMarkup(entry) {
  const esc = escapeHtml;
  const section = (label, items) => items.length
    ? '<h4>' + label + '</h4><ul>' +
      items.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul>' : '';
  const portrait = entry.speakerPortrait
    ? '<img class="annal-speaker-portrait" src="assets/members/' +
      esc(entry.speakerPortrait) + '.webp" alt="Illustrated portrait of ' +
      esc(CONTRIBUTOR_PORTRAITS[entry.speakerPortrait]) +
      ', the speaker" width="64" height="64" loading="lazy" decoding="async">'
    : '';
  const quoteCard = '<div class="annal-remark-card">' + portrait +
    '<div class="annal-remark-words"><blockquote>' + esc(entry.quoteVerbatim) + '</blockquote>' +
      (/\[(?:EXPLETIVE|POOP)\]/.test(entry.quoteVerbatim)
        ? '<p class="annal-quote-note">Editorially censored quotation — not verbatim.</p>' : '') +
    '</div></div>';
  return '<article class="annal-entry' + (entry.category === 'quotation' ? ' annal-remark' : '') + '" id="' + esc(entry.id) + '">' +
    '<p class="annal-type">' + esc(TYPES[entry.category]) + '</p>' +
    (entry.category === 'quotation' ? '' :
      '<div class="annal-title-row"><h4>' + esc(entry.title) + '</h4>' +
      (entry.contributorPortrait
        ? '<img class="annal-contributor-portrait" src="assets/members/' +
          esc(entry.contributorPortrait) + '.webp" alt="Illustrated portrait of ' +
          esc(CONTRIBUTOR_PORTRAITS[entry.contributorPortrait]) +
          ', who contributed this entry" width="44" height="44" loading="lazy" decoding="async">'
        : '') + '</div>') +
    (entry.dateLabel ? '<p class="annal-date">' + esc(entry.dateLabel) + '</p>' : '') +
    (entry.category === 'quotation' ? '' : '<p class="annal-summary">' + esc(entry.summary) + '</p>') +
    (entry.photo ? '<figure class="annal-photo"><img src="assets/annals/' + esc(entry.id) + '.jpg" alt="' + esc(entry.photo.alt) + '" loading="lazy" decoding="async"></figure>' : '') +
    (entry.category === 'quotation' ? quoteCard : '') +
    (entry.category === 'cocktail' ? '<div class="annal-recipe">' +
      section('Ingredients', entry.recipe.drinkIngredients) +
      section('Homemade syrup', entry.recipe.syrupIngredients) +
      section('Preparation recorded by contributor', entry.recipe.steps) +
      (entry.recipe.suggestedSteps?.length ? '<p class="annal-reconstruction-flag">Editorial reconstruction: suggested quantities or methods below are not the original recorded recipe.</p>' : '') +
      section('Editorial suggestions — NOT part of the original recipe',
        entry.recipe.suggestedSteps || []) + '</div>' : '') +
    (entry.category === 'quotation' || entry.credit === 'anonymous' ? '' : '<p class="annal-credit">Recorded by ' + esc(entry.credit) + '</p>') +
    '</article>';
}

export function buildApprovedAnnals(entries, receipts, secret) {
  return buildAnnals(entries, receipts, (entry, receipt) => verifyApproval(entry, receipt, secret));
}

export function buildPublishedAnnals(entries, approvals, secret) {
  return buildAnnals(entries, approvals, (entry, approval) => verifyPublicApproval(entry, approval, secret));
}

function buildAnnals(entries, receipts, verifyReceipt) {
  if (!Array.isArray(entries) || !Array.isArray(receipts) || entries.length !== receipts.length ||
      entries.length > 300) throw new Error('Invalid publication batch');
  const ids = new Set();
  const accepted = [];
  for (let i = 0; i < entries.length; i++) {
    const item = validatePublicTextEntry(entries[i]);
    if (ids.has(item.id)) throw new Error('Duplicate entry');
    ids.add(item.id);
    const receipt = receipts.find(r => r && r.entryId === item.id);
    if (!receipt || !verifyReceipt(item, receipt)) {
      throw new Error('Missing authenticated exact-content approval');
    }
    accepted.push(item);
  }
  if (new Set(receipts.map(r => r && r.entryId)).size !== receipts.length) {
    throw new Error('Duplicate approval receipt');
  }
  accepted.sort((a, b) => b.year - a.year || b.sortDate.localeCompare(a.sortDate) ||
    a.title.localeCompare(b.title));
  // Public collection visibility follows actual approved, published entries only.
  const populatedTypes = Object.entries(TYPES).filter(([category]) =>
    accepted.some(item => item.category === category));
  const collections = populatedTypes.map(([category, label]) => {
    const items = accepted.filter(item => item.category === category);
    const collectionId = 'collection-' + category.replaceAll('_', '-');
    const byYear = new Map();
    for (const item of items) {
      if (!byYear.has(item.year)) byYear.set(item.year, []);
      byYear.get(item.year).push(item);
    }
    const archive = [...byYear].map(([year, yearItems]) =>
      '<section class="annal-year" aria-labelledby="year-' + category + '-' + year + '">' +
      '<h3 id="year-' + category + '-' + year + '">' + year + '</h3>' +
      yearItems.map(approvedEntryMarkup).join('') + '</section>').join('');
    return '<section class="annal-collection" id="' + collectionId + '" aria-labelledby="heading-' + collectionId + '">' +
      '<h2 id="heading-' + collectionId + '">' + escapeHtml(label) + '</h2>' + archive + '</section>';
  }).join('');
  const navigation = populatedTypes.length > 1
    ? '<nav class="annal-collections" aria-label="Browse Annals collections">' +
      populatedTypes.map(([category, label]) =>
        '<a href="#collection-' + category.replaceAll('_', '-') + '">' + escapeHtml(label) + '</a>').join('') +
      '</nav>'
    : '';
  const emptyState = accepted.length === 0
    ? '<p class="annal-empty">The record awaits an approved contribution.</p>'
    : '';
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
.annal-collections{display:flex;flex-wrap:wrap;gap:8px 20px;padding-block:20px;border-bottom:1px solid #d4d3c4}
.annal-collections a{display:inline-flex;align-items:center;min-height:44px;color:#193d32;font-size:12px}
.annal-collection{padding-block:34px;border-bottom:1px solid #d4d3c4;scroll-margin-top:24px}
.annal-collection>h2{font-size:34px;color:#846329;margin-bottom:15px}
.annal-year{padding-top:18px}
.annal-year h3{font:600 11px/1.5 Arial,sans-serif;color:#64685e;letter-spacing:.16em;text-transform:uppercase;margin-bottom:7px}
.annal-entry{max-width:790px;padding-block:22px 30px;border-top:1px solid #d4d3c4}
.annal-type{font:600 10px/1.6 Arial,sans-serif;color:#846329;text-transform:uppercase;letter-spacing:.17em}
.annal-entry h4{font:400 clamp(27px,4vw,39px)/1.2 Georgia,serif;margin-top:8px}
.annal-title-row{display:flex;align-items:center;justify-content:space-between;gap:14px;max-width:790px}
.annal-title-row h4{min-width:0}
.annal-contributor-portrait{display:block;width:44px;height:44px;flex:0 0 44px;border:1px solid #846329;border-radius:50%;object-fit:cover;background:#eae5d8}
.annal-date,.annal-credit{color:#64685e;font-size:12px;margin-top:7px}
.annal-summary{margin-top:18px;line-height:1.8;font-size:15px}
.annal-photo{margin:22px 0 0}.annal-photo img{display:block;width:100%;max-width:760px;max-height:70vh;object-fit:contain;background:#eae5d8}
.annal-entry blockquote{border-left:3px solid #846329;padding-left:18px;margin:22px 0;font:italic 22px/1.5 Georgia,serif}
.annal-remark-card{display:flex;gap:18px;align-items:flex-start;max-width:790px;padding:20px;border:1px solid #d4d3c4;border-radius:9px;background:#f4f0e5}
.annal-remark-words{flex:1;min-width:0}
.annal-remark .annal-type{margin-bottom:10px}
.annal-remark blockquote{border:0;margin:0;padding:0;font:italic clamp(19px,3.5vw,25px)/1.45 Georgia,serif;color:#193d32;overflow-wrap:anywhere}
.annal-speaker-portrait{width:64px;height:64px;flex:0 0 64px;border:2px solid #846329;border-radius:50%;object-fit:cover;background:#eae5d8}
.annal-remark .annal-date{margin-bottom:8px}
.annal-remark .annal-quote-note{margin-top:12px}
.annal-recipe{margin-top:22px;padding:18px 22px;background:#eae5d8}
.annal-recipe h4{font:600 12px/1.5 Arial,sans-serif;letter-spacing:.09em;text-transform:uppercase;margin:14px 0 8px}
.annal-recipe ul{margin:0 0 15px;padding-left:20px;font-size:14px}
.annal-empty{padding-block:20px;color:#64685e;font-style:italic}
.annal-contribute{display:inline-flex;align-items:center;min-height:48px;margin-top:18px;padding:10px 16px;background:#193d32;color:#f6f2e9;text-decoration:none;font-size:12px}
.annal-note{margin-top:10px;color:#64685e;font-size:11px}
.annal-editorial-notice{margin:24px 0 38px;padding-top:16px;border-top:1px solid #d4d3c4;color:#64685e;font:italic 12px/1.7 Georgia,serif;max-width:790px}
.annal-quote-note{font:italic 12px/1.6 Georgia,serif;color:#64685e}
.annal-reconstruction-flag{padding:10px 12px;margin-block:16px;border-left:3px solid #846329;background:#eee9de;color:#5f4c2f;font-size:12px}
@media(max-width:700px){.annal-hero{padding-block:38px 30px}.annal-collection{padding-block:27px}.annal-collection>h2{font-size:29px}.annal-entry{padding-block:18px 25px}.annal-contributor-portrait{width:40px;height:40px;flex-basis:40px}.annal-remark-card{gap:12px;padding:14px}.annal-speaker-portrait{width:48px;height:48px;flex-basis:48px}}
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
<p>A considered chronicle of shared occasions, extraordinary refreshments, and matters deemed worthy of posterity. Only verified material approved for public use appears here.</p>
<a class="annal-contribute" href="mailto:annals@stammtischbrewery.com">Members: contribute to the Annals <span aria-hidden="true">→</span></a>
<p class="annal-note">Members only. A submission is considered privately; it is not by itself permission to publish.</p></section>
${navigation}
${collections}${emptyState}
<p class="annal-editorial-notice">The Editorial Committee reserves the right to replace particularly spirited language with conspicuous euphemisms. Historical accuracy is otherwise maintained.</p>
</main>
<footer class="site-footer"><div class="shell footer-inner"><p>The Stammtisch Social Club<span>A tradition of gathering.</span></p><nav aria-label="Footer navigation"><a href="index.html">The Club</a><a href="annals.html" aria-current="page">The Annals</a><a href="celebration.html">Celebration of Life</a><a href="location.html">The Annual Assembly</a></nav></div></footer>
</body></html>`;
  return { html, entryCount: accepted.length };
}
