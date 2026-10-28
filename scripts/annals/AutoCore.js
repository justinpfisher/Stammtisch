/* Annals liberal publication policy: default to publishing eligible member text,
 * not manual review. Hold ONLY for a concrete rights, safety or factual risk.
 * This module never authenticates consent, calls AI or signs public content.
 * Caller validates both consents, source freshness, permissions and budget.
 */
var AnnalsAuto = (function () {
  'use strict';
  var MODE = 'standing-consent-text-v1';
  var QUOTE_MODE = 'standing-consent-quote-v1';
  var NOTICE = 'The Editorial Committee reserves the right to replace particularly spirited language with conspicuous euphemisms. Historical accuracy is otherwise maintained. The Editorial Committee is actually just AI we tried to train.';
  var CATEGORIES = ['cocktail', 'quotation', 'monthly_gathering', 'assembly', 'club_history', 'artefact'];
  // Independent of the AI category. Conservative private routing also covers
  // ambiguous references and mixed recipe/proposal emails, in either field.
  function protectedRoute(subject, body) {
    var text = (String(subject || '') + '\n' + String(body || '')).normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '');
    var domain = /\b(?:CoL|celebration\s+of\s+life|diamond|birthday\s+buffet|devil[’']?s\s+share|jettison|celebrity\s+(?:pool|draft)|deaths?|selections?|awards?|eligibility|rollover|steals?|scor(?:e|es|ing)|points?|draft(?:ing)?|rules?)\b/i;
    var proposal = /\b(?:propos\w*|suggest\w*|recommend\w*|prefer\w*|amend\w*|chang\w*|revis\w*|replac\w*|adopt\w*|should|(?:could|can|shall)\s+we|what\s+if|how\s+about|let[’']?s|let\s+us|instead|new|different|idea|increase|decrease|double|halve|abolish|remove|allow|must|ought|need\s+to)\b/i;
    // Questions and ambiguous governance references need private consideration
    // even without an explicit amendment verb. Never infer adoption from them.
    var specific = /\b(?:CoL|celebration\s+of\s+life|diamond|birthday\s+buffet|devil[’']?s\s+share|jettison|celebrity\s+(?:pool|draft)|scor(?:e|es|ing)|eligibility|rollover|drafting|draft\s+(?:order|procedures?)|selection\s+method|points?\s+(?:formula|calculations?|system))\b/i;
    return specific.test(text) || domain.test(text) && proposal.test(text) ? 'col_proposal' : 'annals';
  }
  // Specific hard stops. Generic club language ("home", "family", "history",
  // "photograph") is NOT inherently a reason to suppress innocent text.
  var PRIVATE_DATA = /(?:\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|https?:\/\/|www\.|\b(?:\+?1[- .]?)?\(?[2-9]\d{2}\)?[- .][2-9]\d{2}[- .]\d{4}\b|\b[A-CEGHJ-NPRSTVXY]\d[A-CEGHJ-NPRSTV-Z][ -]?\d[A-CEGHJ-NPRSTV-Z]\d\b|\b\d{1,5}\s+[\w'-]+\s+(?:street|st\.|avenue|ave\.|road|rd\.|drive|lane|boulevard|blvd\.)\b|\b(?:password|passcode|access code|door code|postal code|credit card|bank account|home address|private address|personal phone|private message|confidential|secret|medical diagnosis)\b|^\s*(?:from|sent|subject|to|cc|bcc)\s*:|^\s*>|^\s*--\s*$|<[^>]+>|\b(?:ignore previous instructions|system prompt|developer instructions|api key|publish this regardless|override safeguards)\b)/im;
  // Only public, canonical accommodation listing links are ordinary Club context.
  // Query strings, fragments, user-info, lookalike hosts and other URLs retain
  // the existing private-detail screening. No booking or access token is allowed.
  var PUBLIC_VENUE_URL = /^https:\/\/(?:www\.)?airbnb\.(?:ca|com)\/rooms\/[1-9][0-9]{4,19}\/?$/i;
  var WEB_URL = /https?:\/\/[^\s<>"']+/gi;
  function isPublicVenueUrl(value) {
    return PUBLIC_VENUE_URL.test(String(value).replace(/[.,;!)]*$/, ''));
  }
  function withoutPublicVenueLinks(value) {
    return String(value).replace(WEB_URL,function(url) {
      return isPublicVenueUrl(url) ? 'PUBLIC_LISTING' : url;
    });
  }
  function hasPublicVenueLink(value) {
    return (String(value).match(WEB_URL) || []).some(isPublicVenueUrl);
  }
  var ALLEGATION = /\b(?:accused of|allegedly|arrested for|charged with|fraud|assault|abuse|crime|criminal|illegal activity|diagnosed with|passed away|died by suicide)\b/i;
  var THIRD_PARTY = /\b(?:he said|she said|they said|he told me|she told me|they told me|according to|quoted from|overheard|guest named|colleague named|mr\.|mrs\.|dr\.)\b/i;
  var MEDIA_DEPENDENT = /\b(?:as pictured|in the photo|see (?:the )?(?:photo|image|picture|attachment|scan|file)|attached (?:photo|image|picture|recipe)|image says|photo shows|pictured here)\b/i;
  var NAMED_PERSON = /\b(?:with|by|from|said|called|named|met)[ \t]+[A-Z][a-z]+[ \t]+[A-Z][a-z]+\b/;
  var HARD_FLAGS = ['handwriting_ambiguous','possible_personal_identifier','location_or_home_context','private_context','quote_consent_unconfirmed'];
  var MAY_IGNORE_MEDIA_FLAGS = ['faces_or_reflections','unknown_attachment','photo_transcription_unverified'];
  function cleanText(value) {
    if (typeof value !== 'string') throw new Error('Invalid source text');
    var text = value.replace(/\r\n/g, '\n').trim();
    // Remove only recognised trailing device/mail signatures, not story text.
    text = text.replace(/\n(?:\s*\n)*(?:sent from my (?:iphone|android|ipad)|get outlook for (?:ios|android))[^\n]*\s*$/i, '');
    text = text.replace(/\n--\s*\n[\s\S]*$/, '');
    text = text.replace(/\n(?:\s*\n)*(?:cheers|thanks|regards|best|sincerely),?\s*\n[A-Z][A-Za-z' -]{1,40}\s*$/i, '');
    text = text.replace(/\n(?:\s*\n)*(?:photo attached\.?|attached (?:photo|image|picture)\.?)\s*$/i, '');
    return text.trim();
  }
  function censor(value) {
    if (typeof value !== 'string') throw new Error('Invalid editorial text');
    return value.replace(/\b(?:tastes?|smells?)\s+like\s+shit\b/gi, function (part) {
      return part.replace(/\bshit\b/i, '[POOP]');
    }).replace(/\b(?:motherfucker|motherfucking|fucking|fucked|fucker|fuck|bullshit|shitty|shit|asshole|bastard|bitch|cunt|dickhead)\b/gi, '[expletive]');
  }
  function norm(value) { return String(value).trim().replace(/^\s*[-*•]\s*/, '').replace(/\s+/g, ' ').toLowerCase(); }
  function held(reason) { return { eligible: false, reason: reason }; }
  // Owner attests all six approve ordinary use of their first names and
  // established club nicknames. This is not permission to attribute speech.
  // "Fish" is Justin's established nickname; others are not invented here.
  var REPORTED_SPEECH = /\b[A-Z][a-z]+\s+(?:said|says|told|remarked|wrote|quoted|claimed)\b/;
  var GUEST_REPORTED_SPEECH = /\b(?:guest|visitor|colleague)\s+(?:said|says|told|remarked|wrote|quoted|claimed)\b/i;
  function reportedSpeech(text) {return REPORTED_SPEECH.test(text)||GUEST_REPORTED_SPEECH.test(text);}
  function sourceGrounded(source, phrase) {
    return !!norm(phrase) && norm(source).indexOf(norm(phrase)) >= 0;
  }
  function independentText(text) { return !MEDIA_DEPENDENT.test(text); }
  function protectedText(text, allowPublicVenueLink) {
    // Default public/privacy checks never trust a URL. The exception is passed
    // explicitly only from an authenticated, source-grounded Assembly entry.
    var checked = allowPublicVenueLink === true ? withoutPublicVenueLinks(text) : text;
    return PRIVATE_DATA.test(checked) || ALLEGATION.test(text) ||
      THIRD_PARTY.test(text) || NAMED_PERSON.test(text);
  }
  // Preserve the complete private original. Only this derived text is sent
  // to the ordinary Annals AI request or evaluated for unattended release.
  // Never apply it to CoL or use it to rewrite an exact attributed quotation.
  var CONTACT_TOKENS = /(?:\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|\b(?:\+?1[- .]?)?\(?[2-9]\d{2}\)?[- .][2-9]\d{2}[- .]\d{4}\b|\b[A-CEGHJ-NPRSTVXY]\d[A-CEGHJ-NPRSTV-Z][ -]?\d[A-CEGHJ-NPRSTV-Z]\d\b|\b\d{1,5}\s+[\w'-]+\s+(?:street|st\.|avenue|ave\.|road|rd\.|drive|lane|boulevard|blvd\.)\b)/gi;
  var OMIT_SENTENCE = /\b(?:password|passcode|access code|door code|postal code|credit card|bank account|home address|private address|personal phone|private message|confidential|secret|medical diagnosis|diagnosed with|financial hardship|intimate relationship|family dispute)\b/i;
  var RAW_HEADER = /^\s*(?:from|sent|subject|to|cc|bcc)\s*:|^\s*>|^\s*--\s*$|<[^>]+>|\b(?:ignore previous instructions|system prompt|developer instructions|api key|publish this regardless|override safeguards)\b/i;
  var RECIPE_MATERIAL = /(?:^|\s)(?:\d+(?:[./]\d+|[¼½¾])?|[¼½¾])\s*(?:oz|ounces?|ml|cl|g|grams?|cups?|tbsp|tsp|dash(?:es)?|drops?|parts?)\b|^\s*(?:stir|shake|strain|garnish|mix|pour|blend|muddle|simmer|boil|add|combine|chill|serve|heat|steep)\b|\b\d+\s*:\s*\d+\s*(?:ratio|parts?)?\b/i;
  function safeField(value, allowMemberQuote, allowPublicVenueLink) {
    // Apply the established sign-off cleaner, but never discard the actual
    // authoritative private original. This also preserves harmless Markdown
    // indentation and quantities when no redaction is necessary.
    var lines = cleanText(String(value || '')).split('\n');
    var result = [], changed = false, recipeMaterialRedacted = false, holdReason = null;
    lines.forEach(function (line) {
      if (!line.trim()) { if (result.length && result[result.length - 1]) result.push(''); return; }
      var segments = line.split(/(?<=[.!?])\s+(?=[A-Z"“])/), kept = [], lineChanged = false;
      segments.forEach(function (sentence) {
        var text = sentence.trim();
        if (!text) return;
        var permittedSourceQuote = allowMemberQuote &&
          /^(?:(?:quote\s+(?:from|by)\s+)?(?:Justin|Fish|Marc|Matt|Ken|Jamie|Jerome)(?:\s+(?:said|remarked))?\s*:\s*)/i.test(text);
        // Redact only the contact token or the explicitly labelled guest name.
        // Unknown identity/rights and allegations cannot be made safe by
        // arbitrarily substituting a person or inventing a narrative.
        var masked = text.replace(CONTACT_TOKENS,function(token) {
          return allowPublicVenueLink && isPublicVenueUrl(token) ? token : '[DETAIL OMITTED]';
        })
          .replace(/\b(?:guest|visitor|colleague)\s+named\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g,
            function(match) {return match.split(/\s+/)[0]+' [NAME OMITTED]';})
          // The six members' approved first names remain intact. A distinct
          // first-and-last name after a high-confidence person-introducing verb
          // does not inherit those permissions. Mask that name rather than
          // throwing away the surrounding otherwise safe recollection.
          .replace(/\b(met|named|called)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
            function(match, context) {return context+' [NAME OMITTED]';});
        var quoteRisk=(THIRD_PARTY.test(masked)||reportedSpeech(masked))&&!permittedSourceQuote;
        // A stand-alone request to contact an unpublished address has no
        // meaningful public content once its only detail has been removed.
        var contactOnly=masked!==text &&
          /^(?:(?:please|kindly)\s+)?(?:email|call|text|phone|contact|reach|write|send)\b/i.test(text);
        if (RAW_HEADER.test(text) || ALLEGATION.test(text) || OMIT_SENTENCE.test(text) ||
            contactOnly || quoteRisk || protectedText(masked,allowPublicVenueLink)) {
          changed = true;
          lineChanged = true;
          if(RECIPE_MATERIAL.test(text))recipeMaterialRedacted = true;
          if(quoteRisk)holdReason = 'third_party_quotation_permission';
          else if(!holdReason)holdReason = 'private_personal_or_sensitive_content';
          return;
        }
        if(masked!==text) {
          changed=true;lineChanged=true;
          if(RECIPE_MATERIAL.test(text))recipeMaterialRedacted=true;
        }
        kept.push(masked);
      });
      if(kept.length)result.push(lineChanged?kept.join(' '):line);
    });
    return {text:result.join('\n').trim(),changed:changed,
      recipeMaterialRedacted:recipeMaterialRedacted,holdReason:holdReason};
  }
  function safeSource(subject, excerpt, allowMemberQuote, allowPublicVenueLink) {
    if (typeof subject !== 'string' || typeof excerpt !== 'string')
      return {valid:false,reason:'source_incomplete'};
    if (protectedRoute(subject,excerpt)!=='annals') return {valid:false,reason:'col_proposal_private_review'};
    var venueContext = allowPublicVenueLink === true &&
      /\b(?:assembly|cottage|retreat|annual gathering)\b/i.test(subject+' '+excerpt);
    var a=safeField(subject,allowMemberQuote===true,venueContext),
      b=safeField(excerpt,allowMemberQuote===true,venueContext);
    // Remove incidental "see attached photo" sentences when a stand-alone
    // contribution remains. An image-only submission keeps its source for
    // the distinct positive photo-screening/depiction-rights workflow.
    if (MEDIA_DEPENDENT.test(b.text)) {
      var sentences=b.text.split('\n').reduce(function (out,line) {
        return out.concat(line.split(/(?<=[.!?])\s+(?=[A-Z"“])/));
      },[]);
      var independent=sentences.filter(function(s){return s.trim()&&!MEDIA_DEPENDENT.test(s);});
      if(independent.join(' ').trim().length>=16) {
        b.text=independent.join('\n').trim();
        b.changed=true;
      }
    }
    var changed=a.changed||b.changed;
    // Entirely sensitive bodies must not yield meaningless "Club note"
    // publication. Subject-only, genuinely safe member submissions are fine.
    if (!a.text&&!b.text || excerpt.trim()&&!b.text&&changed)
      return {valid:false,reason:b.holdReason||a.holdReason||'no_safe_standalone_text'};
    var screened=[a.text,b.text].filter(Boolean).join('\n');
    if (!screened.trim() || screened.length>11000 || protectedText(screened,venueContext))
      return {valid:false,reason:'private_personal_or_sensitive_content'};
    return {valid:true,subject:a.text,excerpt:b.text,redacted:changed,
      recipeMaterialRedacted:a.recipeMaterialRedacted||b.recipeMaterialRedacted};
  }
  var SPEAKERS = { justin:'fish', fish:'fish', marc:'marc', matt:'matt', ken:'ken', jamie:'jamie', jerome:'jerome' };
  function speakerId(value) { return SPEAKERS[String(value || '').trim().toLowerCase()] || null; }
  function mentionedSpeakers(value) {
    var found = [];
    Object.keys(SPEAKERS).forEach(function (name) {
      if (new RegExp('\\b' + name + '\\b','i').test(String(value || '')) && found.indexOf(SPEAKERS[name]) < 0)
        found.push(SPEAKERS[name]);
    });
    return found;
  }
  function outerQuote(value) {
    var text = value.trim(), pairs = [['"','"'],["'","'"],['“','”'],['‘','’'],['«','»']];
    for (var i = 0; i < pairs.length; i++)
      if (text.length >= 2 && text.charAt(0) === pairs[i][0] && text.charAt(text.length - 1) === pairs[i][1])
        return text.slice(1,-1);
    return text;
  }
  // Read one original source field. This deliberately small grammar handles
  // explicit labels; cross-field attribution is checked separately below.
  function fieldEvidence(value, aiQuote) {
    if (typeof value !== 'string') return null;
    var original = value.replace(/\r\n?/g,'\n').trim();
    if (!original) return null;
    var self = original.match(/^(?:my quote|i said|i wrote)\s*:\s*([\s\S]+)$/i);
    var prefix = original.match(/^(?:(?:quote\s+(?:from|by)\s+))?(Justin|Fish|Marc|Matt|Ken|Jamie|Jerome)(?:\s+(?:said|remarked))?\s*:\s*([\s\S]+)$/i);
    var suffix = original.match(/^([\s\S]+?)\s*[—–-]\s*(Justin|Fish|Marc|Matt|Ken|Jamie|Jerome)$/i);
    var quoted = self ? self[1] : prefix ? prefix[2] : suffix ? suffix[1] : original;
    var line = outerQuote(quoted);
    // A proposal may retain the complete original field, including its label
    // and quote delimiters. Accept only the exact full field or extracted words;
    // attribution and every content/consent gate still use the original source.
    if (line !== aiQuote && original !== aiQuote) return null;
    return { speakerPortrait:prefix ? speakerId(prefix[1]) : suffix ? speakerId(suffix[2]) : null,
      self:!!self, quote:line };
  }
  function quotationEvidence(subject, body, aiQuote, interpretation) {
    var legacy = arguments.length === 2;
    if (legacy) { aiQuote = body; body = subject; subject = ''; interpretation = null; }
    if (typeof aiQuote !== 'string' || !aiQuote.trim() || aiQuote.length > 1500) return null;
    interpretation = interpretation || { intent:'direct_quote', speakerId:'unknown', evidenceField:'body' };
    if (!interpretation || interpretation.intent !== 'direct_quote' ||
        ['subject','body','subject_and_body'].indexOf(interpretation.evidenceField) < 0) return null;
    var fields = { subject:subject, body:body }, field = interpretation.evidenceField, matches = [];
    (field === 'subject_and_body' ? ['subject','body'] : [field]).forEach(function (name) {
      var found = fieldEvidence(fields[name], aiQuote);
      if (found) { found.field = name; matches.push(found); }
    });
    if (matches.length !== 1) return null;
    var evidence = matches[0], otherName = evidence.field === 'subject' ? 'body' : 'subject';
    var context = String(fields[otherName] || '').trim();
    var contextSelf = /^(?:my quote|i said|i wrote)\s*:?$/i.test(context);
    var contextSpeaker = speakerId(context.replace(/^quote\s+(?:from|by)\s+/i,''));
    if (!legacy && evidence.self && interpretation.speakerId !== 'self') return null;
    if (!legacy && evidence.speakerPortrait && interpretation.speakerId !== evidence.speakerPortrait) return null;
    if (!evidence.self && !evidence.speakerPortrait) {
      if (contextSelf && interpretation.speakerId === 'self') evidence.self = true;
      else if (contextSpeaker && interpretation.speakerId === contextSpeaker) evidence.speakerPortrait = contextSpeaker;
      else if (interpretation.speakerId !== 'unknown') return null;
    }
    if (!legacy && interpretation.speakerId === 'unknown' && (evidence.self || evidence.speakerPortrait)) return null;
    if (legacy) delete evidence.field;
    return evidence;
  }
  function proposeRemark(s, source, full, candidate, id, speakerPermission) {
    var evidence = quotationEvidence(s.subject, s.excerpt, candidate.quoteVerbatim, candidate.interpretation);
    if (!evidence) return held(candidate.interpretation && candidate.interpretation.intent !== 'direct_quote' ?
      'not_a_direct_quotation' : 'quotation_not_verbatim_or_speaker_unknown');
    if (!evidence.self && !evidence.speakerPortrait) return held('quotation_speaker_unknown');
    // Allow only the actual, separately consented speaker in a simple subject
    // such as 'Quote from Ken'; other identifying subjects remain held.
    var subject = String(s.subject || '').trim(), subjectSpeakers = mentionedSpeakers(subject);
    var unexpectedSubjectIdentity = subjectSpeakers.length > 0 &&
      (subjectSpeakers.length !== 1 || subjectSpeakers[0] !== evidence.speakerPortrait);
    if (PRIVATE_DATA.test(full) || ALLEGATION.test(full) || THIRD_PARTY.test(full) ||
        NAMED_PERSON.test(full) ||
        unexpectedSubjectIdentity || protectedText(evidence.quote))
      return held('private_personal_or_sensitive_content');
    var granted = speakerPermission && speakerPermission.speakerPortrait;
    if (evidence.speakerPortrait && granted !== evidence.speakerPortrait)
      return held('speaker_specific_publication_permission_missing');
    // Private verified permission can decorate the actual speaker with their
    // portrait. Without it, an explicitly self-authored quote stays anonymous.
    if (evidence.self && granted && !/^(?:fish|marc|matt|ken|jamie|jerome)$/.test(granted))
      return held('invalid_speaker_permission');
    if (!Array.isArray(candidate.riskFlags) ||
        candidate.riskFlags.some(function (flag) {
          return HARD_FLAGS.indexOf(flag) >= 0 &&
            !(flag === 'quote_consent_unconfirmed' && (evidence.self || evidence.speakerPortrait && granted === evidence.speakerPortrait));
        })) return held('material_uncertainty');
    if (!independentText(full)) return held('media_context_required');
    var stamp = new Date(s.receivedAt);
    if (isNaN(stamp.getTime()) || stamp.getUTCFullYear() < 1990 || stamp.getUTCFullYear() > 2100)
      return held('invalid_receipt_date');
    var entry = { id:'annal-' + id.slice(0,24), category:'quotation',
      title:'Recorded remark', summary:'An authenticated contribution to the Register of Remarks.',
      year:stamp.getUTCFullYear(),dateLabel:'Submitted ' + stamp.toISOString().slice(0,7),
      sortDate:'',quoteVerbatim:censor(evidence.quote),
      recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]},credit:'anonymous' };
    if (granted) entry.speakerPortrait = granted;
    return {eligible:true,entry:entry,mode:granted ? QUOTE_MODE : MODE};
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
  // Compare a recipe against the source without treating email/Markdown
  // decoration as ingredients. Never normalise quantities, units or wording.
  // Original formatting remains untouched in the private source journal.
  function recipeComparable(value) {
    return String(value).normalize('NFC').split(/\r?\n/).map(function (line) {
      return line.trim()
        .replace(/^(?:[-•]\s+|\d+[.)]\s+)/, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1');
    }).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function sourceRecipeGrounded(source, recipe) {
    if (!recipe || !Array.isArray(recipe.drinkIngredients) || !Array.isArray(recipe.syrupIngredients) ||
        !Array.isArray(recipe.steps)) return false;
    var all = recipe.drinkIngredients.concat(recipe.syrupIngredients, recipe.steps);
    if (!recipe.drinkIngredients.length || all.length > 60 ||
        all.some(function (line) { return typeof line !== 'string' || !recipeComparable(line) ||
          recipeComparable(source).indexOf(recipeComparable(line)) < 0; })) return false;
    // Every original measurement line must be retained. Editorial commentary,
    // headings and informal banter do not have to be copied into the recipe.
    var quantity = /(?:^|\s)(?:\d+(?:[./]\d+|[¼½¾])?|[¼½¾])\s*(?:oz\b|ounces?\b|ml\b|mL\b|cl\b|g\b|grams?\b|cups?\b|tbsp\b|tsp\b|dash(?:es)?\b|drops?\b|parts?\b)/i;
    var measurementLines = source.split(/\r?\n/).map(recipeComparable).filter(function (line) { return quantity.test(line); });
    if (measurementLines.some(function (line) {
      return !all.some(function (part) { return recipeComparable(part) === line; });
    })) return false;
    var method = /^(?:stir|shake|strain|garnish|mix|pour|blend|muddle|simmer|boil|add|combine|chill|serve|heat|steep)\b/i;
    var submittedSteps = source.split(/\r?\n/).map(recipeComparable).filter(function (line) { return method.test(line); });
    if (submittedSteps.some(function (line) {
      return !recipe.steps.some(function (part) { return recipeComparable(part).startsWith(line); });
    })) return false;
    // A submitted syrup preparation is material, not an optional flourish.
    // Missing syrup instructions are eligible for a separately labelled
    // editorial suggestion. Never fabricate amounts or historic methods.
    return true;
  }
  // This is explicitly an optional editorial suggestion, never asserted to be a
  // recovered historical instruction or a verified homemade syrup recipe.
  function suggestedMethod(recipe, source) {
    if (recipe.steps.length || !recipe.drinkIngredients.length) return [];
    var joined = recipe.drinkIngredients.join(' ').toLowerCase();
    if (/\b(?:lemon|lime|citrus|orange juice|grapefruit|egg white)\b/.test(joined)) {
      return ['Shake the recorded drink ingredients with ice and strain; adjust serving to preference.'];
    }
    if (/\b(?:hot|warm|coffee|tea)\b/.test(joined) && !/\b(?:ice|cold|chilled)\b/.test(source)) {
      return ['Suggested method (not provided in the original): Combine the recorded drink ingredients carefully and serve at a suitable temperature.'];
    }
    return ['Suggested method (not provided in the original): Combine the recorded drink ingredients, chill if appropriate and serve.'];
  }
  function propose(privateSource, candidate, id, speakerPermission) {
    if (!privateSource || !privateSource.source || !candidate ||
        !/^[a-f0-9]{64}$/.test(id || '') ||
        privateSource.senderAuthenticated !== true ||
        privateSource.aiConsentActive !== true ||
        privateSource.autoConsentAtReceipt !== true) return held('consent_or_source_missing');
    var s = privateSource.source;
    if (typeof s.excerpt !== 'string' || typeof s.subject !== 'string' || s.excerptTruncated ||
        s.subjectTruncated || s.sourceTruncated) return held('source_incomplete');
    var body = cleanText(s.excerpt), subject = s.subject.trim();
    var source = body || subject;
    if (!source || subject.length + body.length > 11000) return held('source_incomplete');
    var full = [subject, body].filter(Boolean).join('\n').trim();
    if (protectedRoute(s.subject, s.excerpt) !== 'annals') return held('col_proposal_private_review');
    // A member's source-grounded recollection or keepsake is an Annals entry,
    // not an amendment to the separately reconciled canonical Club History.
    // Existing evidence and safety requirements below still apply.
    if (candidate.category === 'quotation') {
      if (!privateSource.attachmentManifest ||
          !Array.isArray(privateSource.attachmentManifest.items) ||
          privateSource.attachmentManifest.items.length) return held('quotation_requires_text_only');
      return proposeRemark(s, source, full, candidate, id, speakerPermission);
    }
    // Publish only the independently safe remainder. This uses a derived
    // representation, not an edited private source or a model's assertion
    // that sensitive details are acceptable.
    var publicAssemblySource = candidate.category === 'assembly' &&
      /\b(?:assembly|cottage|retreat|annual gathering)\b/i.test(full);
    var screened = safeSource(s.subject,s.excerpt,false,publicAssemblySource);
    if (!screened.valid) return held(screened.reason);
    subject=screened.subject;
    body=cleanText(screened.excerpt);
    source=body||subject;
    full=[subject,body].filter(Boolean).join('\n').trim();
    if (candidate.category==='cocktail' && screened.recipeMaterialRedacted)
      return held('recipe_measure_or_step_uncertain');
    if (reportedSpeech(full)) return held('third_party_quotation_permission');
    if (protectedText(full,publicAssemblySource)) return held('private_personal_or_sensitive_content');
    var media = privateSource.attachmentManifest;
    if (!media || !Array.isArray(media.items) || !independentText(full)) return held('media_context_required');
    if (!Array.isArray(candidate.riskFlags) || candidate.riskFlags.some(function (flag) {
      // Publicly advertised Assembly rentals are no longer treated as secret.
      // This exception is for verified source text, not attached photographs,
      // private-home locations or other independent privacy warnings.
      var publicAssemblyLocation = flag === 'location_or_home_context' &&
        publicAssemblySource && hasPublicVenueLink(full);
      return (HARD_FLAGS.indexOf(flag) >= 0 && !publicAssemblyLocation) ||
        (MAY_IGNORE_MEDIA_FLAGS.indexOf(flag) >= 0 && !independentText(full));
    })) return held('material_uncertainty');
    if (!reasonableCategory(candidate.category, full)) return held('classification_not_supported');
    // Ignore unverified AI event dates; publish only the verified receipt period.
    if (typeof candidate.title !== 'string' || !candidate.title.trim() || candidate.title.length > 160 ||
        protectedText(candidate.title,publicAssemblySource)) return held('title_missing_or_sensitive');
    // Model-created headlines are editorial labels, not historical evidence.
    // Prefer an innocuous original subject to unsupported model-created claims.
    var title = sourceGrounded(full,candidate.title) ? candidate.title.trim() : s.subject.trim();
    if (!title || protectedText(title,publicAssemblySource) || /(?:first ever|official record|unanimously decided|every member|all six were present)\b/i.test(title))
      return held('title_asserts_unverified_fact');
    var recipe = candidate.recipe;
    if (!recipe || !Array.isArray(recipe.drinkIngredients) || !Array.isArray(recipe.syrupIngredients) || !Array.isArray(recipe.steps))
      return held('invalid_recipe');
    var all = recipe.drinkIngredients.concat(recipe.syrupIngredients,recipe.steps);
    if (candidate.category === 'cocktail') {
      if (!sourceRecipeGrounded(full, recipe)) return held('recipe_measure_or_step_uncertain');
    } else if (all.length) return held('unexpected_recipe');
    var quote = '';
    // Scare quotes and named cocktails are not automatically third-party
    // speech. Explicit reported speech remains protected above.
    if (candidate.category !== 'quotation' && /[\"“”«»]/.test(full) &&
        /\b(?:said|says|told|quoted|quoting|remarked|overheard|claimed)\b/i.test(full))
      return held('third_party_quotation_permission');
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
        syrupIngredients: recipe.syrupIngredients.map(censor),
        steps: recipe.steps.map(censor),
        ...(candidate.category === 'cocktail' && !recipe.steps.length ? { suggestedSteps: suggestedMethod(recipe, source) } : {}) },
      credit: 'anonymous' };
    return { eligible: true, entry: entry,
      mode: MODE };
  }
  return Object.freeze({ MODE: MODE, QUOTE_MODE: QUOTE_MODE, NOTICE: NOTICE, sensitiveText: protectedText, protectedRoute: protectedRoute, censor: censor, cleanText: cleanText, safeSource: safeSource, quotationEvidence: quotationEvidence, independentText: independentText, suggestedMethod: suggestedMethod, propose: propose });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = AnnalsAuto;
