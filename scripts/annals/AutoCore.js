/* Stammtisch Annals: conservative, source-grounded automatic text-publication policy.
 * No account, network, credentials, third-party evidence or publication rights.
 * The server MUST independently verify authenticated sender, both standing
 * consents, source age, activation state, budget, storage and signing.
 * Anything uncertain is held privately, never silently rewritten.
 */
var AnnalsAuto = (function () {
  'use strict';
  var MODE = 'standing-consent-text-v1';
  var NOTICE = 'The Editorial Committee reserves the right to replace particularly spirited language with conspicuous euphemisms. Historical accuracy is otherwise maintained.';
  var CATEGORIES = ['cocktail', 'monthly_gathering', 'assembly', 'club_history', 'artefact'];
  var UNSAFE = /(?:\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|https?:\/\/|www\.|\b(?:\+?1[- .]?)?\(?[2-9]\d{2}\)?[- .][2-9]\d{2}[- .]\d{4}\b|\b\d{1,5}\s+[\w'-]+\s+(?:street|st\.|avenue|ave\.|road|rd\.|drive|lane|boulevard|blvd\.)\b|\b(?:address|postal code|password|phone|contact details|bank account|credit card|workplace|employer|family|wife|husband|girlfriend|boyfriend|children|child|daughter|son|neighbour|neighbor|guest|identifiable|private|confidential|secret|home|house|bedroom|illness|medical|accused|alleged|arrested|fraud|assault|crime|died|death|passed away|obituary|celebrity)\b|<[^>]+>|^\s*(?:from|sent|subject|to|cc|bcc)\s*:|^\s*>|^\s*--\s*$|\b(?:ignore previous instructions|system prompt|developer instructions|api key|publish this regardless|override safeguards)\b)/im;
  var NAMED_MEMBERS = /\b(?:Justin|Marc|Matt|Ken|Jamie|Jerome)\b/i;
  var DIRECT_QUOTATION = /["“”«»]/;
  var MEDIA_DEPENDENT = /\b(?:attached|attachment|photograph|photo|pictured|image|picture|scan|see the file|look at the picture)\b/i;
  var KNOWN_NONPERSON_PHRASES = ['Old Fashioned', 'Annual Assembly', 'Stammtisch Social Club', 'Cocktail Register'];
  function censor(value) {
    if (typeof value !== 'string') throw new Error('Invalid editorial text');
    return value.replace(/\b(?:tastes?|smells?)\s+like\s+shit\b/gi, function (part) {
      return part.replace(/\bshit\b/i, '[POOP]');
    }).replace(/\b(?:motherfucker|motherfucking|fucking|fucked|fucker|fuck|bullshit|shitty|shit|asshole|bastard|bitch|cunt|dickhead)\b/gi, '[EXPLETIVE]');
  }
  function norm(value) { return String(value).trim().replace(/^\s*[-*•]\s*/, '').replace(/\s+/g, ' ').toLowerCase(); }
  function held(reason) { return { eligible: false, reason: reason }; }
  function sourceGrounded(source, phrase) {
    return norm(phrase).length > 0 && norm(source).indexOf(norm(phrase)) >= 0;
  }
  function simplePublicText(source) {
    if (UNSAFE.test(source) || NAMED_MEMBERS.test(source) || DIRECT_QUOTATION.test(source)) return false;
    // Catch unverified full names, while excluding a few established non-person terms.
    var scrubbed = String(source);
    KNOWN_NONPERSON_PHRASES.forEach(function (term) { scrubbed = scrubbed.split(term).join(''); });
    return !/\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/.test(scrubbed);
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
    var sourceText = s.excerpt.trim();
    var fullText = (s.subject.trim() + '\n' + sourceText).trim();
    if (!simplePublicText(fullText)) return held('privacy_or_unverified_language');
    if (!Array.isArray(candidate.riskFlags) || candidate.riskFlags.length ||
        CATEGORIES.indexOf(candidate.category) < 0 || candidate.quoteVerbatim ||
        candidate.eventDate) return held('classification_or_uncertainty');
    if (!sourceGrounded(fullText, candidate.title) || candidate.title.length > 160 ||
        !simplePublicText(candidate.title)) return held('unverified_title');
    if (!Array.isArray(privateSource.attachmentManifest && privateSource.attachmentManifest.items) ||
        privateSource.attachmentManifest.held ||
        (privateSource.attachmentManifest.items.length && MEDIA_DEPENDENT.test(fullText))) {
      return held('media_requires_review');
    }
    var recipe = candidate.recipe;
    if (!recipe || !Array.isArray(recipe.drinkIngredients) ||
        !Array.isArray(recipe.syrupIngredients) || !Array.isArray(recipe.steps)) return held('recipe_not_structured');
    var allLines = recipe.drinkIngredients.concat(recipe.syrupIngredients, recipe.steps);
    if (candidate.category === 'cocktail') {
      if (!recipe.drinkIngredients.length || !recipe.steps.length || !allLines.length ||
          allLines.length > 60 || allLines.some(function (line) { return typeof line !== 'string' || !sourceGrounded(sourceText, line); })) {
        return held('recipe_not_verifiable');
      }
      // A line containing a quantity or method may not disappear from the
      // public recipe, even if the model omitted it from structured output.
      var material = sourceText.split(/\r?\n/).map(norm).filter(Boolean).filter(function (line) {
        return line !== norm(candidate.title) && !/^(?:recipe|cocktail|ingredients|drink|syrup|homemade syrup|method|steps|preparation|instructions|garnish)\s*:?\s*$/.test(line);
      });
      if (!material.length || material.some(function (line) {
        return !allLines.some(function (part) { return norm(part) === line; });
      })) return held('recipe_line_omitted');
      if (/\b(?:make|prepare|cook|boil|simmer)\b.{0,30}\bsyrup\b/i.test(sourceText) &&
          !recipe.syrupIngredients.length) return held('syrup_method_unverified');
    } else if (allLines.length) {
      return held('unexpected_recipe');
    }
    var stamp = new Date(s.receivedAt);
    if (isNaN(stamp.getTime()) || stamp.getUTCFullYear() < 1990 || stamp.getUTCFullYear() > 2100) return held('date_not_verifiable');
    var entry = {
      id: 'annal-' + id.slice(0, 24),
      category: candidate.category,
      title: censor(candidate.title.trim()),
      summary: censor(sourceText), // exact source wording, not an AI-invented story
      year: stamp.getUTCFullYear(),
      dateLabel: 'Submitted ' + stamp.toISOString().slice(0, 7),
      sortDate: '',
      quoteVerbatim: '',
      recipe: { drinkIngredients: recipe.drinkIngredients.map(censor),
        syrupIngredients: recipe.syrupIngredients.map(censor), steps: recipe.steps.map(censor) },
      credit: 'anonymous'
    };
    return { eligible: true, entry: entry, mode: MODE };
  }
  return Object.freeze({ MODE: MODE, NOTICE: NOTICE, censor: censor, propose: propose });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = AnnalsAuto;
