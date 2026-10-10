/* Narrow safe-photo and editorial-suggestion extension to AnnalsAuto.
 * Requires independently authenticated standing image/AI consent in the
 * private server. Never grants third-party rights or publishes raw media.
 */
var AnnalsMediaPolicy = (function () {
  'use strict';
  var Auto = typeof AnnalsAuto !== 'undefined' ? AnnalsAuto :
    (typeof module !== 'undefined' && module.exports ? require('./AutoCore.js') : null);
  var MODE = 'standing-consent-image-v1';
  var DANGEROUS = /\b(?:private|confidential|address|phone|password|allegedly|accused|fraud|assault|family|guest|child|children|home address|license plate|licence plate|reflection|face)\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|\b(?:Justin|Marc|Matt|Ken|Jamie|Jerome)\b/i;
  var IMAGE_RISKS = ['faces_or_reflections', 'possible_personal_identifier','location_or_home_context','private_context',
    'unknown_attachment','photo_transcription_unverified','quote_consent_unconfirmed'];
  var AMOUNT = /\b(?:\d+(?:[./]\d+)?|[¼½¾])\s*(?:oz|ounces?|ml|cl|g|grams?|cups?|tbsp|tsp|dash(?:es)?|drops?|parts?)\b/i;
  function suggestedQuantities(recipe, source) {
    if (!recipe || !Array.isArray(recipe.drinkIngredients)) return [];
    var missing = recipe.drinkIngredients.filter(function (line) { return !AMOUNT.test(line); });
    var ideas = [];
    if (missing.length) {
      var notes = missing.slice(0,5).map(function (line) {
        var s = line.toLowerCase();
        var amount = /\b(?:gin|vodka|rum|whisk(?:y|ey)|bourbon|tequila|brandy)\b/.test(s) ?
          'about 45 mL (1½ oz)' :
          /\b(?:lemon|lime|citrus|grapefruit)\b/.test(s) ? 'about 20 mL (¾ oz)' :
          /\b(?:syrup|cordial|liqueur)\b/.test(s) ? 'start at 15 mL (½ oz)' :
          /\b(?:tonic|soda|juice|cola|ginger ale|mixer)\b/.test(s) ? 'start at 90 mL (3 oz)' :
          'quantity unrecorded; adjust to taste';
        return line.slice(0,65) + ' — ' + amount;
      });
      var current = 'Suggested quantities, not part of the original: ';
      notes.forEach(function (note) {
        if (ideas.length >= 2) return;
        if (current.length + note.length + 2 > 200 && current.length > 45) {
          ideas.push(current.slice(0,200));
          current = 'Additional suggested amounts: ';
        }
        if (ideas.length < 2) current += (current.endsWith(': ') ? '' : '; ') + note;
      });
      if (ideas.length < 2) ideas.push(current.slice(0,200));
      if (missing.length > 5 && ideas.length < 2) ideas.push('Other unrecorded quantities: adjust to taste.');
    }
    var syrupMentioned = /\b(?:homemade\s+)?(?:syrup|shrub|cordial)\b/i.test(source);
    var syrupMeasured = (recipe.syrupIngredients || []).some(function (item) { return AMOUNT.test(item); });
    if (syrupMentioned && !syrupMeasured && ideas.length < 2) {
      ideas.push('Suggested basic syrup, not the original: combine equal parts sugar and water by volume; cool before use. Fruit and herb syrups can differ.');
    }
    return ideas.slice(0,2);
  }
  function eligibleImage(source,candidate,photo) {
    if (!photo || !source || !source.imageConsentAtReceipt ||
        !source.autoConsentAtReceipt || !source.senderAuthenticated ||
        !/^[a-f0-9]{64}$/.test(photo.sha256 || '') ||
        !Number.isInteger(photo.size) || photo.size < 1 || photo.size > 32768) return false;
    var assessment = candidate && candidate.imageSafety;
    if (!assessment || ['drink_or_object','scenery'].indexOf(assessment.kind) < 0 || assessment.safeToPublish !== true ||
        !Array.isArray(candidate.riskFlags) ||
        candidate.riskFlags.some(function (flag) { return IMAGE_RISKS.indexOf(flag) >= 0; })) return false;
    // Positive AI image screening does not replace separate member permission.
    return true;
  }
  function enrich(source,candidate,id,decision,photo) {
    if (!source || !candidate || !decision || !source.source) return {eligible:false,reason:'invalid_media_source'};
    var permitted = eligibleImage(source,candidate,photo);
    var category = candidate.category;
    var imageCategory = ['cocktail','artefact','monthly_gathering','assembly','club_history'].indexOf(category) >= 0;
    var alt = candidate.imageSafety && candidate.imageSafety.kind === 'scenery' ?
      'Contributor-submitted scenic photograph' :
      category === 'artefact' ? 'Contributor-submitted photograph of a club artefact' :
        'Contributor-submitted photograph of a cocktail or club object';
    if (!decision.eligible) {
      // A safe photo can be recorded independently, but must never override a
      // personal-data or allegation hold. Caption is the original wording,
      // not an AI-invented account of the depicted event.
      var eligibleFallback = ['media_context_required','photo_only_requires_safe_permission',
        'recipe_measure_or_step_uncertain','classification_not_supported'].indexOf(decision.reason) >= 0;
      var body = String(source.source.excerpt || '').trim();
      var subject = String(source.source.subject || '').trim();
      var materialRisk = ['faces_or_reflections','possible_personal_identifier',
        'location_or_home_context','private_context','quote_consent_unconfirmed','unknown_attachment'];
      if (!permitted || !eligibleFallback || !imageCategory || !subject || subject.length > 150 ||
          body.length > 250 || DANGEROUS.test(subject) || DANGEROUS.test(body) ||
          candidate.riskFlags.some(function (flag) { return materialRisk.indexOf(flag) >= 0; })) {
        return decision;
      }
      var received = new Date(source.source.receivedAt);
      if (isNaN(received.getTime()) || received.getUTCFullYear() < 1990 || received.getUTCFullYear() > 2100)
        return {eligible:false,reason:'invalid_receipt_date'};
      var caption = body && !/^\s*(?:photo|picture)\s+attached[.!]?\s*$/i.test(body) ?
        Auto.censor(body) :
        'A photograph submitted to the Annals; no further historical details were recorded.';
      var entry = {
        id:'annal-' + id.slice(0,24), category:category,title:Auto.censor(subject),
        summary:caption, year:received.getUTCFullYear(),
        dateLabel:'Submitted '+received.toISOString().slice(0,7),sortDate:'',
        quoteVerbatim:'',recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]},
        credit:'anonymous',photo:{sha256:photo.sha256,alt:alt}
      };
      return {eligible:true,entry:entry,mode:MODE};
    }
    // Ordinary text may publish even when an unrelated image is held.
    var entry = decision.entry;
    if (entry.category === 'cocktail') {
      var original = (entry.recipe.suggestedSteps || []).slice();
      var ideas = suggestedQuantities(entry.recipe, source.source.excerpt || '');
      var suggested = original.concat(ideas).slice(0,3);
      if (suggested.length) entry.recipe.suggestedSteps = suggested;
    }
    if (permitted && imageCategory) {
      entry.photo = {sha256:photo.sha256,alt:alt};
      return {eligible:true,entry:entry,mode:MODE};
    }
    return {eligible:true,entry:entry,mode:decision.mode};
  }
  return Object.freeze({MODE:MODE,eligibleImage:eligibleImage,suggestedQuantities:suggestedQuantities,enrich:enrich});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = AnnalsMediaPolicy;
