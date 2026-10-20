/* Constrained CoL revision state machine. Pure data only: no eval, code,
 * services, credentials, membership or platform settings in this language. */
var AnnalsRules = (function () {
  'use strict';
  var MEMBERS=['fish','marc','matt','ken','jamie','jerome'];
  var STATUS=['awaiting_clarification','awaiting_implementation','scheduled','active','failed','superseded'];
  function only(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(function(k){return keys.indexOf(k)<0;}))throw new Error('Unexpected rules field');}
  function text(v,n){if(typeof v!=='string'||!v.trim()||v.length>n)throw new Error('Invalid rules text');return v;}
  function stamp(v){if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?(?:Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)!==v.slice(0,10))throw new Error('Unambiguous timestamp required');return v;}
  function id(v){if(!/^col-[a-z0-9-]{6,60}$/.test(v||''))throw new Error('Invalid revision identity');return v;}
  function copy(v){return JSON.parse(JSON.stringify(v));}
  function provisions(markdown){
    var body=markdown.replace(/\r\n/g,'\n').split('\n---\n')[0];
    var chunks=body.split(/(?=^## )/m), result={};
    chunks.slice(1).forEach(function(s){var heading=s.split('\n')[0].slice(3).trim();if(Object.prototype.hasOwnProperty.call(result,heading))throw new Error('Duplicate provision');result[heading]=s.trim();});
    return result;
  }
  function intake(source,assessment,base,revisionId){
    if(!source||source.senderAuthenticated!==true||source.freshOperativeWindow!==true||source.replayed===true||
      MEMBERS.indexOf(source.member)<0||source.truncated===true)throw new Error('Fresh authenticated member request required');
    only(assessment,['intent','requestExcerpt','changes','explanation','clarification','effectiveAt','retrospective','correctionOf']);
    if(['operative','discussion','question','quotation','joke','recollection','unclear'].indexOf(assessment.intent)<0)throw new Error('Unknown intent');
    if(assessment.intent!=='operative')return {state:assessment.intent==='unclear'?'awaiting_clarification':'discussion',question:assessment.clarification||'Did you intend this as an operative CoL rule change?'};
    text(assessment.requestExcerpt,6000);
    if(source.text.replace(/\r\n?/g,'\n').indexOf(assessment.requestExcerpt.replace(/\r\n?/g,'\n'))<0)throw new Error('Request mapping must match original source');
    if(!Array.isArray(assessment.changes)||!assessment.changes.length||assessment.changes.length>8)throw new Error('Bounded CoL provisions required');
    var seen={};
    var changes=assessment.changes.map(function(c){
      only(c,['provision','before','after','sourceExcerpt']);
      if(!Object.prototype.hasOwnProperty.call(base.provisions,c.provision)||seen[c.provision]||base.provisions[c.provision]!==c.before)
        throw new Error('Stale or unknown CoL provision');
      seen[c.provision]=true;text(c.after,6000);text(c.sourceExcerpt,2000);
      if(source.text.replace(/\r\n?/g,'\n').indexOf(c.sourceExcerpt.replace(/\r\n?/g,'\n'))<0||c.after===c.before||c.after.split('\n')[0]!==c.before.split('\n')[0])throw new Error('Exact source and provision boundary required');
      if(/^#(?!## )|^## /m.test(c.after.slice(c.after.indexOf('\n')+1)))throw new Error('Change exceeds provision boundary');
      return copy(c);
    });
    var retro=assessment.retrospective;
    only(retro,['requested','period','results','clubAgreementExcerpt']);
    if(typeof retro.requested!=='boolean')throw new Error('Explicit retrospective choice required');
    var questions=[];
    if(changes.some(function(c){return /\b(?:disable|remove|bypass|weaken|change|replace|increase)\b[^.\n]{0,80}\b(?:authentication|safeguards|credentials|budget|privacy|notification delivery|allowlist|membership|infrastructure)\b/i.test(c.after.replace(c.before,''));}))questions.push('This request includes platform safeguards outside CoL rule authority. Please clarify the CoL-only change.');
    if(retro.requested){
      if(!retro.period||!retro.results||!retro.clubAgreementExcerpt||source.text.indexOf(retro.clubAgreementExcerpt)<0)
        questions.push('Which period and results should change, and did the club expressly agree to that retrospective application?');
    }else if(retro.period||retro.results||retro.clubAgreementExcerpt)throw new Error('Unexpected retrospective effect');
    if(assessment.clarification)questions.push(text(assessment.clarification,1000));
    var effective=assessment.effectiveAt?stamp(assessment.effectiveAt):null;
    return {id:id(revisionId),member:source.member,submittedAt:stamp(source.receivedAt),publishedAt:null,effectiveAt:effective,
      baseVersion:base.id,baseDigest:base.digest,state:questions.length?'awaiting_clarification':'awaiting_implementation',
      explanation:text(assessment.explanation,1000),changes:changes,retrospective:copy(retro),questions:questions,
      requestExcerpt:assessment.requestExcerpt,correctionOf:assessment.correctionOf?source.text.indexOf(assessment.correctionOf)>=0?id(assessment.correctionOf):(function(){throw new Error('Correction reference must be explicit');})():null};
  }
  // A complete member-authored replacement can be retained for deterministic
  // engineering review even if the one-shot AI response invents a source span.
  // This outline never qualifies, adopts, publishes or executes rules.
  function fullRewriteOutline(source,base,revisionId) {
    if(!source||source.senderAuthenticated!==true||source.freshOperativeWindow!==true||
       source.replayed===true||source.truncated===true||MEMBERS.indexOf(source.member)<0||
       typeof source.text!=='string'||source.text.length>38000||
       !base||!base.id||!/^[a-f0-9]{64}$/.test(base.digest||''))throw new Error('Original authenticated source and operative base required');
    var original=source.text.replace(/\r\n?/g,'\n');
    if(!/\b(?:complete|full)\s+(?:updated|revised|replacement|new)\s+(?:col\s+|celebration of life(?: pool)?\s+)?rules\b/i.test(original.slice(0,900)))
      throw new Error('Complete operative rewrite intent is not established');
    var header=original.search(/^\s*CELEBRATION OF LIFE POOL\s*$/m);
    if(header<0)throw new Error('Submitted rule document header is absent');
    var lines=original.slice(header).split('\n'),sections=[];
    lines.forEach(function(line,index){
      var heading=line.trim();
      if(heading.length>=3&&heading.length<=72&&/^[A-Z][A-Z0-9 &\/’'\-]+$/.test(heading)&&/[A-Z]{3}/.test(heading) &&
         !/^\d+$/.test(heading))sections.push({heading:heading,line:index+1});
    });
    if(sections.length<3||sections.length>35)throw new Error('Complete rule document sections cannot be identified');
    return {kind:'complete-member-rewrite-outline-v1',state:'awaiting_implementation',
      revisionId:id(revisionId),baseVersion:base.id,baseDigest:base.digest,
      receivedAt:stamp(source.receivedAt),sections:sections,
      meaningVerified:false,regressionPassed:false,published:false,providerCalled:false};
  }
  function qualify(revision,base,evidence){
    if(revision.state!=='awaiting_implementation'||revision.baseVersion!==base.id||revision.baseDigest!==base.digest)throw new Error('Stale base requires renewed interpretation');
    only(evidence,['meaningVerified','regressionPassed','implementationCommit','sourceRequired','sourceVerified','sourceDigest','historicalResultsPreserved','retrospectiveVerified','releaseVerified']);
    if(evidence.meaningVerified!==true||evidence.regressionPassed!==true||!/^\w{40}$/.test(evidence.implementationCommit||'')||
      typeof evidence.sourceRequired!=='boolean'||evidence.sourceRequired&&(evidence.sourceVerified!==true||!/^[a-f0-9]{64}$/.test(evidence.sourceDigest||''))||
      (!revision.retrospective.requested&&evidence.historicalResultsPreserved!==true)||
      revision.retrospective.requested&&evidence.retrospectiveVerified!==true||evidence.releaseVerified!==true)
      throw new Error('Implementation, source and coordinated release evidence required');
    var next=copy(base.provisions);
    revision.changes.forEach(function(c){if(next[c.provision]!==c.before)throw new Error('Concurrent rule conflict');next[c.provision]=c.after;});
    return {revision:copy(revision),provisions:next,evidence:copy(evidence)};
  }
  function publish(qualified,base,at,operativeBase){
    stamp(at);
    var r=copy(qualified.revision);
    if(r.baseVersion!==base.id||r.baseDigest!==base.digest||operativeBase!==base.id)throw new Error('Scheduled or concurrent base changed');
    var scheduledActivation=r.state==='scheduled'&&r.publishedAt&&Date.parse(r.publishedAt)<=Date.parse(at);
    r.publishedAt=scheduledActivation?r.publishedAt:at;
    if(!r.effectiveAt)r.effectiveAt=at;
    if(Date.parse(r.effectiveAt)<Date.parse(at)&&!r.retrospective.requested&&!scheduledActivation)throw new Error('Past effective date requires retrospective authority');
    r.state=Date.parse(r.effectiveAt)>Date.parse(at)?'scheduled':'active';
    return {revision:r,version:{id:r.id,previous:base.id,provisions:copy(qualified.provisions),effectiveAt:r.effectiveAt,publishedAt:at}};
  }
  function select(versions,at){
    stamp(at);var applicable=versions.filter(function(v){return v.verified===true&&Date.parse(v.effectiveAt)<=Date.parse(at);});
    applicable.sort(function(a,b){return Date.parse(b.effectiveAt)-Date.parse(a.effectiveAt);});
    if(!applicable.length)throw new Error('No verified operative rules version');return applicable[0];
  }
  // This is a deliberately tiny, deterministic automatic class. It is not a
  // semantic judgement: only spaces and the typography of an existing apostrophe
  // may differ. Numbers, words, punctuation, paragraphs and headings stay exact.
  function typography(value){return value.replace(/[\u2018\u2019]/g,"'").replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').trim();}
  function literalWording(source,revision,base){
    if(!source||source.senderAuthenticated!==true||source.freshOperativeWindow!==true||source.replayed===true||source.truncated===true||
      revision.state!=='awaiting_implementation'||revision.retrospective.requested||revision.baseVersion!==base.id||revision.baseDigest!==base.digest||revision.changes.length!==1)
      throw new Error('Literal wording requires fresh prospective exact-base authority');
    var c=revision.changes[0];
    if(base.provisions[c.provision]!==c.before||c.before===c.after||typography(c.before)!==typography(c.after))
      throw new Error('Meaning, parameter, formula or allocation changes require engineering');
    // A full literal replacement is supplied by the member. An AI-created
    // paraphrase, a quoted discussion, or an unrelated source excerpt cannot pass.
    var directive='In the CoL rules, replace "'+c.before+'" with "'+c.after+'".';
    if(typeof source.text!=='string'||source.text.trim()!==directive||revision.requestExcerpt!==directive)
      throw new Error('Exact unquoted replacement instruction required for automatic wording');
    return {kind:'literal-typography-v1',provision:c.provision};
  }
  // Automatic multi-provision rewriting is available only when every word,
  // number and punctuation mark remains the same. AI similarity is NOT proof
  // of equivalence; the author must have supplied the actual replacement text.
  function editorialRewrite(source,revision,base) {
    if(!source||source.senderAuthenticated!==true||source.freshOperativeWindow!==true||
       source.replayed===true||source.truncated===true||typeof source.text!=='string'||
       revision.state!=='awaiting_implementation'||revision.effectiveAt!==null||
       revision.publishedAt!==null||revision.correctionOf!==null||
       revision.retrospective.requested||revision.baseVersion!==base.id||
       revision.baseDigest!==base.digest||!Array.isArray(revision.changes)||
       !revision.changes.length||revision.changes.length>8)
      throw new Error('A fresh prospective editorial rewrite is required');
    var opening=source.text.slice(0,900);
    if(/^\s*(?:for reference|this is an? historical quotation|this is a joke|someone said|what if)\b/i.test(opening))
      throw new Error('Reference material does not change rules');
    if(!/(?:\b(?:updated|revised|amended|replacement|replace|new)\b[^\n]{0,80}\b(?:rules?|col)\b|\b(?:rules?|col)\b[^\n]{0,80}\b(?:updated|revised|amended|replacement)\b)/i.test(opening))
      throw new Error('Complete rewrite intent must be explicit in the member source');
    var seen={};
    revision.changes.forEach(function(change){
      if(seen[change.provision]||base.provisions[change.provision]!==change.before||
         change.after===change.before||typography(change.before)!==typography(change.after)||
         change.after.split('\n')[0]!==change.before.split('\n')[0])
        throw new Error('Rewrite changes meaning or an unverified provision');
      seen[change.provision]=true;
      var words=change.after.slice(change.after.indexOf('\n')+1).trim();
      if(words.length<10||typography(source.text).indexOf(typography(words))<0)
        throw new Error('Replacement words must appear in the actual authored email');
    });
    return {kind:'editorial-rewrite-v1',provisions:Object.keys(seen)};
  }
  // A narrowly defined semantic amendment. No model is permitted to author
  // executable code or choose an alternative calculation for this template.
  var OLDEST_DEATH_STEAL_CLAUSE='Whoever had the oldest celebrity death in the previous calendar year also gets one Steal at the next draft. If needed, compare ages at death to the day level.';
  var OLDEST_DEATH_STEAL_EXPLANATION='One Steal at the next January draft for the member with the oldest celebrity death of the previous calendar year.';
  function oldestSteal(source,base,revisionId){
    if(!source||source.senderAuthenticated!==true||source.freshOperativeWindow!==true||
      source.replayed===true||source.truncated===true||typeof source.text!=='string'||
      !/^whoever had the oldest death in the year gets a steal\. this is effective immediately\.?$/i.test(source.text.trim().replace(/\s+/g,' ')))
      throw new Error('Oldest-death Steal requires the exact authenticated operative instruction');
    var before=base&&base.provisions&&base.provisions['DRAFT - ORDER OF BUSINESS'];
    var marker='\n\n### THIRD - Devil’s Share';
    if(typeof before!=='string'||before.indexOf('### SECOND - Steals')<0||
      before.split(marker).length!==2||before.indexOf(OLDEST_DEATH_STEAL_CLAUSE)>=0)
      throw new Error('Oldest-death award must bind an eligible unchanged base');
    var after=before.replace(marker,'\n\n'+OLDEST_DEATH_STEAL_CLAUSE+marker);
    var assessment={intent:'operative',requestExcerpt:source.text,
      changes:[{provision:'DRAFT - ORDER OF BUSINESS',before:before,after:after,sourceExcerpt:source.text}],
      explanation:OLDEST_DEATH_STEAL_EXPLANATION,clarification:'',effectiveAt:'',
      retrospective:{requested:false,period:'',results:'',clubAgreementExcerpt:''},correctionOf:''};
    return intake(source,assessment,base,revisionId);
  }
  // This is a narrowly bounded semantic interpretation of one complete
  // authenticated rules replacement. It removes only the age-100-only draft
  // bonuses, preserves each Diamond's ordinary benefit and leaves every other
  // unresolved proposal visibly non-operative in its own provision.
  var AGE100_RETIREMENT_QUALIFICATION='centenary-benefit-retirement-v1';
  var AGE100_RETIREMENT_EXPLANATION='The complete member-authored replacement enumerates ordinary Diamond, oldest/youngest and Devil’s Share benefits but omits the former age-100-only bonuses. The selected prospective reading removes only those extra age-100 benefits; the ten-point exception, point multiplier, ordinary Blue/Brown benefit, Birthday Buffet exception and all earlier awards remain unchanged. Renewal, birthday-register, protection-lifecycle, draft-vacancy and sequencing questions remain non-operative Matters for Club Deliberation.';
  var AGE100_RETIREMENT_MATTER='**Matter for Club Deliberation (non-operative).** The complete replacement lists the ordinary Diamond benefits but omits the former age-100-only Steal and additional Diamond benefits. Selected interpretation: the omission ends only those extra benefits prospectively from this version’s verified effective timestamp. Until then, the preceding verified rules govern. The ten points, the normal Blue Diamond Steal, the normal Brown Diamond Blood Diamond, the Birthday Buffet age-100 exception, and all previously awarded benefits remain unchanged. A plausible alternative is that the omitted bonuses were intended to continue.';
  var RENEWAL_MATTER='**Matter for Club Deliberation (non-operative).** The replacement proposes a Renewal-to-Renewal period but supplies no verified Gregorian Renewal date, exact cutoff, or transition for already recorded results. The existing January 1–December 31 period, tied-winner prize rule and prior-year award treatment remain operative until a precise boundary and matching calculations are independently qualified. No immediate or retrospective change is inferred.';
  var BIRTHDAY_MATTER='**Matter for Club Deliberation (non-operative).** The submitted birthday labels do not establish a conversion to the verified Gregorian register; the six current birthdays remain operative. The source also refers to a group-chat report date and excludes Protections, while the authoritative record distinguishes group discovery from actual death and monitor time and the existing award path does not use a verified report timestamp or Protection status for this transfer. Continue using the recorded group discovery date, never a news-monitor time or actual-death date as a substitute. The proposed conversion, report-date refinement and Protection exclusion require a source-matched implementation; existing verified allocations remain unchanged.';
  var DRAFT_VACANCY_MATTER='**Matter for Club Deliberation (non-operative).** “Five or more” draft picks do not guarantee five vacant places when jettisons are optional. Continue filling actual vacancies to restore lists to 50; do not force an extra pick or displace a celebrity. The existing vacancy calculation remains in force until a replacement is independently matched to the Sheet and tested.';
  var DRAFT_SEQUENCE_MATTERS='**Matter for Club Deliberation (non-operative).** The replacement supplies a seven-stage order, but its annual boundary and treatment of rights carried across a boundary are unresolved. The existing sequence, calendar-year benefit period, tie treatment and earned-right ordering remain operative until a complete transition is independently implemented and qualified. No new order or unspent-right rule is inferred.\n\n**Matter for Club Deliberation (non-operative).** The replacement says Protections last until death and cannot be transferred or cancelled. Those lifecycle limits require a verified register representation and matching draft/jettison behavior. Existing protection handling remains operative until that implementation is independently qualified.';
  function replaceOnce(value,needle,replacement,label){
    if(typeof value!=='string'||value.split(needle).length!==2)throw new Error('Expected unchanged '+label+' baseline');
    return value.replace(needle,replacement);
  }
  function appendMatter(base,provision,matter){
    var before=base&&base.provisions&&base.provisions[provision];
    if(typeof before!=='string'||before.indexOf('Matter for Club Deliberation')>=0)throw new Error('Expected unamended '+provision+' baseline');
    return {provision:provision,before:before,after:before+'\n\n'+matter};
  }
  function age100RetirementChanges(base){
    if(!base||!base.provisions)throw new Error('Exact operative CoL base required');
    var p=base.provisions,pointsBonus='If the celebrity is 100 years old when they die, you receive 10 points, and a Steal at the next draft. Diamond bonuses apply as described below; a Brown Diamond at 100 earns two Blood Diamonds instead of a Steal.';
    var blueBonus='\n\nIf your Blue Diamond dies at exactly 100, you earn two Steals.';
    var brownBonus='\n\nIf your Brown Diamond dies at exactly 100, you earn two Blood Diamonds.';
    var points=replaceOnce(p['POINTS'],pointsBonus,'If the celebrity is 100 years old when they die, you receive 10 points.\n\n'+AGE100_RETIREMENT_MATTER,'POINTS');
    var blue=replaceOnce(p['BLUE DIAMOND'],blueBonus,'','BLUE DIAMOND');
    var brown=replaceOnce(p['BROWN DIAMOND'],brownBonus,'','BROWN DIAMOND');
    return [
      {provision:'POINTS',before:p['POINTS'],after:points},
      {provision:'BLUE DIAMOND',before:p['BLUE DIAMOND'],after:blue},
      {provision:'BROWN DIAMOND',before:p['BROWN DIAMOND'],after:brown},
      appendMatter(base,'PRIZE',RENEWAL_MATTER),
      appendMatter(base,'BIRTHDAY BUFFET',BIRTHDAY_MATTER),
      appendMatter(base,'DRAFTING',DRAFT_VACANCY_MATTER),
      appendMatter(base,'DRAFT - ORDER OF BUSINESS',DRAFT_SEQUENCE_MATTERS)
    ];
  }
  function age100Retirement(source,base,revisionId){
    if(!source||source.senderAuthenticated!==true||source.freshOperativeWindow!==true||source.replayed===true||
      source.truncated===true||MEMBERS.indexOf(source.member)<0||typeof source.text!=='string')
      throw new Error('Complete authenticated age-100 replacement required');
    var outline=fullRewriteOutline(source,base,revisionId);
    var normalized=source.text.replace(/\r\n?/g,'\n');
    var header=normalized.search(/^\s*CELEBRATION OF LIFE POOL\s*$/m),rulesText=normalized.slice(header),ruleLines=rulesText.split('\n');
    function sectionText(name){
      var section=outline.sections.find(function(item){return item.heading===name;});
      if(!section)throw new Error('Complete replacement is missing the '+name+' provision');
      var next=outline.sections.filter(function(item){return item.line>section.line;}).sort(function(a,b){return a.line-b.line;})[0];
      return ruleLines.slice(section.line-1,next?next.line-1:ruleLines.length).join('\n');
    }
    var pointSection=sectionText('POINTS'),blueSection=sectionText('BLUE DIAMOND'),brownSection=sectionText('BROWN DIAMOND');
    // The source must omit the extra entitlement in the actual complete rules,
    // not merely in surrounding commentary or a quoted comparison.
    if(/\b100\b/i.test(blueSection)||/\b100\b/i.test(brownSection)||
      /\b100\b[^.\n]{0,140}\b(?:Steal|Protection|Blood Diamond)\b/i.test(pointSection)||
      /\b(?:Steal|Protection|Blood Diamond)\b[^.\n]{0,140}\b100\b/i.test(pointSection))
      throw new Error('The complete replacement retains or ambiguously restates an age-100 draft benefit');
    function sourceMatch(text,pattern,label){var match=text.match(pattern);if(!match)throw new Error('Complete replacement does not support the bounded '+label+' interpretation');return match[0];}
    var requestIntro=sourceMatch(normalized.slice(0,900),/\b(?:complete|full)\s+(?:updated|revised|replacement|new)\s+(?:col\s+|celebration of life(?: pool)?\s+)?rules\b/i,'complete-rules');
    var pointSource=sourceMatch(pointSection,/\b(?:celebrity|celebrities)[^\n.]{0,120}\b100\b[^\n.]{0,120}\b10 points?\b/i,'ten-point');
    var blueSource=sourceMatch(blueSection,/Blue Diamond[^\n.]{0,120}\bSteal\b/i,'ordinary Blue Diamond');
    var brownSource=sourceMatch(brownSection,/Brown Diamond[^\n.]{0,120}\bProtection\b/i,'ordinary Brown Diamond');
    var renewalSource=sourceMatch(rulesText,/Renewal Stammtisch/i,'Renewal');
    var birthdaySource=sourceMatch(rulesText,/Birthday Buffet[^\n]{0,180}group chat/i,'Birthday Buffet');
    var vacancySource=sourceMatch(rulesText,/draft[^\n.]{0,160}\bfive or more\b/i,'vacancy');
    var protectionSource=sourceMatch(rulesText,/Protections?[^\n.]{0,120}\b(?:cannot|can't|may not)\b[^\n.]{0,80}\b(?:transferred|cancelled|canceled)\b/i,'Protection lifecycle');
    if(normalized.indexOf('If your Blue Diamond dies at exactly 100')>=0||
       normalized.indexOf('If your Brown Diamond dies at exactly 100')>=0||
       normalized.indexOf('Brown Diamond at 100 earns two Blood Diamonds')>=0)
      throw new Error('The replacement retains an age-100 Diamond bonus');
    var changes=age100RetirementChanges(base);
    changes[0].sourceExcerpt=pointSource;
    changes[1].sourceExcerpt=blueSource;
    changes[2].sourceExcerpt=brownSource;
    changes[3].sourceExcerpt=renewalSource;
    changes[4].sourceExcerpt=birthdaySource;
    changes[5].sourceExcerpt=vacancySource;
    changes[6].sourceExcerpt=protectionSource;
    return intake(source,{intent:'operative',
      requestExcerpt:requestIntro,
      changes:changes,explanation:AGE100_RETIREMENT_EXPLANATION,clarification:'',effectiveAt:'',
      retrospective:{requested:false,period:'',results:'',clubAgreementExcerpt:''},correctionOf:''},base,revisionId);
  }
  // Public-safe capability for one supervised first production acceptance.
  // It is not a signing/remediation result and never enables general intake.
  function acceptanceDescriptor(value,now,phase){
    var keys=['schemaVersion','kind','revisionId','contentDigest','initialStateDigest','implementationCommit','behaviorDigest','nonce','armedAt','expiresAt'];
    only(value,keys);
    if(Object.keys(value).length!==keys.length||value.schemaVersion!==1||value.kind!=='col-oldest-acceptance-v1')throw new Error('Exact acceptance descriptor required');
    id(value.revisionId);
    ['contentDigest','initialStateDigest','behaviorDigest','nonce'].forEach(function(k){if(!/^[a-f0-9]{64}$/.test(value[k]||''))throw new Error('Invalid acceptance binding');});
    if(!/^[a-f0-9]{40}$/.test(value.implementationCommit||''))throw new Error('Invalid acceptance implementation');
    stamp(value.armedAt);stamp(value.expiresAt);
    var start=Date.parse(value.armedAt),end=Date.parse(value.expiresAt);
    if(!Number.isFinite(now)||start>now||end-start!==2700000||['stage','authorize','confirm','seal','cancel','read'].indexOf(phase)<0||
      ['stage','authorize','confirm'].indexOf(phase)>=0&&now>=end)throw new Error('Acceptance window unavailable');
    return copy(value);
  }
  function publicRecord(r){
    [r.explanation].concat(r.changes.map(function(c){return c.after;})).forEach(function(s){if(typeof s!=='string'||/[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|<[^>]+>|\b(?:password|passcode|api key|home address)\b/i.test(s))throw new Error('Private content cannot enter public revision');});
    if(MEMBERS.indexOf(r.member)<0||STATUS.indexOf(r.state)<0)throw new Error('Invalid public revision');
    return {id:id(r.id),member:r.member,submittedAt:stamp(r.submittedAt),publishedAt:r.publishedAt===null?null:stamp(r.publishedAt),
      effectiveAt:r.effectiveAt===null?null:stamp(r.effectiveAt),state:r.state,baseVersion:id(r.baseVersion),
      explanation:text(r.explanation,1000),changes:r.changes.map(function(c){return {provision:text(c.provision,100),before:text(c.before,6000),after:text(c.after,6000)};}),
      correctionOf:r.correctionOf===null?null:id(r.correctionOf)};
  }
  return Object.freeze({provisions:provisions,intake:intake,fullRewriteOutline:fullRewriteOutline,qualify:qualify,publish:publish,select:select,publicRecord:publicRecord,stamp:stamp,typography:typography,literalWording:literalWording,editorialRewrite:editorialRewrite,oldestSteal:oldestSteal,age100Retirement:age100Retirement,age100RetirementChanges:age100RetirementChanges,acceptanceDescriptor:acceptanceDescriptor,OLDEST_DEATH_STEAL_CLAUSE:OLDEST_DEATH_STEAL_CLAUSE,OLDEST_DEATH_STEAL_EXPLANATION:OLDEST_DEATH_STEAL_EXPLANATION,AGE100_RETIREMENT_QUALIFICATION:AGE100_RETIREMENT_QUALIFICATION,AGE100_RETIREMENT_EXPLANATION:AGE100_RETIREMENT_EXPLANATION,AGE100_RETIREMENT_MATTER:AGE100_RETIREMENT_MATTER,RENEWAL_MATTER:RENEWAL_MATTER,BIRTHDAY_MATTER:BIRTHDAY_MATTER,DRAFT_VACANCY_MATTER:DRAFT_VACANCY_MATTER,DRAFT_SEQUENCE_MATTERS:DRAFT_SEQUENCE_MATTERS});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=AnnalsRules;
