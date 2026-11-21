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
      if(!c||Object.keys(c).sort().join(',')!=='chapter,field,kind,period,span,topic'||
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
  function passage(c, bound, candidateWording){
    if(!c||!bound||!annal.test(bound.entryId)||!digest.test(bound.digest)||
      !digest.test(bound.claimId)||bound.publication!==true||
      !(bound.portrait===null||Object.prototype.hasOwnProperty.call(titles,bound.portrait)))
      throw new Error('Version-matched public and private History binding required');
    var name=bound.portrait?titles[bound.portrait]:null;
    var span=/[.!?]$/.test(c.span)?c.span:c.span+'.';
    // Generated prose may choose any approved attribution frame, but cannot add,
    // translate or remove a factual clause without separate source evidence.
    var choices=[(name?name+' recalls: ':'A member recalls: ')+span,
      (name?'In '+name+'’s recollection: ':'In one member’s recollection: ')+span];
    var text=choices.indexOf(candidateWording)>=0?candidateWording:choices[0];
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
  if(!annalsHistoryIntakeReady_()||state.dispatched||annalsFile_(folder,'quarantine-private.json')||
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

function annalsHistoryTickReconcile_(){
  if(!annalsHistoryIntakeReady_()||typeof annalsReconcileHistoryLocked_!=='function')return;
  var root=annalsRoot_(),pending=annalsRead_(root,'history-pending-private.json');
  if(!pending||pending.state!=='dispatch_accepted'||pending.review.operation!=='standing-consent-history-intake')return;
  var result=annalsReconcileHistoryLocked_();
  if(result.verified===true&&pending.sourceId)annalsSavePrivate_(annalsFolder_(pending.sourceId),
    'history-intake-seen-private.json',{contentSha256:pending.review.boundLedger.lastBoundEntryDigest,
      state:'verified_live',revision:result.revision});
}
