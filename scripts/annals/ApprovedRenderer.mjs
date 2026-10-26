import Photos from './PhotoContracts.js';
/* Public Annals HTML generator — approved public content only, not an email processor.
 * This module does not read Gmail, private Drive, API keys or external models.
 * It produces a string; callers must separately obtain authenticated human
 * approval and explicitly authorise a publish/deploy integration.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { escapeHtml } from './PrivatePreview.mjs';
import { displayDate, editorialHtml, recipeIntroduction, EDITORIAL_NOTICE, siteHeader, siteFooter } from './EditorialDisplay.mjs';
import { emptyHistory, validateHistory } from './HistoryPublisher.mjs';
import {validateEditorialManifest} from './EditorialPhotoManifest.mjs';

const TYPES = Object.freeze({
  cocktail: 'The Cocktail Register',
  quotation: 'The Register of Remarks',
  monthly_gathering: 'Club Occasions',
  assembly: 'Annual Assemblies',
  club_history: 'Archival Records',
  artefact: 'Club Keepsakes',
});

const PUBLIC_KEYS = new Set([
  'id', 'category', 'title', 'summary', 'year', 'dateLabel',
  'sortDate', 'quoteVerbatim', 'recipe', 'credit', 'photo', 'photos', 'correction', 'submittedAt', 'eventPeriod', 'speakerPortrait', 'contributorPortrait'
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
      !outputRecipe.drinkIngredients.length && !outputRecipe.steps.length && !input.photo && !input.photos) {
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
  if (input.correction !== undefined) {
    allowedKeys(input.correction,new Set(['at','note']),'correction');
    const correctionAt=limited(input.correction.at,'correction timestamp',40,true);
    if(!/^\d{4}-\d\d-\d\dT/.test(correctionAt)||!Number.isFinite(Date.parse(correctionAt)))throw new Error('Invalid correction timestamp');
    output.correction={at:correctionAt,note:limited(input.correction.note,'correction note',250,true)};
  }
  if (input.photos !== undefined) {
    if (input.photo || input.category === 'quotation') throw new Error('Conflicting photo representation');
    output.photos = Photos.validate(input.photos);
  }
  if (input.submittedAt !== undefined) {
    if (typeof input.submittedAt !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(input.submittedAt) || !Number.isFinite(Date.parse(input.submittedAt))) throw new Error('Invalid submission date');
    output.submittedAt = input.submittedAt;
  }
  if (input.eventPeriod !== undefined) output.eventPeriod = Photos.period(input.eventPeriod);
  // A verified sender is shown without publishing their email address or name.
  if (input.contributorPortrait !== undefined && input.contributorPortrait !== null) {
    if (typeof input.contributorPortrait !== 'string' ||
        !Object.hasOwn(CONTRIBUTOR_PORTRAITS, input.contributorPortrait) ||
        input.category === 'quotation' || output.credit !== 'anonymous')
      throw new Error('Invalid contributor portrait for this entry');
    output.contributorPortrait = input.contributorPortrait;
  }
  if (input.speakerPortrait !== undefined && input.speakerPortrait !== null) {
    if (typeof input.speakerPortrait !== 'string' ||
        !Object.hasOwn(CONTRIBUTOR_PORTRAITS, input.speakerPortrait) ||
        input.category !== 'quotation' || output.credit !== 'anonymous') throw new Error('Invalid quotation speaker portrait');
    output.speakerPortrait = input.speakerPortrait;
  }
  if (input.photo !== undefined && input.photo !== null) {
    allowedKeys(input.photo, new Set(['sha256', 'alt']), 'photo');
    if (input.category === 'quotation' || !/^[a-f0-9]{64}$/.test(input.photo.sha256 ?? '')) throw new Error('Invalid cocktail photo');
    output.photo = { sha256: input.photo.sha256, alt: limited(input.photo.alt, 'photo alt text', 180, true) };
  }
  const publicTexts = [output.title, output.summary, output.dateLabel, output.credit, output.quoteVerbatim,
    ...outputRecipe.drinkIngredients, ...outputRecipe.syrupIngredients, ...outputRecipe.steps, ...(outputRecipe.suggestedSteps || []), ...(output.correction ? [output.correction.note] : []), ...(output.photo ? [output.photo.alt] : []), ...(output.photos || []).flatMap(p => [p.alt,p.caption || ''])];
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
    if (!!(entry.photo || entry.photos) !== (receipt.consents.photoPublication === true)) return false;
    if ((entry.credit !== 'anonymous' && entry.credit !== 'a club member' || entry.speakerPortrait || entry.contributorPortrait) &&
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
    const openText = approval.mode === 'open-email-text-v1';
    const automatedImage = approval.mode === 'standing-consent-image-v1';
    const automatedGallery = approval.mode === 'standing-consent-photos-v2';
    const automatedRemark = approval.mode === 'standing-consent-quote-v1';
    const automated = automatedText || openText || automatedImage || automatedGallery || automatedRemark;
    if (approval.mode !== undefined && !automated) return false;
    // A distinct signed mode is required for an identified quotation speaker.
    if (automated && (entry.credit !== 'anonymous' ||
        approval.consents.quotePublication !== (entry.category === 'quotation') ||
        (automatedRemark && (entry.category !== 'quotation' || !entry.speakerPortrait ||
          entry.contributorPortrait ||
          (entry.photo || entry.photos) || approval.consents.namedAttribution !== true ||
          approval.consents.photoPublication !== false)) ||
        (!automatedRemark && (entry.speakerPortrait || approval.consents.namedAttribution !== !!entry.contributorPortrait)) ||
        ((automatedText || openText) && ((entry.photo || entry.photos) || approval.consents.photoPublication !== false)) ||
        (openText && (entry.speakerPortrait || entry.contributorPortrait || approval.consents.namedAttribution !== false)) ||
        (automatedImage && (entry.category === 'quotation' || !entry.photo || entry.photos || approval.consents.photoPublication !== true)) ||
        (automatedGallery && (entry.category === 'quotation' || !entry.photos || entry.photo || approval.consents.photoPublication !== true)))) return false;
    if (approval.entryId !== entry.id || !/^\d{4}-\d{2}-\d{2}T/.test(approval.approvedAt ?? '') ||
        approval.consents.publication !== true ||
        (entry.category === 'quotation' && approval.consents.quotePublication !== true) ||
        (entry.category === 'cocktail' && approval.consents.recipeVerified !== true) ||
        (!!(entry.photo || entry.photos) !== (approval.consents.photoPublication === true)) ||
        ((entry.credit !== 'anonymous' && entry.credit !== 'a club member' || entry.speakerPortrait || entry.contributorPortrait) && approval.consents.namedAttribution !== true)) return false;
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

// Owner visually approved these six public derivatives on 10 October 2026.
// Resolve only an exact public credit; never infer identity from private intake.
const MEMBER_PORTRAITS = Object.freeze({
  fish: 'fish', justin: 'fish', 'justin (fish)': 'fish',
  marc: 'marc', matt: 'matt', ken: 'ken', jamie: 'jamie', jerome: 'jerome',
});
function contributorCreditMarkup(credit) {
  if (credit === 'anonymous') return '';
  const key = credit.trim().toLowerCase();
  const member = Object.hasOwn(MEMBER_PORTRAITS, key) ? MEMBER_PORTRAITS[key] : null;
  const portrait = member ? '<img class="annal-contributor-portrait" src="assets/members/annals/' +
    member + '-annals.webp" width="48" height="48" alt="" loading="lazy" decoding="async">' : '';
  return '<p class="annal-credit">' + portrait + '<span>Recorded by ' + editorialHtml(credit) + '</span></p>';
}

function photoMarkup(entry,editorialManifest) {
  return Photos.photos(entry).length ? '<div class="annal-gallery">' + Photos.photos(entry).map((p,i) => {
    const asset = 'assets/annals/' + (entry.photos ? p.sha256 : entry.id) + '.jpg';
    const sourcePath=asset,editorial=editorialManifest&&editorialManifest.images.find(row=>row.source===sourcePath);
    const displayAsset=editorial?editorial.asset:asset;
    const responsive=entry.photos&&Math.max(p.width,p.height)>=800&&!editorial;
    const thumb=responsive?asset.replace(/\.jpg$/,'-thumb.jpg'):asset;
    const thumbWidth=responsive?Math.round(p.width*400/Math.max(p.width,p.height)):p.width;
    const image=editorial
      ? '<picture><source type="image/jpeg" srcset="'+escapeHtml(displayAsset)+'"><img src="'+escapeHtml(asset)+'" '+
        (p.width ? 'width="'+p.width+'" height="'+p.height+'" ' : '')+'alt="'+escapeHtml(editorial.alt)+'" loading="lazy" decoding="async"></picture>'
      : '<img src="'+thumb+'" '+(responsive?'srcset="'+thumb+' '+thumbWidth+'w, '+asset+' '+p.width+'w" sizes="(max-width: 560px) 90vw, (max-width: 900px) 45vw, 360px" ':'')+
        (p.width ? 'width="'+p.width+'" height="'+p.height+'" ' : '')+'alt="'+escapeHtml(p.alt)+'" loading="lazy" decoding="async">';
    return '<figure><a data-photo-view data-photo-sha256="'+p.sha256+'" href="'+asset+'">'+image+'</a>'+(p.caption ? '<figcaption>'+editorialHtml(p.caption)+'</figcaption>' : '')+'</figure>';
  }).join('') + '</div>' : '';
}
function approvedEntryMarkup(entry,editorialManifest) {
  const esc = escapeHtml, text = editorialHtml;
  const introduction = recipeIntroduction(entry);
  const section = (label, items) => items.length
    ? '<h4>' + label + '</h4><ul>' +
      items.map(s => '<li>' + text(s) + '</li>').join('') + '</ul>' : '';
  const speaker = entry.speakerPortrait;
  const speakerMarkup = speaker
    ? '<img class="annal-speaker-portrait" src="assets/members/annals/' +
      esc(speaker) + '-annals.webp" alt="Illustrated portrait of ' +
      esc(CONTRIBUTOR_PORTRAITS[speaker]) +
      ', the speaker" width="66" height="66" loading="lazy" decoding="async">'
    : '';
  // A signed speaker portrait may identify the actual speaker. Do not
  // reinterpret a contributor credit as evidence of who said the words.
  const speakerName = speaker
    ? '<p class="annal-remark-speaker">— ' + esc(CONTRIBUTOR_PORTRAITS[speaker]) + '</p>' : '';
  const quoteCard = '<div class="annal-remark-card"><div class="annal-remark-words">' +
    '<blockquote>' + text(entry.quoteVerbatim) + '</blockquote>' + speakerName +
    (/\[(?:expletive|POOP)\]/i.test(entry.quoteVerbatim)
      ? '<p class="annal-quote-note">Editorially redacted quotation — not verbatim.</p>' : '') +
    '<p class="annal-context"><strong>Editorial context</strong>' + text(entry.summary) + '</p>' +
    '</div>' + speakerMarkup + '</div>';
  const date = entry.submittedAt
    ? '<p class="annal-date">Submitted <time datetime="' + esc(entry.submittedAt) + '">' +
      esc(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', dateStyle: 'long' })
        .format(new Date(entry.submittedAt))) + '</time> (Toronto)' +
      (entry.eventPeriod ? ' · Event: ' + esc(entry.eventPeriod) : ' · Event date unrecorded') + '</p>'
    : entry.dateLabel ? '<p class="annal-date">' + esc(displayDate(entry.dateLabel)) + '</p>' : '';
  const correction = entry.correction
    ? '<p class="annal-date">Corrected <time datetime="' + esc(entry.correction.at) + '">' +
      esc(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', dateStyle: 'long' })
        .format(new Date(entry.correction.at))) + '</time> (Toronto): ' +
      text(entry.correction.note) + '</p>' : '';
  const recipe = entry.category === 'cocktail'
    ? '<div class="annal-recipe"><div class="annal-recipe-column">' +
      section('Ingredients', entry.recipe.drinkIngredients) +
      (entry.recipe.syrupIngredients.length
        ? '<div class="annal-syrup">' + section('Homemade syrup', entry.recipe.syrupIngredients) + '</div>' : '') +
      '</div><div class="annal-recipe-column">' +
      section('Preparation', entry.recipe.steps) + '</div>' +
      (entry.recipe.suggestedSteps?.length
        ? '<div class="annal-suggestion"><p class="annal-reconstruction-flag">Editorial reconstruction: suggested quantities or methods below are not the original recorded recipe.</p>' +
          section('Editorial suggestions — NOT part of the original recipe', entry.recipe.suggestedSteps) + '</div>'
        : '') + '</div>' : '';
  const contributor = entry.category === 'quotation' ? contributorCreditMarkup(entry.credit)
    : entry.contributorPortrait
      ? '<div class="annal-credited-illustration"><img class="annal-contributor-portrait" src="assets/members/annals/' +
        esc(entry.contributorPortrait) + '-annals.webp" alt="Illustrated portrait of ' +
        esc(CONTRIBUTOR_PORTRAITS[entry.contributorPortrait]) +
        ', who contributed this entry" width="42" height="42" loading="lazy" decoding="async">' +
        '<span>Recorded by ' + esc(CONTRIBUTOR_PORTRAITS[entry.contributorPortrait]) + '</span></div>'
      : contributorCreditMarkup(entry.credit);
  const introductionMarkup = entry.category === 'quotation' ? ''
    : (introduction
      ? '<p class="annal-summary">' + text(introduction) + '</p>' : '');
  return '<article class="annal-entry' +
    (entry.category === 'quotation' ? ' annal-remark' : '') +
    (Photos.photos(entry).length ? ' annal-entry--has-photo' : '') +
    '" id="' + esc(entry.id) + '" data-annals-category="' + esc(entry.category) + '">' +
    '<header class="annal-entry-head"><div><p class="annal-type">' +
    esc(TYPES[entry.category]) + '</p><h2 class="annal-entry-title">' +
    text(entry.title) + '</h2>' + date + correction +
    '</div><a class="annal-permalink" href="#' + esc(entry.id) +
    '" aria-label="Direct link to ' + esc(entry.title) + '">↗</a></header>' +
    (entry.category === 'quotation' ? quoteCard
      : '<div class="annal-overview">' + introductionMarkup + photoMarkup(entry,editorialManifest) + '</div>') +
    recipe +
    '<footer class="annal-entry-foot">' + (contributor || '<span>Stammtisch Social Club</span>') +
    '<a class="annal-entry-link" href="#' + esc(entry.id) + '">Link to entry ↗</a></footer>' +
    '</article>';
}

export function buildApprovedAnnals(entries, receipts, secret) {
  return buildAnnals(entries, receipts, (entry, receipt) => verifyApproval(entry, receipt, secret));
}

export function buildPublishedAnnals(entries, approvals, secret, history = emptyHistory(), editorialManifest) {
  validateHistory(history);
  if(editorialManifest)validateEditorialManifest(editorialManifest,entries);
  return buildAnnals(entries, approvals, (entry, approval) => verifyPublicApproval(entry, approval, secret), history, editorialManifest);
}
function buildAnnals(entries, receipts, verifyReceipt, history = emptyHistory(), editorialManifest) {
  if (!Array.isArray(entries) || !Array.isArray(receipts) || entries.length !== receipts.length ||
      entries.length > 10000) throw new Error('Invalid publication batch');
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
  // Newest first by verified submission or public receipt, falling back to source dates.
  const orderTime = item => {
    const receipt = receipts.find(r => r?.entryId === item.id);
    const raw = item.submittedAt || receipt?.approvedAt ||
      (item.sortDate ? item.sortDate + 'T00:00:00Z' : item.year + '-01-01T00:00:00Z');
    return Date.parse(raw);
  };
  accepted.sort((a, b) => orderTime(b) - orderTime(a) || b.year - a.year ||
    b.sortDate.localeCompare(a.sortDate) || a.title.localeCompare(b.title));
  // Filtering enhances static signed HTML; the content is visible without JavaScript.
  const populatedTypes = Object.keys(TYPES).filter(category =>
    accepted.some(item => item.category === category));
  const filterLabels = {
    cocktail: 'Cocktails', quotation: 'Remarks', monthly_gathering: 'Occasions',
    assembly: 'Assemblies', club_history: 'Records', artefact: 'Keepsakes',
  };
  const categoryAnchors = populatedTypes.map(category =>
    '<span class="annal-anchor" id="collection-' +
    category.replaceAll('_', '-') + '" aria-hidden="true"></span>').join('');
  const historyLink = history.chapters.length
    ? '<a class="annal-collection-link" href="history.html">Club History ↗</a>' : '';
  const photosLink = accepted.some(e => Photos.photos(e).length)
    ? '<a class="annal-collection-link" href="photos.html">Photographs ↗</a>' : '';
  const filters = populatedTypes.length > 1
    ? '<a href="#annals-entries" data-annals-filter="all" aria-current="true">All entries</a>' +
      populatedTypes.map(category =>
        '<a href="#collection-' + category.replaceAll('_', '-') +
        '" data-annals-filter="' + category + '">' +
        escapeHtml(filterLabels[category]) + '</a>').join('') : '';
  const navigation = filters || historyLink || photosLink
    ? '<nav class="annal-collections" aria-label="Browse published Annals">' +
      filters + historyLink + photosLink + '</nav>' : '';
  const listHeader = accepted.length
    ? '<div class="annal-toolbar"><div><p class="eyebrow">A living index</p>' +
      '<h2>Recently recorded</h2><p id="annal-result-count" role="status" aria-live="polite">' +
      accepted.length + (accepted.length === 1 ? ' entry shown' : ' entries shown') +
      ' · Newest first</p></div></div>' : '';
  const stream = accepted.length
    ? '<section class="annal-stream" id="annals-entries" aria-label="Published contributions">' +
      accepted.map(item=>approvedEntryMarkup(item,editorialManifest)).join('') + '</section>' : '';
  const emptyState = accepted.length === 0 && !history.chapters.length
    ? '<p class="annal-empty">The record awaits an approved contribution.</p>' : '';
  const html = `<!doctype html>
<html lang="en-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#193d32">
<title>The Annals of Stammtisch | Stammtisch Social Club</title>
<meta name="description" content="A considered record of Stammtisch traditions, cocktails and shared occasions.">
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="annals-photos.css">
<script type="module" src="annals-photos.mjs"></script>
<script type="module" src="annals-browse.mjs"></script>
<link rel="stylesheet" href="annals.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${siteHeader('annals')}
<main id="main" class="shell">
<section class="annal-hero"><div class="annal-hero-inner">
<div><p class="eyebrow">The permanent record</p>
<h1>The <em>Annals of Stammtisch.</em></h1>
<p class="annal-deck">A considered chronicle of shared occasions, extraordinary refreshments, and matters deemed worthy of posterity.</p></div>
<div class="annal-action"><a class="annal-contribute" href="mailto:annals@stammtischbrewery.com">Members: contribute <span aria-hidden="true">→</span></a>
<p class="annal-note">Members only.</p></div></div>
<details class="annal-guidance">
<summary>On Matters Worth Committing to Posterity <span aria-hidden="true">+</span></summary>
<div class="annal-guidance-body">
<p>Contributions are invited to the collected works of six gentlemen. Literary merit is welcome; relevance to the company will suffice.</p>
<ul>
<li><strong>Cocktails &amp; recipes:</strong> For the advancement of the liquid arts. Include ingredients, quantities, and instructions—including any homemade syrups. A photo is welcome, should the spirit move you.</li>
<li><strong>The Register of Remarks:</strong> A turn of phrase that deserves another turn. Send the exact words, who said them, and any essential context. Wit may be borrowed; attribution must be correct.</li>
<li><strong>Club History &amp; keepsakes:</strong> The past remains less orderly than the official record would prefer. Send a recollection, the origins of a tradition, or an artefact worth preserving. The Editorial Committee will shape supported contributions into one continuing account; fragments are entirely acceptable.</li>
<li><strong>Celebration of Life rules:</strong> Rules and amendments are maintained exclusively on the <a href="celebration.html">Celebration of Life page</a>; proposals may still be sent to the member contribution address.</li>
</ul>
<h2>Address the record</h2>
<p>Email <a href="mailto:annals@stammtischbrewery.com">annals@stammtischbrewery.com</a> from your recognised member address. Write normally and attach what you have. No forms, categories, or command of the subjunctive required.</p>
<p>Uncertain dates and details should be identified as such. Memory may take poetic licence; the record should acknowledge it.</p>
<p><strong>Discretion remains the better part of publication.</strong> The Annals are public. Keep private addresses, confidential matters, and other people’s material out unless permission is in place.</p>
<p>Corrections are welcome at the same address. The last word need not be the final version.</p>
</div>
</details></section>
${categoryAnchors}
${listHeader}
${navigation}
${stream}${emptyState}
<p class="annal-editorial-notice">${EDITORIAL_NOTICE}</p>
</main>
${siteFooter('annals')}
</body></html>`;
  return { html, entryCount: accepted.length };
}
