/* Narrow safe-photo and editorial-suggestion extension to AnnalsAuto.
 * Requires independently authenticated standing image/AI consent in the
 * private server. Never grants third-party rights or publishes raw media.
 */
var AnnalsMediaPolicy = (function () {
  'use strict';
  var MODE = 'standing-consent-image-v1';
  var DANGEROUS = /\b(?:private|confidential|address|phone|password|allegedly|accused|fraud|assault|family|guest|child|children|home address|license plate|licence plate|reflection|face)\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|\b(?:Justin|Marc|Matt|Ken|Jamie|Jerome)\b/i;
  var IMAGE_RISKS = ['faces_or_reflections', 'possible_personal_identifier','location_or_home_context','private_context',
    'unknown_attachment','photo_transcription_unverified','quote_consent_unconfirmed'];
  var AMOUNT = /\b(?:\d+(?:[./]\d+)?|[¼½¾])\s*(?:oz|ounces?|ml|cl|g|grams?|cups?|tbsp|tsp|dash(?:es)?|drops?|parts?)\b/i;
  function suggestedQuantities(recipe, source) {
    if (!recipe || !Array.isArray(recipe.drinkIngredients)) return [];
    var items = recipe.drinkIngredients.filter(function (line) { return !AMOUNT.test(line); });
    var ideas = [];
    if (items.length) {
      var notes = items.slice(0,5).map(function (line) {
        var s = line.toLowerCase();
        var amount = /\b(?:gin|vodka|rum|whisk(?:y|ey)|bourbon|tequila|brandy)\b/.test(s) ?
          'about 45 mL (1½ oz)' :
          /\b(?:lemon|lime|citrus|grapefruit)\b/.test(s) ? 'about 20 mL (¾ oz)' :
          /\b(?:syrup|cordial|liqueur)\b/.test(s) ? 'start at 15 mL (½ oz)' :
          /\b(?:tonic|soda|juice|cola|ginger ale|mixer)\b/.test(s) ? 'start at 90 mL (3 oz)' :
          'quantity unrecorded; adjust to taste';
        return line + ' — ' + amount;
      });
      ideas.push('Suggested quantities, not part of the original recipe: ' + notes.join('; '));
    }
    var hasSyrup = /\b(?:homemade\s+)?(?:syrup|shrub|cordial)\b/i.test(source);
    var syrupMeasured = (recipe.syrupIngredients || []).some(function (item) { return AMOUNT.test(item); });
    if (hasSyrup && !syrupMeasured) {
      ideas.push('Suggested basic syrup only, not the historical syrup: equal parts sugar and water by volume; cool before use. Other syrup styles may differ.');
    }
    return ideas.slice(0,2);
  }
  function eligibleImage(source,candidate,photo) {
    if (!photo || !source || !source.imageConsentAtReceipt ||
        !source.autoConsentAtReceipt || !source.senderAuthenticated ||
        !/^[a-f0-9]{64}$/.test(photo.sha256 || '') ||
        !Number.isInteger(photo.size) || photo.size < 1 || photo.size > 32768) return false;
    var assessment = candidate && candidate.imageSafety;
    if (!assessment || assessment.kind !== 'drink_or_object' || assessment.safeToPublish !== true ||
        !Array.isArray(candidate.riskFlags) ||
        candidate.riskFlags.some(function (flag) { return IMAGE_RISKS.indexOf(flag) >= 0; })) return false;
    // Positive AI image screening does not replace separate member permission.
    return true;
  }
  function enrich(source,candidate,id,decision,photo) {
    if (!source || !candidate || !decision || !source.source) return {eligible:false,reason:'invalid_media_source'};
    var okay = eligibleImage(source,candidate,photo);
    if (!decision.eligible) {
      // Only a genuinely empty caption may be published as a photo-only
      // cocktail; never use a photo to override any other privacy hold.
      var body = String(source.source.excerpt || '').trim();
      var subject = String(source.source.subject || '').trim();
      if (!okay || (body && !/^(?:(?:here is|here's|attached is|photo of|picture of|see) )?(?:a |the |my |our )?(?:photo|picture|cocktail|drink|club artefact|artefact)(?: attached)?[.!]?$/i.test(body)) ||
          ['cocktail','artefact'].indexOf(candidate.category) < 0 || !subject || subject.length > 150 ||
          DANGEROUS.test(subject) || candidate.riskFlags.length) return decision;
      var received = new Date(source.source.receivedAt);
      if (isNaN(received.getTime()) || received.getUTCFullYear() < 1990 || received.getUTCFullYear() > 2100)
        return {eligible:false,reason:'invalid_receipt_date'};
      var photoEntry = {
        id:'annal-' + id.slice(0,24),category:candidate.category,title:AnnalsAuto.censor(subject),
        summary: 'A photograph contributed to the Annals. No recipe or additional historical details were supplied.',
        year:received.getUTCFullYear(),dateLabel:'Submitted '+received.toISOString().slice(0,7),
        sortDate:'',quoteVerbatim:'',recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]},
        credit:'anonymous',photo:{sha256:photo.sha256,alt:candidate.category === 'artefact' ? 'Contributor-submitted photograph of a club artefact' : 'Contributor-submitted cocktail photograph'}
      };
      return {eligible:true,entry:photoEntry,mode:MODE};
    }
    // A safe recipe or story can be public with its companion image held.
    var entry = decision.entry;
    if (['cocktail','artefact'].indexOf(entry.category) >= 0) {
      var original = (entry.recipe.suggestedSteps || []).slice();
      var ideas = suggestedQuantities(entry.recipe, source.source.excerpt || '');
      var suggested = original.concat(ideas).slice(0,3);
      if (suggested.length) entry.recipe.suggestedSteps = suggested;
      if (okay) {
        entry.photo = {sha256:photo.sha256,alt:entry.category === 'artefact' ? 'Contributor-submitted photograph of a club artefact' : 'Contributor-submitted cocktail photograph'};
        return {eligible:true,entry:entry,mode:MODE};
      }
    }
    return {eligible:true,entry:entry,mode:decision.mode};
  }
  return Object.freeze({MODE:MODE,eligibleImage:eligibleImage,suggestedQuantities:suggestedQuantities,enrich:enrich});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = AnnalsMediaPolicy;
