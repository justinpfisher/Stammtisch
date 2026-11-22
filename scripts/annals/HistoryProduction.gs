/* Added to the EXISTING owner-only deployment; no installation or trigger reset. */
/* Member eligibility is centralized in Production.gs. */
/** Read-only rotation check using an existing private signed record. Never
 * returns keys, signatures, source text or identifiers; never re-signs a record.
 * GitHub's replacement secret still needs separate hosted verification. */
function annalsCheckSigningRotation(nonce,id){
  return annalsUiCall_(nonce,function(){
    var f=annalsFolder_(id),saved=annalsRead_(f,'approval-private.json'),p=annalsProps_();
    if(!saved||!saved.entry||!saved.receipt||!saved.publication)throw new Error('Existing signed private evidence required');
    var key=p.getProperty('ANNALS_APPROVAL_KEY')||'',publishKey=p.getProperty('ANNALS_PUBLISH_SIGNING_KEY')||'';
    if(key.length<32||publishKey.length<32||key===publishKey)throw new Error('Independent signing configuration required');
    var receipt=Object.assign({},saved.receipt);delete receipt.signature;
    var fresh=Object.assign({},receipt,{signature:annalsHex_(Utilities.computeHmacSha256Signature(
      AnnalsProduction.serial({entry:saved.entry,receipt:receipt}),key,Utilities.Charset.UTF_8))});
    var proof=Object.assign({},saved.publication);delete proof.signature;
    var expected=annalsHex_(Utilities.computeHmacSha256Signature(
      AnnalsProduction.serial({entry:saved.entry,approval:proof}),publishKey,Utilities.Charset.UTF_8));
    return {separateKeys:true,newPrivateSignatureValid:annalsPrivateReceiptValid_(saved.entry,fresh),
      oldPrivateSignatureRejected:!annalsPrivateReceiptValid_(saved.entry,saved.receipt),
      oldPublicSignatureRejected:expected!==saved.publication.signature,
      githubSecretConsistencyVerified:false,publishesAnything:false};
  });
}
/** Called only while the normal intake lock is already held. One paid attempt
 * uses the EXISTING ten-cent reservation and twelve-thousand-character bound. */
function annalsPrepareRuleDraftCore_(id){
  var p=annalsProps_(),f=annalsFolder_(id),source=annalsRead_(f,'source-private.json');
  if(!source||!source.senderAuthenticated||!source.aiConsentActive||!annalsConsentActive_(source.source.sender)||
    annalsFile_(f,'quarantine-private.json')||annalsFile_(f,'ai-attempt-private.json')||
    p.getProperty('ANNALS_AI_ENABLED')!=='true'||!p.getProperty('ANNALS_OPENAI_API_KEY')||!annalsPublisherDispatchReady_()||
    source.source.sourceTruncated||source.source.subjectTruncated||source.source.excerptTruncated||
    AnnalsAuto.protectedRoute(source.source.subject,source.source.excerpt)!=='col_proposal'||
    !annalsSafeTextForAutoAi_(annalsAiSourceText_(source)))return false;
  var snapshot=annalsRead_(f,'col-official-rules-snapshot-private.json');
  if(!snapshot){
    var fetched=UrlFetchApp.fetch('https://raw.githubusercontent.com/justinpfisher/Stammtisch/main/docs/celebration-of-life-rules.md',
      {muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
    if(fetched.getResponseCode()!==200)return false;
    var rules=fetched.getContentText();if(rules.length>30000||rules.indexOf('# STAMMTISCH')!==0)return false;
    snapshot={text:rules,sha256:annalsHash_(rules),capturedAt:new Date().toISOString()};
    annalsWriteOnce_(f,'col-official-rules-snapshot-private.json',snapshot);
  }
  var request=AnnalsGovernance.request(annalsAiSourceText_(source),snapshot.text,AnnalsProduction.MODEL);
  var ledger=AnnalsProduction.reserve(JSON.parse(p.getProperty('ANNALS_BUDGET_LEDGER')||'null'),Utilities.formatDate(new Date(),'America/Toronto','yyyy-MM'));
  p.setProperty('ANNALS_BUDGET_LEDGER',JSON.stringify(ledger));
  annalsWriteOnce_(f,'ai-attempt-private.json',{state:'attempt_reserved',reservedCents:10,at:new Date().toISOString(),model:AnnalsProduction.MODEL,purpose:'private_col_proposal'});
  var response;
  try{response=UrlFetchApp.fetch('https://api.openai.com/v1/responses',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+p.getProperty('ANNALS_OPENAI_API_KEY')},payload:JSON.stringify(request),muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});}
  catch(ignored){annalsRecordAttemptOutcome_(f,'provider_result_unknown',0);return false;}
  var status,text;
  try{
    status=response.getResponseCode();
    if(status!==200){annalsRecordAttemptOutcome_(f,'provider_http_failure',status);return false;}
    text=response.getContentText();
  }catch(ignored){annalsRecordAttemptOutcome_(f,'provider_result_unknown',0);return false;}
  if(typeof text!=='string'||text.length>100000){annalsRecordAttemptOutcome_(f,'invalid_response',200);return false;}
  annalsWriteOnce_(f,'ai-response-private.json',{responseText:text,httpStatus:200,purpose:'private_col_proposal'});
  try{
    var assessment=AnnalsGovernance.response(JSON.parse(text));
    var packet=AnnalsGovernance.packet(source,snapshot.text,assessment.heading,assessment.replacement,assessment.recommendation);
    ['scores','selections','awards','drafting','annualRollover','notifications'].forEach(function(k){packet.effects[k]=assessment[k];});
    packet.unresolved.push(assessment.effectiveDate,assessment.contradictions);
    packet.sourceId=id;packet.officialRulesDigest=snapshot.sha256;packet.preparedAt=new Date().toISOString();packet.aiSuggestionsUnverified=true;
    var digest=annalsHash_(AnnalsProduction.serial(packet));
    annalsWriteOnce_(f,'col-proposal-'+digest+'-private.json',packet);
    annalsSavePrivate_(f,'col-proposal-private.json',packet);
    return true;
  }catch(ignored){annalsRecordAttemptOutcome_(f,'invalid_response',200);return false;}
}
function annalsPrepareRuleProposal(nonce,id,heading,replacement,recommendation) {
  return annalsUiCall_(nonce,function(){return annalsLocked_(function(){
    var f=annalsFolder_(id),source=annalsRead_(f,'source-private.json');
    if(!source || !source.senderAuthenticated || annalsFile_(f,'quarantine-private.json') ||
      AnnalsAuto.protectedRoute(source.source.subject,source.source.excerpt)!=='col_proposal') throw new Error('Authenticated rule proposal required');
    var snapshot=annalsRead_(f,'col-official-rules-snapshot-private.json');
    if(!snapshot){
      var response=UrlFetchApp.fetch('https://raw.githubusercontent.com/justinpfisher/Stammtisch/main/docs/celebration-of-life-rules.md',
        {muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
      if(response.getResponseCode()!==200)throw new Error('Official rules unavailable; no proposal changed');
      var rules=response.getContentText();
      if(rules.length>30000||rules.indexOf('# STAMMTISCH')!==0)throw new Error('Unexpected official rules');
      snapshot={text:rules,sha256:annalsHash_(rules),capturedAt:new Date().toISOString()};
      annalsWriteOnce_(f,'col-official-rules-snapshot-private.json',snapshot);
    }
    var packet=AnnalsGovernance.packet(source,snapshot.text,heading,replacement,recommendation);
    packet.sourceId=id;packet.officialRulesDigest=snapshot.sha256;packet.preparedAt=new Date().toISOString();
    // Preserve every review version, including original unadopted suggestions.
    var digest=annalsHash_(AnnalsProduction.serial(packet));
    if(!annalsFile_(f,'col-proposal-'+digest+'-private.json'))annalsWriteOnce_(f,'col-proposal-'+digest+'-private.json',packet);
    annalsSavePrivate_(f,'col-proposal-private.json',packet);
    return packet;
  });});
}
function annalsHistoryLedger_(){return annalsRead_(annalsRoot_(),'history-ledger-private.json')||AnnalsHistory.empty();}
function annalsSaveHistoryClaim(nonce,id,raw,operation,reason){
  return annalsUiCall_(nonce,function(){return annalsLocked_(function(){
    var f=annalsFolder_(id),source=annalsRead_(f,'source-private.json');
    if(!source || annalsFile_(f,'quarantine-private.json') || operation!=='withdraw'&&(!annalsConsentActive_(source.source.sender)||
      !annalsStandingPublicationActive_(source.source.sender,source.source.receivedAt)))throw new Error('Current and receipt-time consent required');
    if(operation!=='withdraw')annalsOrdinarySourceGate_(source);
    if(['add','correct','withdraw'].indexOf(operation)<0||typeof reason!=='string'||reason.trim().length<10||reason.length>1000)throw new Error('Explicit private evidence required');
    var current=annalsRead_(annalsRoot_(),'history-published-private.json');
    if(current&&current.schemaVersion===2)throw new Error('Use Maintain published Club History for source-bound corrections and withdrawals');
    var ledger=annalsHistoryLedger_(),next,at=new Date().toISOString();
    if(operation==='withdraw')next=AnnalsHistory.withdraw(ledger,id,at,reason);
    else{
      raw=Object.assign({},raw,{sourceId:id});
      raw.id=annalsHash_(AnnalsProduction.serial(raw));
      var claim=AnnalsHistory.claim(source,raw),decision=AnnalsHistory.propose(ledger,claim);
      if(operation==='add'&&decision.kind==='dispute'){
        var dispute={state:'held_for_reconciliation',claim:claim,affected:decision.affected,at:at};
        if(!annalsFile_(f,'history-dispute-'+claim.id+'-private.json'))annalsWriteOnce_(f,'history-dispute-'+claim.id+'-private.json',dispute);
        return {held:true,reason:'conflicting_recollections',chapters:AnnalsHistory.chapters(ledger)};
      }
      next=operation==='correct'?AnnalsHistory.resolve(ledger,claim.factKey,claim,at,reason):AnnalsHistory.apply(ledger,claim,true,at,reason).ledger;
    }
    var review={expectedLedgerDigest:annalsHash_(AnnalsProduction.serial(ledger)),ledger:next,
      chapters:AnnalsHistory.chapters(next),savedAt:at,reason:reason,operation:operation};
    review.hash=annalsHash_(AnnalsProduction.serial(review));
    annalsSavePrivate_(f,'history-review-private.json',review);
    return {hash:review.hash,chapters:review.chapters,operation:operation};
  });});
}
function annalsApproveHistoryRevision(nonce,id,expectedHash,confirmed){
  return annalsUiCall_(nonce,function(){return annalsLocked_(function(){
    var p=annalsProps_(),f=annalsFolder_(id),review=annalsRead_(f,'history-review-private.json'),source=annalsRead_(f,'source-private.json');
    if(confirmed!==true||!review||review.hash!==expectedHash||!source||annalsFile_(f,'quarantine-private.json')||
      review.operation!=='withdraw'&&!annalsStandingPublicationActive_(source.source.sender,source.source.receivedAt)||
      review.expectedLedgerDigest!==annalsHash_(AnnalsProduction.serial(annalsHistoryLedger_())))throw new Error('History review changed or permission revoked');
    var unsignedReview=Object.assign({},review);delete unsignedReview.hash;
    if(annalsHash_(AnnalsProduction.serial(unsignedReview))!==expectedHash)throw new Error('History preview altered after review');
    review.ledger.claims.filter(function(c){return c.active;}).forEach(function(c){
      var original=annalsRead_(annalsFolder_(c.sourceId),'source-private.json');
      if(!original||!annalsConsentActive_(original.source.sender)||!annalsStandingPublicationActive_(original.source.sender,original.source.receivedAt))throw new Error('Active history claim permission revoked');
      if(AnnalsProduction.serial(AnnalsHistory.claim(original,c))!==AnnalsProduction.serial(c))throw new Error('History claim no longer matches immutable original');
    });
    if(review.operation!=='withdraw')annalsOrdinarySourceGate_(source);
    return annalsDispatchHistoryRevision_(f,id,review,1,review.chapters,1,null);
  });});
}
/* Opening edition: exact owner-approved copy, private provenance and existing signing authority. */
var ANNALS_HISTORY_OPENING_COPY_SHA_='aeee052a77723fa4bb67b2abbe16a07c3466147536a570ff7418ab44003fd49c';
var ANNALS_HISTORY_OPENING_SOURCES_={
  "origins/opening-1": [
    [
      "record",
      "club-record"
    ],
    [
      "record",
      "six-face-crest"
    ]
  ],
  "gatherings/opening-1": [
    [
      "record",
      "monthly-stammtisch"
    ]
  ],
  "gatherings/opening-2": [
    [
      "record",
      "club-record"
    ],
    [
      "annal",
      "annal-96b5ae266a36793c6a203033",
      "Kingston Windfall",
      "marc"
    ],
    [
      "annal",
      "annal-5e0607c7dc924fb5663c40e0",
      "Daq in Black (Amaro Nonino Edition)",
      "marc"
    ]
  ],
  "assemblies/opening-1": [
    [
      "record",
      "january-2026-notice"
    ],
    [
      "record",
      "huntsville-assembly"
    ]
  ],
  "traditions/opening-1": [
    [
      "record",
      "remembrance-speech"
    ]
  ],
  "traditions/opening-2": [
    [
      "annal",
      "annal-f463f9566e3d9c3fe09465de",
      "Justin’s Christisch entry",
      "fish"
    ]
  ]
};

var ANNALS_HISTORY_OPENING_ANNALS_SHA_={
  "annal-96b5ae266a36793c6a203033": "26f03d51bef159af31ec060b53c172face39acc68015346c3b3f0335e64361bd",
  "annal-f463f9566e3d9c3fe09465de": "fbd9d1485454f5396cf59f683922069ab3632d967368e3665a784f826b62c7bd",
  "annal-5e0607c7dc924fb5663c40e0": "38110f4dec7c074039d138caa360999b5f3f4777d81bee1c60a2c876a683575c"
};

// Digest of the original signed publication proof in b9d260b51d8d3a5734ece1beae8af84a2702e6bc.
// That standing-consent approval used member-only intake before the two flags existed.
var ANNALS_HISTORY_OPENING_LEGACY_PROOF_SHA_={
  "annal-96b5ae266a36793c6a203033": "d2de13e28028bd473b7b2288e344d12a372f3d1a1aa5e719b310d1f454281977"
};

function annalsOpeningSourceGate_(folder,source,entryId,portrait){
  var expected=ANNALS_HISTORY_OPENING_LEGACY_PROOF_SHA_[entryId];
  if(!expected){
    annalsOrdinarySourceGate_(source);
    return;
  }
  var original=annalsRead_(folder,'approval-private.json'),
    proof=original&&original.publication, received=Date.parse(source.source.receivedAt);
  if(!proof||original.publicationState!=='dispatch_accepted'||!original.entry||
    proof.entryId!==entryId||original.entry.id!==entryId||original.entry.contributorPortrait!==portrait||
    proof.contentSha256!==annalsHash_(AnnalsProduction.serial(original.entry))||
    expected!==annalsHash_(AnnalsProduction.serial(proof))||
    !Number.isFinite(received)||!(received<=Date.parse(proof.approvedAt))||
    source.aiConsentActive!==true||source.autoConsentAtReceipt!==true)
    throw new Error('Opening legacy membership evidence missing or changed');

  // The original publisher wrote this eligibility decision before the signed approval.
  var initial=annalsRead_(folder,'auto-decision-private.json'),
    wasHeld=initial&&initial.state==='held',
    eligibility=wasHeld?annalsRead_(folder,'auto-reassessment-private.json'):initial,
    subject=source.source.subject, excerpt=source.source.excerpt;
  if(!eligibility||eligibility.state!=='eligible'||eligibility.policy!==proof.mode||
    original.approvalMode!==proof.mode||eligibility.contentSha256!==proof.contentSha256||
    (!wasHeld&&annalsFile_(folder,'auto-reassessment-private.json'))||
    typeof subject!=='string'||typeof excerpt!=='string'||/[\r\n]/.test(subject)||
    eligibility.sourceDigest!==annalsHash_(subject+'\n'+excerpt))
    throw new Error('Opening legacy source-to-approval evidence missing or changed');

  // Keep the original fields authoritative when present and never write the derived flags.
  var hasFlag=Object.prototype.hasOwnProperty;
  annalsOrdinarySourceGate_(hasFlag.call(source,'clubMemberAuthenticated')||hasFlag.call(source,'externalContributionAtReceipt')?
    source:Object.assign({},source,{clubMemberAuthenticated:true,externalContributionAtReceipt:false}));
}

function annalsOpeningArchive_(){
  var response=UrlFetchApp.fetch('https://stammtischbrewery.com/data/annals-approved.json',
    {muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
  if(response.getResponseCode()!==200)throw new Error('Cannot check the live approved Annals');
  var value=JSON.parse(response.getContentText());
  if(!Array.isArray(value.entries)||!Array.isArray(value.approvals))throw new Error('Cannot verify the live approved Annals shape');
  return value;
}
function annalsOpeningEdition_(packet,archive,allowUncredited){
  if(!packet||packet.schemaVersion!==1||
    annalsHash_(AnnalsProduction.serial(packet.chapters))!==ANNALS_HISTORY_OPENING_COPY_SHA_||
    !packet.records||!packet.annals)throw new Error('Missing or altered approved opening packet');
  // These owner-recollection witnesses are checked privately, never sent to GitHub.
  ['naming-recollection','standing-date-recollection','cottage-recollection','christisch-recollection'].forEach(function(key){
    var record=packet.records[key];
    if(!record||typeof record.locator!=='string'||!record.locator.trim()||
      typeof record.reviewedMeaning!=='string'||!record.reviewedMeaning.trim())throw new Error('Missing opening recollection provenance');
  });
  var canonical=packet.chapters.map(function(c){
    return {id:c.id,heading:c.heading,passages:c.passages.map(function(p){
      var expected=ANNALS_HISTORY_OPENING_SOURCES_[c.id+'/'+p.id];
      if(!expected)throw new Error('Unsupported opening passage');
      return {id:p.id,text:p.text,sources:expected.map(function(spec){
        if(spec[0]==='record'){
          // Review witness and correspondence stay in this private packet.
          var record=packet.records[spec[1]];
          if(!record||typeof record.locator!=='string'||!record.locator.trim()||
            typeof record.reviewedMeaning!=='string'||!record.reviewedMeaning.trim())throw new Error('Opening documentary provenance missing');
          return {kind:'record',ref:spec[1]};
        }
        var id=packet.annals[spec[1]],entryId=spec[1],folder=annalsFolder_(id),
          source=annalsRead_(folder,'source-private.json'),entry=archive.entries.find(function(e){return e.id===entryId;}),
          receipt=archive.approvals.find(function(r){return r.entryId===entryId;}),
          portrait=source&&annalsContributorPortrait_(source);
        if('annal-'+id.slice(0,24)!==entryId||!source||source.sourceId!==id||!source.source||
          annalsFile_(folder,'quarantine-private.json')||annalsFile_(folder,'removal-private.json')||
          !annalsConsentActive_(source.source.sender)||
          !annalsStandingPublicationActive_(source.source.sender,source.source.receivedAt)||
          !entry||!receipt||!receipt.consents||receipt.consents.publication!==true||
          entry.contributorPortrait!==spec[3]||
          (portrait!==spec[3]&&!(allowUncredited===true&&portrait===null))||
          (receipt.consents.namedAttribution!==true&&allowUncredited!==true)||
          receipt.contentSha256!==ANNALS_HISTORY_OPENING_ANNALS_SHA_[entryId]||
          receipt.contentSha256!==annalsHash_(AnnalsProduction.serial(entry)))throw new Error('Opening Annals provenance or permission changed');
        annalsOpeningSourceGate_(folder,source,entryId,spec[3]);
        return {kind:'annal',entryId:entryId,digest:receipt.contentSha256,label:spec[2],
          portrait:receipt.consents.namedAttribution===true?portrait:null};
      })};
    })};
  });
  return canonical;
}
function annalsPreviewHistoryOpening(nonce){
  return annalsUiCall_(nonce,function(){
    var packet=annalsRead_(annalsRoot_(),'history-opening-authorized-private.json');
    var chapters=annalsOpeningEdition_(packet,annalsOpeningArchive_());
    return {previewDigest:annalsHash_(AnnalsProduction.serial(chapters)),
      chapterCount:chapters.length,portraitCount:new Set(chapters.flatMap(function(c){return c.passages.flatMap(function(p){return p.sources.map(function(s){return s.portrait;});});}).filter(Boolean)).size};
  });
}
function annalsPublishHistoryOpening(nonce,expectedHash,confirmed){
  return annalsUiCall_(nonce,function(){return annalsLocked_(function(){
    if(confirmed!==true)throw new Error('Opening edition was not confirmed');
    var root=annalsRoot_(),packet=annalsRead_(root,'history-opening-authorized-private.json');
    var chapters=annalsOpeningEdition_(packet,annalsOpeningArchive_());
    if(expectedHash!==annalsHash_(AnnalsProduction.serial(chapters)))throw new Error('Reviewed opening changed');
    return annalsDispatchHistoryRevision_(root,null,{
      operation:'opening',
      boundLedger:{schemaVersion:1,privateOpeningPacketSha256:annalsHash_(AnnalsProduction.serial(packet)),chapters:chapters}
    },2,chapters,1,0);
  });});
}

// The owner's approved editorial revision of the exact reconciled opening.
// Keep passage IDs and evidence. The signed document, not this copy, serves Pages.
var ANNALS_HISTORY_EDITORIAL_BASE_='10c5341e2cc9e40d2a2e0387ea4efa186010217aee1bd2a172ac7a1b5b7334aa';
var ANNALS_HISTORY_BRIEF_BASE_='dec51dce2772c0033259e89ee614b86328734deb54ae92d6179a3f6180e99941';
var ANNALS_HISTORY_EDITORIAL_COPY_={
  "origins": {
    "heading": "The name",
    "passages": {
      "opening-1": "The company had been gathering for some time when one of its number, of Germanic heritage, observed that it was already Stammtisching. The evening on which this was pointed out has escaped the record. The name, on the other hand, has proved easier to retain."
    }
  },
  "gatherings": {
    "heading": "The appointed evening",
    "passages": {
      "opening-1": "A tradition that depended on finding a free evening in six calendars was unlikely to meet very often. The Club set aside the third Friday of each month, at eight o’clock Toronto time.",
      "opening-2": "At many gatherings, one or two members take a turn preparing a cocktail. Kingston Windfall and Daq in Black are both in the Annals. The Club has also fielded a Mud Hero team, for which the surviving notes are particularly informative on the subject of shirts."
    }
  },
  "assemblies": {
    "heading": "The Annual Gentlemen’s Assembly",
    "passages": {
      "opening-1": "By one recollection, the company was going to the cottage together before the pandemic. The date of the first weekend is not known, nor is the date on which it became the Annual Gentlemen’s Assembly. The cottage had evidently been fit for purpose before it acquired a formal title."
    }
  },
  "traditions": {
    "heading": "The Club’s observances",
    "passages": {
      "opening-2": "The December gathering is known as Christisch. The gifts come from the members’ own homes, leaving commerce with a gratifyingly small role in the proceedings. One recollection places an exchange in December 2025. The year of the first Christisch remains uncertain.",
      "opening-1": "In Celebration of Life, each member keeps a list of fifty names. When someone on a member’s list dies, that member speaks at the next Stammtisch about the person and what they gave the world. The standings are kept elsewhere. This part of the evening belongs to the life being remembered."
    }
  }
};

function annalsOpeningEditorialChapters_(packet){
  var checked=annalsOpeningEdition_(packet,annalsOpeningArchive_(),true);
  return checked.map(function(chapter){
    var copy=ANNALS_HISTORY_EDITORIAL_COPY_[chapter.id];
    return {id:chapter.id,heading:copy.heading,passages:Object.keys(copy.passages).map(function(id){
      var passage=chapter.passages.find(function(item){return item.id===id;});
      return {id:id,text:copy.passages[id],sources:passage.sources.map(function(source){
        if(source.kind!=='annal')return source;
        if(source.entryId==='annal-f463f9566e3d9c3fe09465de')
          return Object.assign({},source,{label:'Christisch in the Annals'});
        if(source.entryId==='annal-5e0607c7dc924fb5663c40e0')
          return Object.assign({},source,{label:'Daq in Black'});
        return source;
      })};
    })};
  });
}

// The Club's account is recorded in docs/club-context-and-history.md.
// Keep all four chapter destinations available for future signed contributions.
function annalsBriefHistoryChapters_(){
  function chapter(id,heading,text,refs){
    return {id:id,heading:heading,passages:[{id:'opening-1',text:text,
      sources:refs.map(function(ref){return {kind:'record',ref:ref};})}]};
  }
  return [
    chapter('origins','The early days',
      'The beginnings of the Club are to be found, sometime before the pandemic, in the perfectly ordinary circumstance of six friends getting together whenever they could. Both evenings in company and weekends at the cottage are remembered from this early period. The surviving recollections do not permit either to claim precedence.',
      ['club-recollection']),
    chapter('gatherings','The third Friday',
      'Once the pleasure of assembling had been established, there remained the less agreeable business of arranging to do it again. In due course the Club set aside the third Friday of each month, at eight o’clock by the Eastern clock, which in winter stands five hours behind Greenwich. This relieved six calendars of the obligation to enter into fresh negotiations on every occasion.',
      ['club-recollection','monthly-stammtisch']),
    chapter('traditions','Club traditions',
      'Several of the Club’s observances owe their existence to a suggestion originally advanced for no more solemn purpose than the diversion of the company. The company, finding the suggestion agreeable, would then bestow upon it rather more attention than the occasion strictly warranted.',
      ['club-recollection']),
    chapter('assemblies','The Annual Gentlemen’s Assembly',
      'The cottage weekend itself came, in time, to bear the title of Annual Gentlemen’s Assembly.',
      ['club-recollection','huntsville-assembly'])
  ];
}

function annalsHistoryEditorialCandidate_(){
  var state=annalsBoundMaintenanceState_(false);
  if(state.digest!==ANNALS_HISTORY_EDITORIAL_BASE_&&state.digest!==ANNALS_HISTORY_BRIEF_BASE_)
    throw new Error('Editorial refresh requires the exact reconciled opening edition');
  var live=JSON.parse(annalsHistoryReadPublic_('https://stammtischbrewery.com/data/club-history.json'));
  if(annalsHash_(AnnalsProduction.serial(live))!==state.digest)
    throw new Error('Editorial refresh requires the exact live opening edition');
  var packet=annalsRead_(state.root,'history-opening-authorized-private.json');
  if(!packet||annalsHash_(AnnalsProduction.serial(packet))!==state.ledger.privateOpeningPacketSha256)
    throw new Error('Opening evidence changed');
  var chapters=state.digest===ANNALS_HISTORY_BRIEF_BASE_?
    annalsBriefHistoryChapters_():annalsOpeningEditorialChapters_(packet);
  return {state:state,chapters:chapters,digest:annalsHash_(AnnalsProduction.serial({base:state.digest,chapters:chapters}))};
}
function annalsPreviewHistoryEditorial(nonce){
  return annalsUiCall_(nonce,function(){return annalsLocked_(function(){
    var candidate=annalsHistoryEditorialCandidate_();
    return {chapters:candidate.chapters,previewDigest:candidate.digest};
  });});
}
function annalsPublishHistoryEditorial(nonce,expectedDigest,confirmed){
  return annalsUiCall_(nonce,function(){return annalsLocked_(function(){
    if(confirmed!==true)throw new Error('Confirm the editorial preview first');
    var candidate=annalsHistoryEditorialCandidate_(), state=candidate.state;
    if(expectedDigest!==candidate.digest)throw new Error('Editorial preview changed');
    return annalsDispatchHistoryRevision_(state.root,null,{
      operation:'opening-editorial-refresh',
      boundLedger:Object.assign({},state.ledger,{chapters:candidate.chapters})
    },2,candidate.chapters,2,state.current.revision);
  });});
}

// Keep the exact public subtraction projection mechanically bound by tests.
// Rebasing cannot introduce a sentence, source, or portrait.
function archivedSupport(entries, receipts) {
  const records = new Map(receipts.map(r => [r.entryId,r]));
  return new Map(entries.map(e => {
    const receipt = records.get(e.id);
    return [e.id,{entry:e,receipt,digest:receipt?.contentSha256,portrait:
      receipt?.consents?.namedAttribution === true ? e.contributorPortrait ?? null : null}];
  }));
}

// The two founding recipe references support separable title mentions in the
// approved opening sentence. The ordinary publisher can delete only those
// exact words (never compose new prose). Other passages remain conjunctive.
const OPENING_RECIPE_LINE = "Marc gave that tradition a place in the written record when he contributed Kingston Windfall and Daq in Black to the Annals.";
const OPENING_RECIPE_CLAIMS = Object.freeze([
  {entryId:'annal-96b5ae266a36793c6a203033',title:'Kingston Windfall'},
  {entryId:'annal-5e0607c7dc924fb5663c40e0',title:'Daq in Black'}
]);
function subtractOpeningRecipe(c,p,missing){
  if(c.id!=='gatherings'||p.id!=='opening-2'||!missing.every(s=>OPENING_RECIPE_CLAIMS.some(k=>k.entryId===s.entryId)))return null;
  const removed=new Set(missing.map(s=>s.entryId));
  const remaining=p.sources.filter(s=>!removed.has(s.entryId));
  const before=OPENING_RECIPE_CLAIMS.filter(k=>p.sources.some(s=>s.kind==='annal'&&s.entryId===k.entryId));
  const after=before.filter(k=>!removed.has(k.entryId));
  if(!remaining.some(s=>s.kind==='record'))return null;
  const titles=claims=>claims.map(k=>k.title).join(' and ');
  const editorialLine=claims=>titles(claims)+(claims.length===2?' are both':' is')+' in the Annals.';
  const openingLine=claims=>OPENING_RECIPE_LINE.replace('Kingston Windfall and Daq in Black',titles(claims));
  const line=p.text.includes(editorialLine(before))?editorialLine:openingLine;
  const from=line(before);
  if(!p.text.includes(from))return null;
  const text=after.length?p.text.replace(from,line(after)):p.text.replace(from+' ','');
  return {...p,text,sources:remaining};
}
// Call only after the ordinary publisher has verified the records' signatures.
// Independently authenticate a new photo-only correction before adopting its digest.
function annalsHistoryPhotoCorrectionProof_(entry,receipt){
  const key=annalsProps_().getProperty('ANNALS_PUBLISH_SIGNING_KEY')||'';
  const proof=annalsPublicApproval_(entry,receipt,key);
  return proof&&AnnalsProduction.serial(proof)===AnnalsProduction.serial(receipt);
}
function annalsPredictHistorySubtraction_(value, entries, receipts, now) {
  if (value.schemaVersion !== 2) return value;
  const support = archivedSupport(entries,receipts);
  const rebindPhoto=typeof AnnalsHistoryNarrative!=='undefined'&&AnnalsHistoryNarrative.rebindPhotoOnlyCorrection;
  let changed = false;
  const chapters = value.chapters.map(chapter => {
    const passages = chapter.passages.flatMap(original => {
      let p=original;
      const current=support.get(original.sources[0]?.entryId);
      if(current&&rebindPhoto){
        const rebound=rebindPhoto(original,current.entry,current.receipt,
          entry=>annalsHash_(AnnalsProduction.serial(entry)));
        if(rebound!==original&&annalsHistoryPhotoCorrectionProof_(current.entry,current.receipt)){
          p=rebound;
          changed=true;
        }
      }
      const stale=p.sources.filter(s=>s.kind==='annal'&&support.get(s.entryId)?.digest!==s.digest);
      if (stale.length) {
        changed = true;
        p=subtractOpeningRecipe(chapter,p,stale);
        if(!p)return [];
      }
      let portraitChanged = false;
      const sources = p.sources.map(s => {
        if(s.kind !== 'annal' || !s.portrait || support.get(s.entryId)?.portrait === s.portrait) return s;
        changed = portraitChanged = true;
        return {...s,portrait:null};
      });
      return [portraitChanged ? {...p,sources} : p];
    });
    return passages.length === chapter.passages.length && passages.every((p,i) => p === chapter.passages[i])
      ? chapter : {...chapter,passages};
  }).filter(c => c.passages.length);
  return changed ? {...value,revision:value.revision+1,updatedAt:now.toISOString(),chapters} : value;
}

function annalsHistoryReadPublic_(url){
  var response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
  if(response.getResponseCode()!==200)throw new Error('History verification unavailable');
  var body=response.getContentText();
  if(typeof body!=='string'||body.length>250000)throw new Error('History verification exceeds bounds');
  return body;
}

function annalsHistorySubtractionProjection_(prior,live,archive){
  if(!prior||prior.schemaVersion!==2||live.schemaVersion!==2||
     !Number.isSafeInteger(live.revision)||live.revision<=prior.revision||
     !archive||!Array.isArray(archive.entries)||!Array.isArray(archive.approvals)||
     !Number.isFinite(Date.parse(live.updatedAt)))return null;
  var expected=annalsPredictHistorySubtraction_(prior,archive.entries,archive.approvals,new Date(live.updatedAt));
  if(expected===prior)return null;
  expected.revision=live.revision;
  return AnnalsProduction.serial(expected)===AnnalsProduction.serial(live)?expected:null;
}
function annalsHistoryVerifiedSubtraction_(prior,live,archive){
  var expected=annalsHistorySubtractionProjection_(prior,live,archive);
  if(!expected)return null;
  var digest=annalsHash_(AnnalsProduction.serial(expected));
  var main=JSON.parse(annalsHistoryReadPublic_('https://raw.githubusercontent.com/justinpfisher/Stammtisch/main/data/club-history.json'));
  if(digest!==annalsHash_(AnnalsProduction.serial(main))||
     annalsHash_(annalsHistoryReadPublic_('https://stammtischbrewery.com/history.html'))!==
       annalsHash_(AnnalsPublicDisplay.historyPage(expected)+'\n'))return null;
  return expected;
}
// Check the one-to-one archive shape before interpreting a missing source.
function annalsHistoryArchiveRows_(archive){
  if(!archive||archive.schemaVersion!==1||!Array.isArray(archive.entries)||!Array.isArray(archive.approvals)||
     Object.keys(archive).some(function(key){return !['schemaVersion','entries','approvals','retiredIds'].includes(key);})||
     archive.entries.length!==archive.approvals.length)return null;
  const isId=id=>typeof id==='string'&&/^[a-z0-9][a-z0-9-]{5,63}$/.test(id);
  const retired=archive.retiredIds===undefined?[]:archive.retiredIds;
  if(!Array.isArray(retired)||retired.length>5000||retired.some(id=>!isId(id)))return null;
  const retiredSet=new Set(retired), entries=new Map(), approvals=new Map();
  if(retiredSet.size!==retired.length)return null;
  for(const entry of archive.entries){
    if(!entry||!isId(entry.id)||entries.has(entry.id)||retiredSet.has(entry.id))return null;
    entries.set(entry.id,entry);
  }
  for(const receipt of archive.approvals){
    if(!receipt||!entries.has(receipt.entryId)||approvals.has(receipt.entryId))return null;
    approvals.set(receipt.entryId,receipt);
  }
  return {entries:entries,approvals:approvals,retired:retired};
}
function annalsHistoryArchiveApproval_(entry,receipt,key){
  const serial=AnnalsProduction.serial;
  if(!receipt||receipt.entryId!==entry.id||!Number.isFinite(Date.parse(receipt.approvedAt))||
     receipt.contentSha256!==annalsHash_(serial(entry)))return false;
  const reviewers={
    'standing-consent-text-v1':'standing-consent-automation-v1',
    'standing-consent-image-v1':'standing-consent-image-automation-v1',
    'standing-consent-photos-v2':'standing-consent-image-automation-v1',
    'standing-consent-quote-v1':'standing-consent-quote-automation-v1'
  };
  if(receipt.mode!==undefined&&!Object.prototype.hasOwnProperty.call(reviewers,receipt.mode))return false;
  try{
    if(serial(AnnalsProduction.publicEntry(entry))!==serial(entry))return false;
    AnnalsProduction.consents(entry,receipt.consents);
    if(receipt.mode!==undefined){
      const quote=receipt.mode==='standing-consent-quote-v1';
      const photo=entry.photos?'standing-consent-photos-v2':entry.photo?'standing-consent-image-v1':'standing-consent-text-v1';
      if(entry.credit!=='anonymous'||receipt.consents.quotePublication!==(entry.category==='quotation')||
         (quote?entry.category!=='quotation'||!entry.speakerPortrait||entry.photo||entry.photos:
           entry.speakerPortrait||receipt.mode!==photo||receipt.consents.namedAttribution!==!!entry.contributorPortrait))return false;
    }
    const proof=annalsPublicApproval_(entry,Object.assign({},receipt,{reviewedBy:reviewers[receipt.mode]}),key);
    return !!proof&&serial(proof)===serial(receipt);
  }catch(ignored){return false;}
}
function annalsHistoryWithdrawalReceipt_(entry,approval,key,updatedAt){
  if(!/^annal-[a-f0-9]{24}$/.test(entry.id))return false;
  const prefix=entry.id.slice(6), matches=annalsRoot_().searchFolders("trashed = false and title contains '"+prefix+"'");
  if(!matches.hasNext())return false;
  const folder=matches.next(), id=folder.getName();
  if(matches.hasNext()||!/^[a-f0-9]{64}$/.test(id)||!id.startsWith(prefix))return false;
  const checked=annalsPrivate_(folder), removal=annalsRead_(checked,'removal-private.json'),
    dispatch=annalsRead_(checked,'removal-dispatch-private.json');
  if(!removal||removal.state!=='dispatch_accepted'||!dispatch||dispatch.state!=='accepted')return false;
  const signedAt=Date.parse(removal.approvedAt), attemptedAt=Date.parse(dispatch.at),
    acceptedAt=Date.parse(dispatch.completedAt), publishedAt=Date.parse(updatedAt);
  if(!(Date.parse(approval.approvedAt)<=signedAt&&signedAt<=attemptedAt&&attemptedAt<=acceptedAt&&
       acceptedAt<=publishedAt&&publishedAt-signedAt<=86400000))return false;
  const serial=AnnalsProduction.serial, proof=annalsPublicRemoval_(entry,removal.approvedAt,key);
  return !!proof&&serial(removal.entry)===serial(entry)&&serial(removal.proof)===serial(proof);
}
function annalsHistoryAnnalsSources_(edition){
  return edition.chapters.flatMap(chapter=>chapter.passages.flatMap(passage=>passage.sources))
    .filter(source=>source.kind==='annal');
}
function annalsHistoryArchiveEdge_(previous,next,beforeArchive,afterArchive,key){
  const before=annalsHistoryArchiveRows_(beforeArchive), after=annalsHistoryArchiveRows_(afterArchive);
  if(!before||!after)return false;
  const serial=AnnalsProduction.serial, sources=new Map();
  for(const source of annalsHistoryAnnalsSources_(previous)){
    const entry=before.entries.get(source.entryId), receipt=before.approvals.get(source.entryId);
    if(!entry||receipt.contentSha256!==source.digest||
       source.portrait&&(receipt.consents?.namedAttribution!==true||entry.contributorPortrait!==source.portrait))return false;
    sources.set(source.entryId,source);
  }
  const changed=[...before.entries.keys()].filter(id=>serial(before.entries.get(id))!==serial(after.entries.get(id))||
    serial(before.approvals.get(id))!==serial(after.approvals.get(id)));
  if(changed.length!==1||!sources.has(changed[0]))return false;
  const affected=changed[0], priorEntry=before.entries.get(affected), priorApproval=before.approvals.get(affected),
    corrected=after.entries.get(affected), correctedApproval=after.approvals.get(affected);
  // This commit applies one event. Other Annals edits can appear between History
  // revisions, so compare the immediate commit parent rather than an older edition.
  const expectedEntries=beforeArchive.entries.flatMap(entry=>entry.id!==affected?[entry]:corrected?[corrected]:[]);
  const expectedApprovals=beforeArchive.approvals.flatMap(receipt=>receipt.entryId!==affected?[receipt]:
    corrected?[correctedApproval]:[]);
  const expectedRetired=corrected?before.retired:before.retired.concat(affected);
  if(serial(afterArchive.entries)!==serial(expectedEntries)||serial(afterArchive.approvals)!==serial(expectedApprovals)||
     serial(after.retired)!==serial(expectedRetired))return false;
  for(const id of sources.keys()){
    if(!annalsHistoryArchiveApproval_(before.entries.get(id),before.approvals.get(id),key))return false;
  }
  // All retained relevant rows other than the affected one are exact matches.
  if(corrected){
    const signedAt=Date.parse(correctedApproval.approvedAt), age=Date.parse(next.updatedAt)-signedAt;
    return correctedApproval.mode===undefined&&correctedApproval.contentSha256!==priorApproval.contentSha256&&
      signedAt>Date.parse(priorApproval.approvedAt)&&age>=-60000&&age<=86400000&&
      annalsHistoryArchiveApproval_(corrected,correctedApproval,key);
  }
  return annalsHistoryWithdrawalReceipt_(priorEntry,priorApproval,key,next.updatedAt);
}

function annalsHistoryArchiveContinues_(edition,priorArchive,nextArchive){
  const prior=annalsHistoryArchiveRows_(priorArchive), next=annalsHistoryArchiveRows_(nextArchive);
  if(!prior||!next||prior.retired.some((id,index)=>next.retired[index]!==id))return false;
  const serial=AnnalsProduction.serial;
  return annalsHistoryAnnalsSources_(edition).every(({entryId})=>
    serial(prior.entries.get(entryId))===serial(next.entries.get(entryId))&&
    serial(prior.approvals.get(entryId))===serial(next.approvals.get(entryId)));
}
function annalsHistorySubtractionChain_(prior,target,liveArchive){
  var steps=target.revision-prior.revision;
  // Restrict the public reads performed while holding the existing intake lock.
  if(!Number.isSafeInteger(steps)||steps<1||steps>12)return null;
  var commits=JSON.parse(annalsHistoryReadPublic_(
    'https://api.github.com/repos/justinpfisher/Stammtisch/commits?sha=main&path=data%2Fclub-history.json&per_page='+(steps+1)));
  if(!Array.isArray(commits)||commits.length!==steps+1||
    commits.some(function(c){return !c||!/^[a-f0-9]{40}$/.test(c.sha);})||
    new Set(commits.map(function(c){return c.sha;})).size!==commits.length)return null;
  var key=annalsProps_().getProperty('ANNALS_PUBLISH_SIGNING_KEY')||'';
  if(key.length<32||key===annalsProps_().getProperty('ANNALS_APPROVAL_KEY')||
     key===annalsProps_().getProperty('ANNALS_HISTORY_SIGNING_KEY'))return null;
  var base='https://raw.githubusercontent.com/justinpfisher/Stammtisch/', files=new Map();
  var read=function(c,path){
    var address=c.sha+'/data/'+path;
    if(!files.has(address))files.set(address,JSON.parse(annalsHistoryReadPublic_(base+address)));
    return files.get(address);
  };
  var serial=AnnalsProduction.serial, previous=read(commits[steps],'club-history.json');
  // A subtraction can erase the accepted bytes. Match the original on main
  // and replay each projection against the archive at its own immutable commit.
  if(serial(previous)!==serial(prior))return null;
  var chain=[previous], previousArchive=read(commits[steps],'annals-approved.json');
  for(var i=steps-1;i>=0;i--){
    var commit=commits[i], parents=commit.parents;
    if(!Array.isArray(parents)||parents.length!==1||!parents[0]||!/^[a-f0-9]{40}$/.test(parents[0].sha)||
       parents[0].sha===commit.sha)return null;
    var next=read(commit,'club-history.json'), archive=read(commit,'annals-approved.json'),
      parentArchive=read(parents[0],'annals-approved.json');
    if(next.revision!==previous.revision+1||serial(read(parents[0],'club-history.json'))!==serial(previous)||
      !annalsHistoryArchiveContinues_(previous,previousArchive,parentArchive)||
      !annalsHistoryArchiveEdge_(previous,next,parentArchive,archive,key)||
      !annalsHistorySubtractionProjection_(previous,next,archive)||
      i===0&&liveArchive&&!annalsHistoryArchiveContinues_(next,archive,liveArchive))return null;
    chain.push(next);
    previous=next;
    previousArchive=archive;
  }
  return serial(previous)===serial(target)?chain:null;
}
function annalsHistoryVerifiedOvertake_(pending,live){
  if(!pending.review.boundLedger||pending.document.schemaVersion!==2||live.schemaVersion!==2||
     annalsHash_(AnnalsProduction.serial(pending.document))!==pending.approval.contentSha256)return null;
  var archive=annalsOpeningArchive_();
  var chain=annalsHistorySubtractionChain_(pending.document,live,archive);
  if(!chain||!annalsHistoryVerifiedSubtraction_(chain[chain.length-2],live,archive))return null;
  return chain;
}
function annalsHistorySubtractionCheckpoint_(prior,target,chapters){
  var chain=annalsHistorySubtractionChain_(prior,target);
  return !!chain&&chain.slice(1).some(function(doc){return AnnalsProduction.serial(doc.chapters)===chapters;});
}
function annalsRebaseHistoryAfterAnnals_(archive,live){
  var root=annalsRoot_(),pending=annalsRead_(root,'history-pending-private.json');
  if(pending&&pending.state!=='verified_live')return false;
  var current=annalsRead_(root,'history-published-private.json');
  var ledger=annalsRead_(root,'history-bound-ledger-private.json');
  if(!current||!ledger||ledger.schemaVersion!==1||!/^[a-f0-9]{64}$/.test(ledger.privateOpeningPacketSha256))return false;
  var projected=annalsHistoryVerifiedSubtraction_(current,live,archive);
  if(!projected)return false;
  var serial=AnnalsProduction.serial, savedChapters=serial(ledger.chapters);
  if(savedChapters===serial(current.chapters)){
    annalsSavePrivate_(root,'history-bound-ledger-private.json',Object.assign({},ledger,{chapters:projected.chapters}));
  }else{
    // The final signed History journal still records the ledger metadata.
    // Match an interrupted projection against the same public release chain.
    var checkpoint=pending&&pending.review&&pending.review.boundLedger;
    if(!checkpoint||serial(ledger)!==serial(Object.assign({},checkpoint,{chapters:ledger.chapters})))return false;
    var atTarget=savedChapters===serial(projected.chapters);
    if((!atTarget||projected.revision>current.revision+1)&&
      !annalsHistorySubtractionCheckpoint_(current,projected,savedChapters))return false;
    if(!atTarget)annalsSavePrivate_(root,'history-bound-ledger-private.json',Object.assign({},ledger,{chapters:projected.chapters}));
  }
  annalsSavePrivate_(root,'history-published-private.json',projected);
  annalsRememberHistoryContextProof_(root,projected);
  return true;
}

// This optional witness can be recorded only after the existing main and Pages checks.
function annalsRememberHistoryContextProof_(root,edition){
  try {
    annalsSavePrivate_(root,'history-context-live-private.json',{
      revision:edition.revision,digest:annalsHash_(AnnalsProduction.serial(edition)),verifiedAt:new Date().toISOString()
    });
  } catch(ignored) { /* Ordinary reconciliation does not depend on the optional witness. */ }
}

// Bound History maintenance is independent of an Annals intake item. In
// particular, the approved opening includes owner recollections with no item.
function annalsBoundMaintenanceState_(sync){
  var root=annalsRoot_(),current=annalsRead_(root,'history-published-private.json');
  var ledger=annalsRead_(root,'history-bound-ledger-private.json'),pending=annalsRead_(root,'history-pending-private.json');
  if(!current||current.schemaVersion!==2||!ledger||ledger.schemaVersion!==1||
    !/^[a-f0-9]{64}$/.test(ledger.privateOpeningPacketSha256))
    throw new Error('Verify the current source-bound Club History first');
  if(pending&&pending.state!=='verified_live')throw new Error('Reconcile the prior History revision before editing');
  if(sync){
    var live=JSON.parse(annalsHistoryReadPublic_('https://stammtischbrewery.com/data/club-history.json'));
    if(AnnalsProduction.serial(live)!==AnnalsProduction.serial(current)){
      if(live.schemaVersion!==2||live.revision<=current.revision||
        !annalsRebaseHistoryAfterAnnals_(annalsOpeningArchive_(),live))throw new Error('Current live History is not yet reconciled');
      return annalsBoundMaintenanceState_(false);
    }
  }
  if(AnnalsProduction.serial(ledger.chapters)!==AnnalsProduction.serial(current.chapters))
    throw new Error('Verify the current source-bound Club History first');
  return {root:root,current:current,ledger:ledger,digest:annalsHash_(AnnalsProduction.serial(current))};
}
function annalsListHistoryMaintenance(nonce){
  return annalsUiCall_(nonce,function(){return annalsLocked_(function(){
    var state=annalsBoundMaintenanceState_(true);
    return {revision:state.current.revision,digest:state.digest,
      chapters:state.current.chapters.map(function(c){return {id:c.id,heading:c.heading,passages:c.passages.map(function(p){
        return {id:p.id,text:p.text};
      })};})};
  });});
}
function annalsHistoryMaintenanceProjection_(current,chapterId,passageId,operation,copy){
  if(!['correct','withdraw'].includes(operation))throw new Error('Select correction or withdrawal');
  var chapter=current.chapters.find(function(c){return c.id===chapterId;});
  var target=chapter&&chapter.passages.find(function(p){return p.id===passageId;});
  if(!target)throw new Error('Select an existing History passage');
  if(operation==='correct'){
    if(typeof copy!=='string'||!copy.trim()||copy.length>1500||copy.trim()===target.text||
      /[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|<[^>]+>/i.test(copy)||
      /\b(?:motherfucker|motherfucking|fucking|fucked|fucker|fuck|bullshit|shitty|shit|asshole|bastard|bitch|cunt|dickhead)\b/i.test(copy)||
      AnnalsAuto.sensitiveText(copy))throw new Error('A changed, safe, source-supported public passage is required');
  }
  var replacement=chapter.passages.flatMap(function(p){
    return p!==target?[p]:operation==='withdraw'?[]:[Object.assign({},p,{text:copy.trim()})];
  });
  return current.chapters.flatMap(function(c){return c!==chapter?[c]:replacement.length?[Object.assign({},c,{passages:replacement})]:[];});
}
function annalsPrepareHistoryMaintenance(nonce,expectedDigest,chapterId,passageId,operation,copy,privateEvidence,sourceId){
  return annalsUiCall_(nonce,function(){return annalsLocked_(function(){
    var state=annalsBoundMaintenanceState_();
    if(state.digest!==expectedDigest||typeof privateEvidence!=='string'||privateEvidence.trim().length<10||
      privateEvidence.length>1000)throw new Error('Reload current History and supply the private evidence or withdrawal reason');
    var narrative=null;
    if(operation==='compose'){
      if(typeof annalsHistoryNarrativeReview_!=='function')throw new Error('Composed History is unavailable');
      narrative=annalsHistoryNarrativeReview_(state,sourceId,chapterId,passageId);
    }
    var chapters=narrative?narrative.chapters:
      annalsHistoryMaintenanceProjection_(state.current,chapterId,passageId,operation,copy);
    var review={operation:'bound-owner-'+operation,chapterId:chapterId,passageId:passageId,
      replacement:operation==='correct'?copy.trim():null,reason:privateEvidence.trim(),
      expectedDigest:state.digest,expectedRevision:state.current.revision,chapters:chapters};
    if(narrative){review.sourceId=sourceId;review.bindingDigest=narrative.bindingDigest;}
    review.hash=annalsHash_(AnnalsProduction.serial(review));
    annalsSavePrivate_(state.root,'history-maintenance-review-private.json',review);
    return {hash:review.hash,chapters:chapters,claims:narrative?narrative.claims:null};
  });});
}
function annalsPublishHistoryMaintenance(nonce,expectedHash,confirmed){
  return annalsUiCall_(nonce,function(){return annalsLocked_(function(){
    var state=annalsBoundMaintenanceState_();
    var review=annalsRead_(state.root,'history-maintenance-review-private.json');
    if(confirmed!==true||!review||review.hash!==expectedHash||review.expectedDigest!==state.digest||
      review.expectedRevision!==state.current.revision)throw new Error('Review the exact change against the current History revision');
    var unsigned=Object.assign({},review);delete unsigned.hash;
    if(annalsHash_(AnnalsProduction.serial(unsigned))!==expectedHash)throw new Error('History maintenance review was altered');
    if(review.operation==='bound-owner-compose'){
      if(typeof annalsHistoryNarrativeReview_!=='function')throw new Error('Composed History is unavailable');
      var narrative=annalsHistoryNarrativeReview_(state,review.sourceId,review.chapterId,review.passageId);
      if(narrative.bindingDigest!==review.bindingDigest||
        AnnalsProduction.serial(narrative.chapters)!==AnnalsProduction.serial(review.chapters))
        throw new Error('Composed History or source permissions changed after review');
      return annalsDispatchHistoryRevision_(state.root,review.sourceId,Object.assign({},review,{
        boundLedger:Object.assign({},state.ledger,{chapters:narrative.chapters})
      }),2,narrative.chapters,2,state.current.revision);
    }
    var chapters=annalsHistoryMaintenanceProjection_(state.current,review.chapterId,review.passageId,
      review.operation.replace(/^bound-owner-/,''),review.replacement);
    if(AnnalsProduction.serial(chapters)!==AnnalsProduction.serial(review.chapters))throw new Error('History maintenance preview changed');
    var target=state.current.chapters.find(function(c){return c.id===review.chapterId;}).passages.find(function(p){return p.id===review.passageId;});
    var blocked=Object.assign({},state.ledger.ownerMaintainedSourceVersions||{});
    var boundLedger=Object.assign({},state.ledger,{chapters:chapters,ownerMaintainedSourceVersions:blocked});
    target.sources.forEach(function(src){if(src.kind==='annal')blocked[src.entryId+':'+src.digest]=true;});
    if(review.operation==='bound-owner-withdraw'){
      // A public Annals correction changes its digest, not the contribution withdrawn from History.
      var withdrawn=Object.assign({},state.ledger.ownerWithdrawnEntries||{});
      target.sources.forEach(function(src){if(src.kind==='annal')withdrawn[src.entryId]=true;});
      boundLedger.ownerWithdrawnEntries=withdrawn;
    }
    return annalsDispatchHistoryRevision_(state.root,null,Object.assign({},review,{
      boundLedger:boundLedger
    }),2,chapters,2,state.current.revision);
  });});
}

function annalsDispatchHistoryRevision_(folder,id,review,schemaVersion,chapters,expectedSchema,expectedRevision){
    var p=annalsProps_();
    if(p.getProperty('ANNALS_HISTORY_PUBLICATION_ENABLED')!=='true'||!Number.isFinite(Date.parse(p.getProperty('ANNALS_SIGNING_REMEDIATED_AT'))))throw new Error('History publication awaits signing remediation and hosted qualification');
    var key=p.getProperty('ANNALS_HISTORY_SIGNING_KEY')||'';
    if(key.length<32||key===p.getProperty('ANNALS_APPROVAL_KEY')||key===p.getProperty('ANNALS_PUBLISH_SIGNING_KEY'))throw new Error('Distinct history authority required');
    var root=annalsRoot_(),pending=annalsRead_(root,'history-pending-private.json');
    if(pending&&pending.state!=='verified_live')throw new Error('Prior history dispatch must be reconciled; never automatically retry');
    var current=annalsRead_(root,'history-published-private.json')||{schemaVersion:1,revision:0,chapters:[],updatedAt:''};
    if((expectedSchema!==null&&current.schemaVersion!==expectedSchema)||
      (expectedRevision!==null&&current.revision!==expectedRevision))throw new Error('History is not at the expected revision');
    // An exact public read protects against a stale private snapshot or concurrent update.
    var fetched=UrlFetchApp.fetch('https://stammtischbrewery.com/data/club-history.json',{muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
    if(fetched.getResponseCode()!==200||annalsHash_(AnnalsProduction.serial(JSON.parse(fetched.getContentText())))!==annalsHash_(AnnalsProduction.serial(current)))throw new Error('Published history reconciliation required');
    var document={schemaVersion:schemaVersion,revision:current.revision+1,chapters:chapters,updatedAt:new Date().toISOString()};
    var proof={mode:'source-grounded-history-revision-v1',previousDigest:annalsHash_(AnnalsProduction.serial(current)),
      contentSha256:annalsHash_(AnnalsProduction.serial(document)),issuedAt:document.updatedAt};
    proof.signature=annalsHex_(Utilities.computeHmacSha256Signature(AnnalsProduction.serial({document:document,approval:proof}),key,Utilities.Charset.UTF_8));
    if(AnnalsProduction.serial({document:document,approval:proof}).length>45000)throw new Error('History update exceeds bounded publication size');
    if(review.boundLedger)review=Object.assign({},review,{
      previousLedgerSha256:annalsHash_(AnnalsProduction.serial(annalsRead_(root,'history-bound-ledger-private.json')||null))
    });
    var record={sourceId:id,review:review,document:document,approval:proof,state:'reserved_no_retry'};
    annalsWriteOnce_(root,'history-revision-'+document.revision+'-private.json',record);
    annalsSavePrivate_(root,'history-pending-private.json',record);
    var accepted=annalsDispatchEvent_(folder,'annals-history-revision',{document:document,approval:proof},'history-dispatch-'+document.revision+'-private.json');
    annalsSavePrivate_(root,'history-pending-private.json',Object.assign({},record,{
      state:accepted?'dispatch_accepted':'uncertain_or_rejected_no_retry'
    }));
    return {dispatchAccepted:accepted,published:false};
}

function annalsHistoryBoundWriteReady_(root,pending,chain,ledger,verified){
    var current=annalsRead_(root,'history-published-private.json')||{schemaVersion:1,revision:0,chapters:[],updatedAt:''};
    var serial=AnnalsProduction.serial, currentDigest=annalsHash_(serial(current)),
      isPrevious=currentDigest===pending.approval.previousDigest, nextLedger=pending.review.boundLedger;
    var reserved=annalsRead_(root,'history-revision-'+pending.document.revision+'-private.json');
    if(!reserved||reserved.state!=='reserved_no_retry'||serial(reserved.approval)!==serial(pending.approval)||
      serial(reserved.document)!==serial(pending.document)||serial(reserved.review)!==serial(pending.review)||
      reserved.sourceId!==pending.sourceId)return false;
    var previousLedgerSha256=pending.review.previousLedgerSha256;
    var previousAligned=isPrevious&&(previousLedgerSha256===undefined||annalsHash_(serial(ledger||null))===previousLedgerSha256)&&
      (!ledger&&current.schemaVersion===1&&current.revision===0||
      ledger&&ledger.schemaVersion===1&&ledger.privateOpeningPacketSha256===nextLedger.privateOpeningPacketSha256&&
      serial(ledger.chapters)===serial(current.chapters));
    if(!verified)return previousAligned;

    // A partial write can stop on any proved edition. The ledger is written
    // first and must retain the exact journal metadata at or ahead of the snapshot.
    var snapshot=isPrevious?pending.document.revision-1:
      chain.find(function(doc){return serial(doc)===serial(current);})?.revision;
    if(!Number.isSafeInteger(snapshot))return false;
    var saved=serial(ledger);
    if(!previousAligned&&!chain.some(function(doc){
      return doc.revision>=snapshot&&saved===serial(Object.assign({},nextLedger,{chapters:doc.chapters}));
    }))return false;
    var main=JSON.parse(annalsHistoryReadPublic_('https://raw.githubusercontent.com/justinpfisher/Stammtisch/main/data/club-history.json'));
    return serial(main)===serial(chain[chain.length-1]);
}

function annalsReconcileHistoryLocked_(){
    var root=annalsRoot_(),pending=annalsRead_(root,'history-pending-private.json');
    if(!pending||pending.state!=='dispatch_accepted')return {verified:false,retryAllowed:false};
    var response=UrlFetchApp.fetch('https://stammtischbrewery.com/data/club-history.json',{muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
    var html=UrlFetchApp.fetch('https://stammtischbrewery.com/history.html',{muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
    if(response.getResponseCode()!==200||html.getResponseCode()!==200)return {verified:false,retryAllowed:false};
    var published=JSON.parse(response.getContentText());
    var exact=annalsHash_(AnnalsProduction.serial(published))===pending.approval.contentSha256&&
      annalsHash_(html.getContentText())===annalsHash_(AnnalsPublicDisplay.historyPage(pending.document)+'\n');
    var chain=exact?[pending.document]:annalsHistoryVerifiedOvertake_(pending,published);
    if(!chain)return {verified:false,retryAllowed:false};
    var name='history-live-'+pending.document.revision+'-private.json',existing=annalsRead_(root,name);
    if(existing){
      if(existing.digest!==pending.approval.contentSha256||!Number.isFinite(Date.parse(existing.verifiedAt)))throw new Error('Conflicting history verification evidence');
    }
    var ledger=null,nextLedger=null;
    if(pending.review.boundLedger){
      ledger=annalsRead_(root,'history-bound-ledger-private.json');
      nextLedger=Object.assign({},pending.review.boundLedger,{chapters:published.chapters});
      if(!annalsHistoryBoundWriteReady_(root,pending,chain,ledger,existing))
        throw new Error('Conflicting History ledger or snapshot');
    }
    if(!existing){
      var verified={verifiedAt:new Date().toISOString(),digest:pending.approval.contentSha256};
      if(!exact){verified.confirmedOnMain=true;verified.supersededByRevision=published.revision;}
      annalsWriteOnce_(root,name,verified);
    }
    if(nextLedger){
      if(AnnalsProduction.serial(ledger)!==AnnalsProduction.serial(nextLedger))
        annalsSavePrivate_(root,'history-bound-ledger-private.json',nextLedger);
    }
    else annalsSavePrivate_(root,'history-ledger-private.json',pending.review.ledger);
    annalsSavePrivate_(root,'history-published-private.json',published);
    // Preserve the accepted dispatch; never replay to recover a receipt.
    annalsSavePrivate_(root,'history-pending-private.json',Object.assign({},pending,{state:'verified_live',
      verifiedRevision:published.revision,verificationKind:exact?'exact_site':'proven_signed_subtraction_successor'}));
    if(!exact)annalsRememberHistoryContextProof_(root,published);
    return {verified:true,revision:published.revision,superseded:!exact};
}
function annalsReconcileHistory(nonce){
  return annalsUiCall_(nonce,function(){return annalsLocked_(annalsReconcileHistoryLocked_);});
}

/** Owner-only, non-publishing proof check. No properties, Drive records, gates,
 * credentials or histories are changed. ZIP commitment is bound to GitHub's
 * artifact digest before parsing; keys and raw HMACs never leave this runtime. */
function annalsCheckGithubSigningConsistency(nonce,challenge,artifactId,zipBase64,diagnostic){
  return annalsCheckGithubSigningConsistencyFor_(nonce,challenge,artifactId,zipBase64,false,diagnostic);
}

/** Same bounded proof for the distinct Club History authority. */
function annalsCheckGithubHistorySigningConsistency(nonce,challenge,artifactId,zipBase64,diagnostic){
  return annalsCheckGithubSigningConsistencyFor_(nonce,challenge,artifactId,zipBase64,true,diagnostic);
}

function annalsCheckGithubSigningConsistencyFor_(nonce,challenge,artifactId,zipBase64,history,diagnostic){
  return annalsUiCall_(nonce,function(){
    var config=history?{
      artifactPrefix:'history-signing-consistency',
      workflow:'.github/workflows/annals-history-signing-consistency.yml',
      workflowHash:'329481ebec13381aac81b9e633810bc461c222ce1da41fff7ee91fe738923f58',
      keyProperty:'ANNALS_HISTORY_SIGNING_KEY',
      steps:['Compute non-publishing History key commitment','Retain bounded History challenge receipt']
    }:{
      artifactPrefix:'signing-consistency',
      workflow:'.github/workflows/annals-signing-consistency.yml',
      workflowHash:'07568cb8f9eb3cf845c4aa6e1efa401faaeaf1bb5feccb61de0b75ebe002ce47',
      keyProperty:'ANNALS_PUBLISH_SIGNING_KEY',
      steps:['Compute non-publishing key commitment','Retain bounded challenge receipt']
    };
    // An optional server-local collector reports only fixed stages and HTTP codes.
    // It cannot alter validation, credentials, network destinations or return values.
    function stage(name){if(diagnostic)diagnostic.stage=name;}
    if(diagnostic){diagnostic.stage='input';diagnostic.http={};}
    if(!/^[a-f0-9]{64}$/.test(challenge)||!/^\d{1,20}$/.test(artifactId)||typeof zipBase64!=='string'||zipBase64.length>90000||! /^[A-Za-z0-9+/]+={0,2}$/.test(zipBase64))throw new Error('Invalid bounded challenge input');
    var api='https://api.github.com/repos/justinpfisher/Stammtisch';
    function get(url){
      var label=url.indexOf('/actions/artifacts/')>=0?'artifact':url.indexOf('/jobs?')>=0?'jobs':url.indexOf('/actions/runs/')>=0?'run':url.indexOf('/.github/workflows/')>=0?'workflow_source':'verifier_source';
      stage(label+'_http');
      var requestHeaders={Accept:'application/vnd.github+json'};
      // Reuse the existing repository credential only for this repository's API.
      // Raw source reads stay unauthenticated; redirects never carry credentials.
      if(url.indexOf(api+'/')===0){
        var token=annalsProps_().getProperty('ANNALS_GITHUB_TOKEN');
        if(!token)throw new Error('Existing repository verification credential required');
        requestHeaders.Authorization='Bearer '+token;
        requestHeaders['X-GitHub-Api-Version']='2022-11-28';
      }
      var response=UrlFetchApp.fetch(url,{method:'get',muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true,headers:requestHeaders}),code=response.getResponseCode();
      if(diagnostic)diagnostic.http[label]=Number.isInteger(code)&&code>=100&&code<=599?code:null;
      if(code!==200){
        // Fixed classifications only: never expose response bodies or arbitrary headers.
        if(diagnostic){
          var headers=response.getAllHeaders(),remaining=null;
          Object.keys(headers).forEach(function(name){if(name.toLowerCase()==='x-ratelimit-remaining'&&/^\d{1,6}$/.test(String(headers[name])))remaining=Number(headers[name]);});
          diagnostic.failure=remaining===0?'github_rate_limit':'unclassified_http';
          diagnostic.rateLimitRemaining=remaining;
        }
        throw new Error('Public verification evidence unavailable');
      }
      stage(label+'_body');var text=response.getContentText();if(text.length>200000)throw new Error('Verification evidence exceeds bound');return text;
    }
    var artifact=JSON.parse(get(api+'/actions/artifacts/'+artifactId)),bytes=Utilities.base64Decode(zipBase64);
    stage('artifact_validation');
    if(bytes.length>65536||String(artifact.id)!==artifactId||artifact.expired!==false||artifact.size_in_bytes!==bytes.length||artifact.digest!=='sha256:'+annalsHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes)))throw new Error('Artifact byte identity failed');
    var identity=new RegExp('^'+config.artifactPrefix+'-(\\d{1,20})-(\\d{1,5})$').exec(artifact.name||'');
    if(!identity||!artifact.workflow_run||String(artifact.workflow_run.id)!==identity[1]||! /^[a-f0-9]{40}$/.test(artifact.workflow_run.head_sha||''))throw new Error('Invalid artifact producer');
    var runId=identity[1],attempt=identity[2],headSha=artifact.workflow_run.head_sha;
    var run=JSON.parse(get(api+'/actions/runs/'+runId+'/attempts/'+attempt));
    stage('run_validation');
    if(!Number.isFinite(Date.parse(run.run_started_at))||!Number.isFinite(Date.parse(run.updated_at))||String(run.id)!==runId||String(run.run_attempt)!==attempt||run.event!=='workflow_dispatch'||[config.workflow,config.workflow+'@main'].indexOf(run.path)<0||run.head_branch!=='main'||run.head_sha!==headSha||!run.repository||run.repository.full_name!=='justinpfisher/Stammtisch'||run.status!=='completed'||run.conclusion!=='success')throw new Error('Hosted run identity failed');
    var jobs=JSON.parse(get(api+'/actions/runs/'+runId+'/attempts/'+attempt+'/jobs?per_page=100'));
    stage('jobs_validation');
    if(jobs.total_count!==1||!Array.isArray(jobs.jobs)||jobs.jobs.length!==1)throw new Error('Unexpected challenge jobs');
    var job=jobs.jobs[0];
    if(String(job.run_id)!==runId||String(job.run_attempt)!==attempt||job.head_sha!==headSha||job.name!=='challenge'||job.status!=='completed'||job.conclusion!=='success'||!Number.isFinite(Date.parse(job.started_at))||!Number.isFinite(Date.parse(job.completed_at)))throw new Error('Incomplete challenge job');
    config.steps.forEach(function(name){var steps=(job.steps||[]).filter(function(step){return step.name===name;});if(steps.length!==1||steps[0].status!=='completed'||steps[0].conclusion!=='success')throw new Error('Incomplete challenge step');});
    var raw='https://raw.githubusercontent.com/justinpfisher/Stammtisch/'+headSha+'/';
    if(annalsHash_(get(raw+config.workflow).replace(/\r\n/g,'\n'))!==config.workflowHash||annalsHash_(get(raw+'scripts/annals/signing-consistency.mjs').replace(/\r\n/g,'\n'))!=='9f79b645a4b3d18a4427db32428fe19768329d5c47685c0c01d8754253769a6b')throw new Error('Unreviewed challenge implementation');
    stage('archive_parse');var files=Utilities.unzip(Utilities.newBlob(bytes,'application/zip'));
    if(files.length!==1||files[0].getName()!=='signing-consistency.json'||files[0].getBytes().length>4096)throw new Error('Unexpected receipt archive');
    stage('receipt_validation');var proof=JSON.parse(files[0].getDataAsString('UTF-8'));
    if(Object.keys(proof).sort().join(',')!=='attempt,challenge,commitment,createdAt,headSha,kind,repository,runId'||proof.kind!=='annals-key-consistency-v1'||proof.repository!=='justinpfisher/Stammtisch'||proof.challenge!==challenge||!/^\d{1,20}$/.test(proof.runId)||!/^\d{1,5}$/.test(proof.attempt)||! /^[a-f0-9]{40}$/.test(proof.headSha)||! /^[a-f0-9]{64}$/.test(proof.commitment)||!Number.isFinite(Date.parse(proof.createdAt)))throw new Error('Invalid challenge receipt');
    stage('freshness');var now=Date.now(),created=Date.parse(proof.createdAt);
    if(created<Date.parse(job.started_at)||created>Date.parse(job.completed_at)||created>now||now-created>15*60*1000||Date.parse(run.run_started_at)>created||Date.parse(run.updated_at)<created||artifact.name!==config.artifactPrefix+'-'+proof.runId+'-'+proof.attempt||!artifact.workflow_run||String(artifact.workflow_run.id)!==proof.runId||artifact.workflow_run.head_sha!==proof.headSha)throw new Error('Stale or unrelated artifact');
    stage('key_configuration');var p=annalsProps_(),key=p.getProperty(config.keyProperty)||'',privateKeys=[p.getProperty('ANNALS_APPROVAL_KEY')||''];
    if(history)privateKeys.push(p.getProperty('ANNALS_PUBLISH_SIGNING_KEY')||'');
    if(key.length<32||privateKeys.some(function(value){return value.length<32||key===value;}))throw new Error('Independent signing configuration required');
    var message='ANNALS NON-PUBLISHING KEY CONSISTENCY V1\n'+JSON.stringify([proof.repository,proof.challenge,proof.runId,proof.attempt,proof.headSha,proof.createdAt]);
    var mac=annalsHex_(Utilities.computeHmacSha256Signature(message,key,Utilities.Charset.UTF_8));
    var expected=annalsHash_(mac),difference=0;for(var i=0;i<64;i++)difference|=expected.charCodeAt(i)^proof.commitment.charCodeAt(i);
    stage('complete');var result={publishesAnything:false,changesCredentials:false,changesReleaseGates:false,separateKeys:true,githubSecretConsistencyVerified:difference===0,verifiedAt:new Date().toISOString(),workflowRunId:proof.runId,workflowRunAttempt:proof.attempt,implementationCommit:proof.headSha};
    if(history)result.signingAuthority='history';return result;
  });
}

/** Records independently checked security evidence, never hosted acceptance.
 * This initial-remediation path deliberately requires the current archive empty
 * and every publication capability closed. Historical missing receipts stay missing. */
function annalsRecordSigningQualification(nonce,id,challenge,artifactId,zipBase64,reconciliationConfirmed){
  return annalsUiCall_(nonce,function(){
    if(reconciliationConfirmed!==true)throw new Error('Actual outstanding-record reconciliation must be confirmed');
    var cross=annalsCheckGithubSigningConsistency(nonce,challenge,artifactId,zipBase64),rotation=annalsCheckSigningRotation(nonce,id);
    if(!cross.githubSecretConsistencyVerified||!rotation.separateKeys||!rotation.oldPublicSignatureRejected||!rotation.oldPrivateSignatureRejected||!rotation.newPrivateSignatureValid)throw new Error('Genuine current signing qualification required');
    return annalsLocked_(function(){
      var p=annalsProps_(),root=annalsRoot_();
      ['ANNALS_AUTO_PUBLICATION_ENABLED','ANNALS_AUTO_MEDIA_ENABLED','ANNALS_HISTORY_PUBLICATION_ENABLED','ANNALS_RULES_V2_ENABLED','ANNALS_RULES_V3_ENABLED'].forEach(function(k){if(p.getProperty(k)==='true')throw new Error('Publication must remain closed during initial qualification');});
      ['col-release-pending-private.json','history-pending-private.json'].forEach(function(name){var pending=annalsRead_(root,name);if(pending&&['verified_live','verified_cancelled'].indexOf(pending.state)<0)throw new Error('Pending operation requires reconciliation');});
      function read(url){var response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true,headers:{'Cache-Control':'no-cache'}});if(response.getResponseCode()!==200)throw new Error('Current public archive unavailable');var text=response.getContentText();if(!text||text.length>1000000)throw new Error('Bounded public evidence required');return text;}
      var suffix='?signing-observation='+Date.now(),committed=read('https://raw.githubusercontent.com/justinpfisher/Stammtisch/main/data/annals-approved.json'+suffix),live=read('https://stammtischbrewery.com/data/annals-approved.json'+suffix),archive=JSON.parse(live),page=read('https://stammtischbrewery.com/annals.html'+suffix);
      if(committed!==live||archive.schemaVersion!==1||!Array.isArray(archive.entries)||!Array.isArray(archive.approvals)||archive.entries.length||archive.approvals.length||page.indexOf('The Annals of Stammtisch')<0||page.indexOf('</html>')<0||/<article\b[^>]*\bid=/.test(page))throw new Error('Initial empty-archive reconciliation failed');
      var name='signing-qualification-'+cross.workflowRunId+'-'+cross.workflowRunAttempt+'-private.json';
      if(annalsFile_(root,name)||p.getProperty('ANNALS_SIGNING_REMEDIATED_AT'))throw new Error('Prior security qualification preserved; no overwrite');
      var at=new Date().toISOString(),record={schemaVersion:1,state:'verified_signing_only',verifiedAt:at,crossPlatform:cross,challengeArtifactId:artifactId,challengeArchiveSha256:annalsHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,Utilities.base64Decode(zipBase64))),historicalEvidence:{sourceId:id,approvalDigest:annalsHash_(AnnalsProduction.serial(annalsRead_(annalsFolder_(id),'approval-private.json')))},reconciliationMethod:'owner-authenticated-operator-confirmed-existing-journals-and-current-empty-hosted-archive',oldPrivateSignatureRejected:true,oldPublicSignatureRejected:true,newPrivateSignatureValid:true,separateKeys:true,outstandingDispatchReconciliationConfirmed:true,historicalWithdrawalReceiptGapPreserved:true,archiveSha256:annalsHash_(live),pageSha256:annalsHash_(page),publicationActivated:false};
      annalsWriteOnce_(root,name,record);
      p.setProperty('ANNALS_SIGNING_QUALIFICATION_RECORD',name);
      p.setProperty('ANNALS_SIGNING_REMEDIATED_AT',at);
      return {securityQualificationRecorded:true,verifiedAt:at,githubSecretConsistencyVerified:true,historicalWithdrawalReceiptGapPreserved:true,publicationActivated:false};
    });
  });
}

/** Owner-only observation of recorder preconditions. No writes, dispatches,
 * credentials, exception text, source identifiers or fetched bodies are returned.
 * Storage creation permissions are deliberately NOT tested by this read-only path. */
function annalsDiagnoseSigningQualification(nonce,id,challenge,artifactId,zipBase64){
  return annalsUiCall_(nonce,function(){
    var result={readOnly:true,publicationActivated:false,writePermissionTested:false,
      crossCheck:'unavailable',rotationCheck:'unavailable',lock:'unavailable',privateRoot:'unavailable',
      gates:{},pending:{},priorMarkerPresent:null,priorPointerPresent:null,priorRecordPresent:null,
      historicalEvidencePresent:null,historicalEvidenceDigestComputable:null,http:{},
      archiveBytesEqual:false,archiveShapeValid:false,archiveEmpty:false,pageRecognized:false,pageEmpty:false};
    var cross=null,crossEvidence={stage:'unavailable',http:{}};result.crossEvidence=crossEvidence;
    try{cross=annalsCheckGithubSigningConsistency(nonce,challenge,artifactId,zipBase64,crossEvidence);
      result.crossCheck=cross.githubSecretConsistencyVerified===true?'verified':'mismatch';
    }catch(held){/* Safe stage only; exceptions can contain private service details. */}
    try{var rotation=annalsCheckSigningRotation(nonce,id);
      result.rotation={separateKeys:rotation.separateKeys===true,oldPrivateSignatureRejected:rotation.oldPrivateSignatureRejected===true,
        oldPublicSignatureRejected:rotation.oldPublicSignatureRejected===true,newPrivateSignatureValid:rotation.newPrivateSignatureValid===true};
      result.rotationCheck=Object.keys(result.rotation).every(function(k){return result.rotation[k];})?'verified':'mismatch';
    }catch(held){}
    try{annalsLocked_(function(){
      result.lock='acquired';
      var p;try{p=annalsProps_();
        ['ANNALS_AUTO_PUBLICATION_ENABLED','ANNALS_AUTO_MEDIA_ENABLED','ANNALS_HISTORY_PUBLICATION_ENABLED','ANNALS_RULES_V2_ENABLED','ANNALS_RULES_V3_ENABLED'].forEach(function(k){result.gates[k]=p.getProperty(k)!=='true';});
        result.priorMarkerPresent=!!p.getProperty('ANNALS_SIGNING_REMEDIATED_AT');
        result.priorPointerPresent=!!p.getProperty('ANNALS_SIGNING_QUALIFICATION_RECORD');
      }catch(held){result.properties='unavailable';}
      var root;try{root=annalsRoot_();result.privateRoot='verified_owner_only';}catch(held){return;}
      [['col','col-release-pending-private.json'],['history','history-pending-private.json']].forEach(function(pair){
        try{var pending=annalsRead_(root,pair[1]);result.pending[pair[0]]=!pending?'absent':['verified_live','verified_cancelled'].indexOf(pending.state)>=0?'terminal':'unresolved';}
        catch(held){result.pending[pair[0]]='unavailable';}
      });
      if(cross&&/^\d{1,20}$/.test(cross.workflowRunId||'')&&/^\d{1,5}$/.test(cross.workflowRunAttempt||'')){
        try{result.priorRecordPresent=!!annalsFile_(root,'signing-qualification-'+cross.workflowRunId+'-'+cross.workflowRunAttempt+'-private.json');}catch(held){}
      }
      try{var saved=annalsRead_(annalsFolder_(id),'approval-private.json');
        result.historicalEvidencePresent=!!(saved&&saved.entry&&saved.receipt&&saved.publication);
        if(result.historicalEvidencePresent)result.historicalEvidenceDigestComputable=typeof annalsHash_(AnnalsProduction.serial(saved))==='string';
      }catch(held){}
    });}catch(held){if(result.lock!=='acquired')result.lock='unavailable';}
    function read(label,url){
      var status={status:'unavailable',httpStatus:null,redirect:false,bounded:false};result.http[label]=status;
      try{var response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true,headers:{'Cache-Control':'no-cache'}}),code=response.getResponseCode();
        status.httpStatus=Number.isInteger(code)&&code>=100&&code<=599?code:null;status.redirect=code>=300&&code<400;
        if(code!==200){status.status=status.redirect?'redirect':'http_error';return null;}
        var text=response.getContentText();status.bounded=typeof text==='string'&&text.length>0&&text.length<=1000000;
        if(!status.bounded){status.status='invalid_size';return null;}status.status='ok';return text;
      }catch(held){return null;}
    }
    var suffix='?signing-observation='+Date.now();
    var committed=read('committedArchive','https://raw.githubusercontent.com/justinpfisher/Stammtisch/main/data/annals-approved.json'+suffix);
    var live=read('liveArchive','https://stammtischbrewery.com/data/annals-approved.json'+suffix);
    var page=read('livePage','https://stammtischbrewery.com/annals.html'+suffix);
    result.archiveBytesEqual=committed!==null&&live!==null&&committed===live;
    if(live!==null){try{var archive=JSON.parse(live);result.archiveShapeValid=!!(archive&&archive.schemaVersion===1&&Array.isArray(archive.entries)&&Array.isArray(archive.approvals));
      result.archiveEmpty=result.archiveShapeValid&&archive.entries.length===0&&archive.approvals.length===0;}catch(held){}}
    if(page!==null){result.pageRecognized=page.indexOf('The Annals of Stammtisch')>=0&&page.indexOf('</html>')>=0;result.pageEmpty=result.pageRecognized&&!/<article\b[^>]*\bid=/.test(page);}
    return result;
  });
}
