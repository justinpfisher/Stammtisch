/* Annals liberal publication policy: default to publishing eligible member text,
 * not manual review. Hold ONLY for a concrete rights, safety or factual risk.
 * This module never authenticates consent, calls AI or signs public content.
 * Caller validates both consents, source freshness, permissions and budget.
 */
var AnnalsAuto = (function () {
  'use strict';
  var MODE = 'standing-consent-text-v1';
  var NOTICE = 'The Editorial Committee reserves the right to replace particularly spirited language with conspicuous euphemisms. Historical accuracy is otherwise maintained.';
  var CATEGORIES = ['cocktail', 'quotation', 'monthly_gathering', 'assembly', 'club_history', 'artefact'];
  // Specific hard stops. Generic club language ("home", "family", "history",
  // "photograph") is NOT inherently a reason to suppress innocent text.
  var PRIVATE_DATA = /(?:\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|https?:\/\/|www\.|\b(?:\+?1[- .]?)?\(?[2-9]\d{2}\)?[- .][2-9]\d{2}[- .]\d{4}\b|\b\d{1,5}\s+[\w'-]+\s+(?:street|st\.|avenue|ave\.|road|rd\.|drive|lane|boulevard|blvd\.)\b|\b(?:password|passcode|access code|door code|postal code|credit card|bank account|home address|private address|personal phone|private message|confidential|secret|medical diagnosis)\b|^\s*(?:from|sent|subject|to|cc|bcc)\s*:|^\s*>|^\s*--\s*$|<[^>]+>|\b(?:ignore previous instructions|system prompt|developer instructions|api key|publish this regardless|override safeguards)\b)/im;
  var ALLEGATION = /\b(?:accused of|allegedly|arrested for|charged with|fraud|assault|abuse|crime|criminal|illegal activity|diagnosed with|passed away|died by suicide)\b/i;
  var IDENTIFYING = /\b(?:Justin|Marc|Matt|Ken|Jamie|Jerome)\b/i;
  var THIRD_PARTY = /\b(?:he said|she said|they said|according to|quoted from|overheard|guest named|colleague named|Mr\.|Mrs\.|Dr\.)\b/i;
  var MEDIA_DEPENDENT = /\b(?:as pictured|in the photo|see (?:the )?(?:photo|image|picture|attachment|scan|file)|attached (?:photo|image|picture|recipe)|image says|photo shows|pictured here)\b/i;
  var NAMED_PERSON = /\b(?:with|by|from|said|called|named|met)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/;
  var HARD_FLAGS = ['recipe_unverified','handwriting_ambiguous','possible_personal_identifier','location_or_home_context','private_context','quote_consent_unconfirmed'];
  var MAY_IGNORE_MEDIA_FLAGS = ['faces_or_reflections','unknown_attachment','photo_transcription_unverified'];
  function censor(value) {
    if (typeof value !== 'string') throw new Error('Invalid editorial text');
    return value.replace(/\b(?:tastes?|smells?)\s+like\s+shit\b/gi, function (part) {
      return part.replace(/\bshit\b/i, '[POOP]');
    }).replace(/\b(?:motherfucker|motherfucking|fucking|fucked|fucker|fuck|bullshit|shitty|shit|asshole|bastard|bitch|cunt|dickhead)\b/gi, '[EXPLETIVE]');
  }
  function norm(value) { return String(value).trim().replace(/^\s*[-*•]\s*/, '').replace(/\s+/g, ' ').toLowerCase(); }
  function held(reason) { return { eligible: false, reason: reason }; }
  function sourceGrounded(source, phrase) {
    return !!norm(phrase) && norm(source).indexOf(norm(phrase)) >= 0;
  }
  function independentText(text) { return !MEDIA_DEPENDENT.test(text); }
  function protectedText(text) {
    return PRIVATE_DATA.test(text) || ALLEGATION.test(text) ||
      IDENTIFYING.test(text) || THIRD_PARTY.test(text) || NAMED_PERSON.test(text);
  }
  function selfQuotation(text, quote) {
    var match = text.match(/\b(?:my quote|i said|i wrote)\s*:\s*["“]([^"”]+)["”]/i);
    return !!match && norm(match[1]) === norm(quote);
  }
  function reasonableCategory(category, source) {
    // The AI picks the best existing category. Uncertainty over which of two
    // plausible categories to use is editorial, not a privacy stop.
    if (CATEGORIES.indexOf(category) < 0) return false;
    if (category === 'cocktail') return /\b(?:cocktail|drink|recipe|syrup|juice|garnish|mix|stir|shake|oz|ml|ounce)\b/i.test(source);
    if (category === 'assembly') return /\b(?:assembly|cottage|retreat|annual gathering)\b/i.test(source);
    if (category === 'quotation') return /\b(?:my quote|i said|i wrote)\b/i.test(source);
    return true;
  }
  function sourceRecipeGrounded(source, recipe) {
    if (!recipe || !Array.isArray(recipe.drinkIngredients) || !Array.isArray(recipe.syrupIngredients) ||
        !Array.isArray(recipe.steps)) return false;
    var all = recipe.drinkIngredients.concat(recipe.syrupIngredients, recipe.steps);
    if (!recipe.drinkIngredients.length || all.length > 60 ||
        all.some(function (line) { return typeof line !== 'string' || !sourceGrounded(source,line); })) return false;
    // Every original measurement line must be retained. Editorial commentary,
    // headings and informal banter do not have to be copied into the recipe.
    var quantity = /(?:^|\s)(?:\d+(?:[./]\d+)?|[¼½¾])\s*(?:oz\b|ounces?\b|ml\b|mL\b|cl\b|g\b|grams?\b|cups?\b|tbsp\b|tsp\b|dash(?:es)?\b|drops?\b|parts?\b)/i;
    var measurementLines = source.split(/\r?\n/).map(norm).filter(function (line) { return quantity.test(line); });
    if (measurementLines.some(function (line) {
      return !all.some(function (part) { return norm(part) === line; });
    })) return false;
    // A submitted syrup preparation is material, not an optional flourish.
    if (/\b(?:homemade syrup|make (?:the )?syrup|simmer (?:the )?syrup)\b/i.test(source) &&
        !recipe.syrupIngredients.length && !recipe.steps.some(function (step) { return /syrup/i.test(step); })) return false;
    return true;
  }
  function propose(privateSource, candidate, id) {
    if (!privateSource || !privateSource.source || !candidate ||
        !/^[a-f0-9]{64}$/.test(id || '') ||
        privateSource.senderAuthenticated !== true ||
        privateSource.aiConsentActive !== true ||
        privateSource.autoConsentAtReceipt !== true) return held('consent_or_source_missing');
    var s = privateSource.source;
    if (typeof s.excerpt !== 'string' || !s.excerpt.trim() || s.excerptTruncated ||
        typeof s.subject !== 'string' || s.subject.length > 160 ||
        s.excerpt.length > 1800) return held('source_incomplete');
    var source = s.excerpt.trim(), full = (s.subject.trim() + '\n' + source).trim();
    if (protectedText(full)) return held('private_personal_or_sensitive_content');
    var media = privateSource.attachmentManifest;
    if (!media || !Array.isArray(media.items) || !independentText(full)) return held('media_context_required');
    if (!Array.isArray(candidate.riskFlags) || candidate.riskFlags.some(function (flag) {
      return HARD_FLAGS.indexOf(flag) >= 0 ||
        (MAY_IGNORE_MEDIA_FLAGS.indexOf(flag) >= 0 && !independentText(full));
    })) return held('material_uncertainty');
    if (!reasonableCategory(candidate.category, full)) return held('classification_not_supported');
    if (candidate.eventDate && !sourceGrounded(full,candidate.eventDate)) return held('date_claim_unverified');
    if (typeof candidate.title !== 'string' || !candidate.title.trim() || candidate.title.length > 160 ||
        protectedText(candidate.title)) return held('title_missing_or_sensitive');
    // Model-created headlines are editorial labels, not historical evidence.
    // Prefer an innocuous original subject to unsupported model-created claims.
    var title = sourceGrounded(full,candidate.title) ? candidate.title.trim() : s.subject.trim();
    if (!title || protectedText(title) || /(?:first ever|official record|unanimously decided|every member|all six were present)\b/i.test(title))
      return held('title_asserts_unverified_fact');
    var recipe = candidate.recipe;
    if (!recipe || !Array.isArray(recipe.drinkIngredients) || !Array.isArray(recipe.syrupIngredients) || !Array.isArray(recipe.steps))
      return held('invalid_recipe');
    var all = recipe.drinkIngredients.concat(recipe.syrupIngredients,recipe.steps);
    if (candidate.category === 'cocktail') {
      if (!sourceRecipeGrounded(source, recipe)) return held('recipe_measure_or_step_uncertain');
    } else if (all.length) return held('unexpected_recipe');
    var quote = '';
    if (candidate.category === 'quotation') {
      if (typeof candidate.quoteVerbatim !== 'string' || !selfQuotation(source,candidate.quoteVerbatim) ||
          /\b(?:he|she|they|someone|guest|member|friend)\s+said\b/i.test(source)) return held('third_party_quotation_permission');
      quote = censor(candidate.quoteVerbatim);
    } else if (candidate.quoteVerbatim) return held('uncategorised_quote');
    var stamp = new Date(s.receivedAt);
    if (isNaN(stamp.getTime()) || stamp.getUTCFullYear() < 1990 || stamp.getUTCFullYear() > 2100) return held('invalid_receipt_date');
    var entry = { id: 'annal-' + id.slice(0,24), category: candidate.category, title: censor(title),
      summary: censor(source), year: stamp.getUTCFullYear(),
      dateLabel: 'Submitted ' + stamp.toISOString().slice(0,7), sortDate: '',
      quoteVerbatim: quote,
      recipe: { drinkIngredients: recipe.drinkIngredients.map(censor),
        syrupIngredients: recipe.syrupIngredients.map(censor), steps: recipe.steps.map(censor) },
      credit: 'anonymous' };
    return { eligible: true, entry: entry, mode: MODE };
  }
  return Object.freeze({ MODE: MODE, NOTICE: NOTICE, censor: censor, independentText: independentText, propose: propose });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = AnnalsAuto;
