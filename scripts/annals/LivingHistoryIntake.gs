/* Private, deterministic living History evidence gate; no mailbox or model calls here. */
var AnnalsLivingHistory=(function(){
  'use strict';
  var headings={origins:'Origins',gatherings:'Gathering together',assemblies:'Annual Assemblies',traditions:'Developing traditions'};
  var titles={fish:'Justin',marc:'Marc',matt:'Matt',ken:'Ken',jamie:'Jamie',jerome:'Jerome'};
  var slug=/^[a-z][a-z0-9-]{2,79}$/, digest=/^[a-f0-9]{64}$/, annal=/^annal-[a-f0-9]{24}$/;
  function eligible(value, source, unsafe){
    if(!source||source.senderAuthenticated!==true||source.aiConsentActive!==true||source.autoConsentAtReceipt!==true||
       !source.source||source.source.sourceTruncated||source.source.subjectTruncated||source.source.excerptTruncated||
       !Array.isArray(value)||value.length>4) return [];
    var fields=source.source, seen=new Set();
    return value.filter(function(c){
      if(!c||!['chapter,field,kind,period,span,topic','chapter,editorialFrame,field,kind,period,span,topic'].includes(Object.keys(c).sort().join(','))||
         !Object.prototype.hasOwnProperty.call(headings,c.chapter)||!slug.test(c.topic)||
         ['subject','excerpt'].indexOf(c.field)<0||c.kind!=='recollection'||
         typeof c.span!=='string'||c.span.length<18||c.span.length>600||c.span.trim()!==c.span||
         typeof c.period!=='string'||c.period.length>60||
         (c.period&&c.span.indexOf(c.period)<0)||/["“”«»<>\r\n]/.test(c.span)||
         /\b(?:hypothetical|fiction(?:al)?|invented|suppose|imagine|for example|if only)\b/i.test(c.span)||
         unsafe(c.span)||String(fields[c.field]||'').indexOf(c.span)<0) return false;
      var identity=c.chapter+'\0'+c.field+'\0'+c.span;
      if(seen.has(identity))return false;
      seen.add(identity);return true;
    });
  }
  function passage(c, bound){
    if(!c||!bound||!annal.test(bound.entryId)||!digest.test(bound.digest)||
      !digest.test(bound.claimId)||bound.publication!==true||
      !(bound.portrait===null||Object.prototype.hasOwnProperty.call(titles,bound.portrait)))
      throw new Error('Version-matched public and private History binding required');
    var name=bound.portrait?titles[bound.portrait]:null;
    var span=/[.!?]$/.test(c.span)?c.span:c.span+'.';
    // The model edits the editorial footing, not the evidence. The attributed
    // excerpt stays literal so uncertainty, chronology and details cannot drift.
    var lead=name?name+' recalls: ':'A member recalls: ';
    if(c.editorialFrame==='club_record')lead=name?'For the Club’s record, '+name+' recalls: ':'For the Club’s record, one member recalls: ';
    if(c.editorialFrame==='tradition'&&c.chapter==='traditions')
      lead=name?'The tradition, as '+name+' remembers it: ':'The tradition, as one member remembers it: ';
    var recalled=/^I (?:remember|recall) that ([a-z].*)$/.exec(span);
    if(recalled&&c.editorialFrame==='club_record')
      lead=name?'As '+name+' remembers it, ':'As one member remembers it, ';
    var text=lead+(recalled&&c.editorialFrame==='club_record'?recalled[1]:span);
    return {topic:c.topic,chapter:c.chapter,sourceEntryId:bound.entryId,sourceVersion:bound.digest,
      passage:{id:'claim-'+bound.claimId.slice(0,24),text:text,sources:[
        {kind:'annal',entryId:bound.entryId,digest:bound.digest,label:'Read the original entry',portrait:bound.portrait}]}};
  }
  // Only this entry ID can be replaced or removed. An independently bound
  // contradictory account in the same chapter is intentionally not targeted.
  function project(current, affectedChapter, entryId, records){
    if(!current||current.schemaVersion!==2||!annal.test(entryId)||
       !Object.prototype.hasOwnProperty.call(headings,affectedChapter)||!Array.isArray(records)||
       records.some(function(r){return r.chapter!==affectedChapter||r.sourceEntryId!==entryId;}))
      throw new Error('Invalid bound History delta');
    var prior=current.chapters.find(function(c){return c.id===affectedChapter;});
    var original=prior?prior.passages:[];
    // Only remove claims created by this automatic route. Signed opening and
    // editorial passages are handled by the signed subtraction/review path.
    var stable=original.filter(function(p){return !(p.id.indexOf('claim-')===0&&p.sources.length===1&&p.sources[0].entryId===entryId);});
    var delta=records.map(function(r){return r.passage;});
    var ids=new Set();
    if(stable.concat(delta).some(function(p){if(ids.has(p.id))return true;ids.add(p.id);return false;}))
      throw new Error('Repeated claim identity');
    var before=original.filter(function(p){return stable.indexOf(p)<0;});
    if(JSON.stringify(before)===JSON.stringify(delta))return current;
    var replacement=stable.concat(delta);
    if(!prior&&!replacement.length)return current;
    var chapters=prior?current.chapters.map(function(c){
      return c!==prior?c:replacement.length?Object.assign({},c,{passages:replacement}):null;
    }).filter(Boolean):current.chapters.concat([{id:affectedChapter,heading:headings[affectedChapter],passages:replacement}]);
    return Object.assign({},current,{chapters:chapters});
  }
  return Object.freeze({eligible:eligible,passage:passage,project:project});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=AnnalsLivingHistory;

/* Living Club History: called only inside the existing authenticated intake lock.
 * It reuses the consented assessment, approves no Annals entry and sends no mail. */
function annalsHistoryIntakeReady_(){
  if(typeof AnnalsLivingHistory==='undefined'||
      annalsProps_().getProperty('ANNALS_HISTORY_PUBLICATION_ENABLED')!=='true')return false;
  var root=annalsRoot_(), current=annalsRead_(root,'history-published-private.json'),
    ledger=annalsRead_(root,'history-bound-ledger-private.json');
  return !!current&&current.schemaVersion===2&&current.revision>=1&&!!ledger&&
    ledger.schemaVersion===1&&!!ledger.privateOpeningPacketSha256;
}
function annalsHistoryIntakeFolder_(folder,id,state){
  if(!state.historySynced||state.dispatched||annalsFile_(folder,'quarantine-private.json')||
    annalsFile_(folder,'removal-private.json'))return false;
  var root=annalsRoot_(), pending=annalsRead_(root,'history-pending-private.json');
  if(pending&&pending.state!=='verified_live')return false;
  var draft=annalsRead_(folder,'draft-private.json');
  if(!draft||!Array.isArray(draft.historyCandidates)||!draft.historyCandidates.length||
    (draft.riskFlags||[]).length||['direct_quote','reported_speech'].includes(draft.interpretation&&draft.interpretation.intent))return false;
  var source=annalsRead_(folder,'source-private.json');
  if(!annalsOrdinaryPublicationAllowed_(source))return false;
  annalsOrdinarySourceGate_(source);
  var saved=annalsRead_(folder,'correction-approval-private.json')||annalsRead_(folder,'approval-private.json');
  if(!saved||saved.publicationState!=='dispatch_accepted'||!saved.entry||!saved.receipt||!saved.publication||
    saved.entry.id!=='annal-'+id.slice(0,24)||!annalsPrivateReceiptValid_(saved.entry,saved.receipt))return false;
  var item=annalsRead_(folder,'history-intake-seen-private.json')||{};
  if(item.contentSha256===saved.receipt.contentSha256)return false;
  // The exact source may already be eligible for Annals, but that alone is not
  // authority to disclose previously unpublished correspondence through History.
  var candidates=AnnalsLivingHistory.eligible(draft.historyCandidates,source,AnnalsAuto.sensitiveText).filter(function(c){
    return [saved.entry.title,saved.entry.summary].some(function(t){return typeof t==='string'&&t.indexOf(c.span)>=0;});
  });
  if(!candidates.length)return false;
  var archive=state.archive||(state.archive=annalsOpeningArchive_());
  var entry=archive.entries.find(function(e){return e.id===saved.entry.id;});
  var approval=archive.approvals.find(function(a){return a.entryId===saved.entry.id;});
  if(!entry||!approval||!approval.consents||approval.consents.publication!==true||
    approval.signature!==saved.publication.signature||
    annalsHash_(AnnalsProduction.serial(entry))!==saved.receipt.contentSha256)return false;
  var portrait=annalsContributorPortrait_(source);
  portrait=portrait&&entry.contributorPortrait===portrait&&approval.consents.namedAttribution===true?portrait:null;
  var current=annalsRead_(root,'history-published-private.json'), projected=current;
  var ledger=annalsRead_(root,'history-bound-ledger-private.json'),
    records=candidates.map(function(c){
      var claimId=annalsHash_(AnnalsProduction.serial({entryId:entry.id,topic:c.topic,chapter:c.chapter,field:c.field,span:c.span}));
      return AnnalsLivingHistory.passage(c,{entryId:entry.id,digest:saved.receipt.contentSha256,
        claimId:claimId,publication:true,portrait:portrait});
    });
  var affected=new Set(records.map(function(x){return x.chapter;}));
  current.chapters.forEach(function(c){if(c.passages.some(function(p){return p.id.indexOf('claim-')===0&&
    p.sources.length===1&&p.sources[0].entryId===entry.id;}))affected.add(c.id);});
  affected.forEach(function(chapter){projected=AnnalsLivingHistory.project(projected,chapter,entry.id,
    records.filter(function(r){return r.chapter===chapter;}));});
  if(projected===current){
    annalsSavePrivate_(folder,'history-intake-seen-private.json',{contentSha256:saved.receipt.contentSha256,state:'unchanged'});
    return false;
  }
  state.dispatched=true; // limit this intake tick to one History signing attempt
  var review={operation:'standing-consent-history-intake',
    boundLedger:Object.assign({},ledger,{chapters:projected.chapters,lastBoundEntryId:entry.id,lastBoundEntryDigest:saved.receipt.contentSha256})};
  var result=annalsDispatchHistoryRevision_(folder,id,review,2,projected.chapters,2,current.revision);
  return result.dispatchAccepted===true;
}

function annalsHistoryTickReconcile_(state){
  state.historySynced=false;
  if(!annalsHistoryIntakeReady_()||typeof annalsReconcileHistoryLocked_!=='function')return;
  var root=annalsRoot_(),pending=annalsRead_(root,'history-pending-private.json');
  if(pending&&pending.state!=='verified_live'){
    if(pending.state!=='dispatch_accepted'||((pending.review||{}).operation)!=='standing-consent-history-intake')return;
    var result=annalsReconcileHistoryLocked_();
    if(result.verified!==true)return;
    if(pending.sourceId)annalsSavePrivate_(annalsFolder_(pending.sourceId),
      'history-intake-seen-private.json',{contentSha256:pending.review.boundLedger.lastBoundEntryDigest,
        state:'verified_live',revision:result.revision});
  }
  // An Annals correction or withdrawal may have already subtracted support
  // from public History. Reconcile independent of any eligible draft or folder.
  var current=annalsRead_(root,'history-published-private.json');
  var live=JSON.parse(annalsHistoryReadPublic_('https://stammtischbrewery.com/data/club-history.json'));
  if(annalsHash_(AnnalsProduction.serial(live))===annalsHash_(AnnalsProduction.serial(current))){
    state.historySynced=true;
  }else if(live.schemaVersion===2&&live.revision>current.revision){
    state.archive=annalsOpeningArchive_();
    state.historySynced=annalsRebaseHistoryAfterAnnals_(state.archive,live);
  }
}

// Keep the exact public subtraction projection mechanically bound by tests.
// Rebasing cannot introduce a sentence, source, or portrait.
function archivedSupport(entries, receipts) {
  const records = new Map(receipts.map(r => [r.entryId,r]));
  return new Map(entries.map(e => {
    const receipt = records.get(e.id);
    return [e.id,{digest:receipt?.contentSha256,portrait:
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
  const useTitles=claims=>OPENING_RECIPE_LINE.replace('Kingston Windfall and Daq in Black',claims.map(k=>k.title).join(' and '));
  const from=useTitles(before);
  if(!p.text.includes(from)||!remaining.some(s=>s.kind==='record'))return null;
  const text=after.length?p.text.replace(from,useTitles(after)):p.text.replace(from+' ','');
  return {...p,text,sources:remaining};
}
// Call only after the ordinary publisher has verified the records' signatures.
// An Annals correction may remove support and credit, never invent a narrative.
function annalsPredictHistorySubtraction_(value, entries, receipts, now) {
  if (value.schemaVersion !== 2) return value;
  const support = archivedSupport(entries,receipts);
  let changed = false;
  const chapters = value.chapters.map(chapter => {
    const passages = chapter.passages.flatMap(original => {
      const stale=original.sources.filter(s=>s.kind==='annal'&&support.get(s.entryId)?.digest!==s.digest);
      let p=original;
      if (stale.length) {
        changed = true;
        p=subtractOpeningRecipe(chapter,original,stale);
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
function annalsRebaseHistoryAfterAnnals_(verifiedArchive, verifiedLive){
  if(!annalsHistoryIntakeReady_())return false;
  var root=annalsRoot_(),pending=annalsRead_(root,'history-pending-private.json');
  if(pending&&pending.state!=='verified_live')return false;
  var current=annalsRead_(root,'history-published-private.json');
  var live=verifiedLive||JSON.parse(annalsHistoryReadPublic_('https://stammtischbrewery.com/data/club-history.json'));
  if(live.schemaVersion!==2||!Number.isSafeInteger(live.revision)||live.revision<=current.revision||
     !Number.isFinite(Date.parse(live.updatedAt)))return false;
  var archive=verifiedArchive||annalsOpeningArchive_();
  var expected=annalsPredictHistorySubtraction_(current,archive.entries,archive.approvals,new Date(live.updatedAt));
  if(expected===current)return false;
  expected.revision=live.revision;
  var serialize=AnnalsProduction.serial, expectedDigest=annalsHash_(serialize(expected));
  if(expectedDigest!==annalsHash_(serialize(live)))return false;
  var main=JSON.parse(annalsHistoryReadPublic_('https://raw.githubusercontent.com/justinpfisher/Stammtisch/main/data/club-history.json'));
  if(expectedDigest!==annalsHash_(serialize(main))||
    annalsHash_(annalsHistoryReadPublic_('https://stammtischbrewery.com/history.html'))!==
      annalsHash_(AnnalsPublicDisplay.historyPage(expected)+'\n'))return false;
  var ledger=annalsRead_(root,'history-bound-ledger-private.json');
  annalsSavePrivate_(root,'history-bound-ledger-private.json',Object.assign({},ledger,{chapters:expected.chapters}));
  annalsSavePrivate_(root,'history-published-private.json',expected);
  return true;
}
