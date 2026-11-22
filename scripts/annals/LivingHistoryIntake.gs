/* Private, deterministic living History evidence gate; no mailbox or model calls here. */
var AnnalsLivingHistory=(function(){
  'use strict';
  var headings={origins:'Origins',gatherings:'Gathering together',assemblies:'Annual Assemblies',traditions:'Developing traditions'};
  var titles={fish:'Justin',marc:'Marc',matt:'Matt',ken:'Ken',jamie:'Jamie',jerome:'Jerome'};
  var slug=/^[a-z][a-z0-9-]{2,79}$/, digest=/^[a-f0-9]{64}$/, annal=/^annal-[a-f0-9]{24}$/;
  var example=/\b(?:hypothetical|fiction(?:al)?|suppose|imagine|for example|if only|pretend|made-up|test fixture|staged example|(?:sample|example) submission|simulated)\b/i;
  function containsSpan(text, span){
    if(typeof text!=='string'||!span)return false;
    for(var at=text.indexOf(span);at>=0;at=text.indexOf(span,at+1)){
      var before=text.slice(0,at), after=text.slice(at+span.length);
      if((!before.trim()||/[.!?]\s+$|\r?\n[ \t]*$/.test(before))&&
        (!after.trim()||/^[ \t]*[\r\n]/.test(after)||/[.!?]$/.test(span)&&/^\s/.test(after)))return true;
    }
    return false;
  }
  function eligible(value, source, unsafe){
    if(!source||source.senderAuthenticated!==true||source.aiConsentActive!==true||source.autoConsentAtReceipt!==true||
       source.syntheticFixture===true||!source.source||source.source.sourceTruncated||
       source.source.subjectTruncated||source.source.excerptTruncated||
       !Array.isArray(value)||value.length>4) return [];
    var fields=source.source, seen=new Set();
    if(typeof fields.subject!=='string'||typeof fields.excerpt!=='string'||
      /^\s*fwd?:/i.test(fields.subject)||example.test(fields.subject+'\n'+fields.excerpt))return [];
    // A plain-text forward may lose its headers in the screened Annals copy.
    // Consider only the author's portion of the immutable body for History.
    var authored={subject:fields.subject,excerpt:fields.excerpt.split(
      /^[ \t]*(?:>|(?:from|sent|subject|to|cc|bcc)[ \t]*:|(?:-+[ \t]*)?(?:forwarded|original) message\b)/im,1)[0]};
    return value.filter(function(c){
      if(!c||!['chapter,field,kind,period,span,topic','chapter,editorialFrame,field,kind,period,span,topic'].includes(Object.keys(c).sort().join(','))||
         !Object.prototype.hasOwnProperty.call(headings,c.chapter)||typeof c.topic!=='string'||!slug.test(c.topic)||
         ['subject','excerpt'].indexOf(c.field)<0||c.kind!=='recollection'||
         typeof c.span!=='string'||c.span.length<18||c.span.length>600||c.span.trim()!==c.span||
         typeof c.period!=='string'||c.period.length>60||
         (c.period&&c.span.indexOf(c.period)<0)||/["“”«»<>\r\n]/.test(c.span)||
         unsafe(c.span)||!containsSpan(authored[c.field],c.span)) return false;
      var identity=c.chapter+'\0'+c.span;
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
  function fromEntry(p,entryId){
    return /^claim-[a-f0-9]{24}$/.test(p.id)&&p.sources.length===1&&
      p.sources[0].kind==='annal'&&p.sources[0].entryId===entryId;
  }
  // Retain other accounts in their existing order. Put a new account directly
  // after those on the same topic, without merging their claims or attribution.
  function project(current, affectedChapter, entryId, records, topics){
    if(!current||current.schemaVersion!==2||!annal.test(entryId)||
       !Object.prototype.hasOwnProperty.call(headings,affectedChapter)||!Array.isArray(records)||
       records.some(function(r){return r.chapter!==affectedChapter||r.sourceEntryId!==entryId;}))
      throw new Error('Invalid bound History delta');
    var prior=current.chapters.find(function(c){return c.id===affectedChapter;});
    var original=prior?prior.passages:[];
    // Only remove claims created by this automatic route. Signed opening and
    // editorial passages are handled by the signed subtraction/review path.
    var stable=original.filter(function(p){return !fromEntry(p,entryId);});
    var delta=records.map(function(r){return r.passage;});
    var ids=new Set();
    if(stable.concat(delta).some(function(p){if(ids.has(p.id))return true;ids.add(p.id);return false;}))
      throw new Error('Repeated claim identity');
    var before=original.filter(function(p){return stable.indexOf(p)<0;});
    if(AnnalsProduction.serial(before)===AnnalsProduction.serial(delta)&&
      records.every(function(r){return topics[r.passage.id]===r.topic;}))return current;
    var replacement=stable.slice(), placed=Object.assign({},topics);
    records.forEach(function(r){
      var at=replacement.length;
      for(var i=at-1;i>=0;i--)if(placed[replacement[i].id]===r.topic){at=i+1;break;}
      replacement.splice(at,0,r.passage);
      placed[r.passage.id]=r.topic;
    });
    if(replacement.length>150)return current;
    if(!prior&&!replacement.length)return current;
    var chapters=prior?current.chapters.map(function(c){
      return c!==prior?c:replacement.length?Object.assign({},c,{passages:replacement}):null;
    }).filter(Boolean):current.chapters.concat([{id:affectedChapter,heading:headings[affectedChapter],passages:replacement}]);
    return Object.assign({},current,{chapters:chapters});
  }
  return Object.freeze({containsSpan:containsSpan,eligible:eligible,fromEntry:fromEntry,passage:passage,project:project});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=AnnalsLivingHistory;

/* Living Club History: called only inside the existing authenticated intake lock.
 * It reuses the consented assessment, approves no Annals entry and sends no mail. */
function annalsHistoryIntakeReady_(){
  if(typeof AnnalsLivingHistory==='undefined'||
      annalsProps_().getProperty('ANNALS_HISTORY_PUBLICATION_ENABLED')!=='true')return false;
  var root=annalsRoot_(), current=annalsRead_(root,'history-published-private.json'),
    ledger=annalsRead_(root,'history-bound-ledger-private.json');
  return !!current&&current.schemaVersion===2&&Number.isSafeInteger(current.revision)&&current.revision>=1&&
    !!ledger&&ledger.schemaVersion===1&&/^[a-f0-9]{64}$/.test(ledger.privateOpeningPacketSha256)&&
    AnnalsProduction.serial(current.chapters)===AnnalsProduction.serial(ledger.chapters);
}
function annalsHistoryIntakeRecords_(folder, entryId, draft, source, state){
  var original=annalsRead_(folder,'approval-private.json');
  var saved=annalsRead_(folder,'correction-approval-private.json')||original;
  if(!saved||saved.publicationState!=='dispatch_accepted'||!saved.entry||!saved.receipt||!saved.publication||
    saved.entry.id!==entryId||saved.receipt.entryId!==entryId||
    !annalsPrivateReceiptValid_(saved.entry,saved.receipt))return null;
  var digest=saved.receipt.contentSha256;
  var ownerMaintained=state.history.ledger.ownerMaintainedSourceVersions||{};
  if(ownerMaintained[entryId+':'+digest]===true||
    (original&&original.receipt&&ownerMaintained[entryId+':'+original.receipt.contentSha256]===true))return null;

  // The exact source may already be eligible for Annals, but that alone is not
  // authority to disclose previously unpublished correspondence through History.
  var screened=AnnalsAuto.safeSource(source.source.subject,source.source.excerpt,false);
  if(!screened.valid)return null;
  var candidates=AnnalsLivingHistory.eligible(draft.historyCandidates,source,AnnalsAuto.sensitiveText).filter(function(c){
    return AnnalsAuto.censor(c.span)===c.span&&AnnalsLivingHistory.containsSpan(screened[c.field],c.span)&&
      [saved.entry.title,saved.entry.summary].some(function(t){return AnnalsLivingHistory.containsSpan(t,c.span);});
  });
  if(!candidates.length)return null;
  var archive=state.archive||(state.archive=annalsOpeningArchive_());
  var entry=archive.entries.find(function(e){return e.id===entryId;});
  var approval=archive.approvals.find(function(a){return a.entryId===entryId;});
  if(!entry||!approval||!approval.consents||approval.consents.publication!==true||
    approval.contentSha256!==digest||annalsHash_(AnnalsProduction.serial(entry))!==digest||
    AnnalsProduction.serial(approval)!==AnnalsProduction.serial(saved.publication)||
    AnnalsProduction.serial(approval.consents)!==AnnalsProduction.serial(saved.receipt.consents))return null;
  var portrait=annalsContributorPortrait_(source);
  portrait=portrait&&entry.contributorPortrait===portrait&&approval.consents.namedAttribution===true?portrait:null;
  return candidates.map(function(c){
    var claimId=annalsHash_(AnnalsProduction.serial({entryId:entryId,chapter:c.chapter,span:c.span}));
    return AnnalsLivingHistory.passage(c,{entryId:entryId,digest:digest,claimId:claimId,publication:true,portrait:portrait});
  });
}
function annalsHistoryIntakeFolder_(folder,id,state){
  if(!state.history||state.dispatched||annalsFile_(folder,'quarantine-private.json')||
    annalsFile_(folder,'removal-private.json'))return false;
  var current=state.history.current, ledger=state.history.ledger, entryId='annal-'+id.slice(0,24);
  var active=current.chapters.filter(function(c){return c.passages.some(function(p){return AnnalsLivingHistory.fromEntry(p,entryId);});});
  var draft=annalsRead_(folder,'draft-private.json');
  if(!active.length&&(!draft||!Array.isArray(draft.historyCandidates)||!draft.historyCandidates.length))return false;
  var source=annalsRead_(folder,'source-private.json');
  if(!source||source.sourceId!==id)return false;
  var records=[];
  if(annalsOrdinaryPublicationAllowed_(source)){
    annalsOrdinarySourceGate_(source);
    if(!draft||!Array.isArray(draft.riskFlags)||draft.riskFlags.length||
      !['anecdote','recipe','description','other'].includes(draft.interpretation&&draft.interpretation.intent))return false;
    records=annalsHistoryIntakeRecords_(folder,entryId,draft,source,state);
    if(!records)return false;
  }
  var affected=new Set(active.map(function(c){return c.id;}).concat(records.map(function(r){return r.chapter;})));
  var topics=ledger.claimTopics||{};
  for(var chapter of affected){
    var chapterRecords=records.filter(function(r){return r.chapter===chapter;});
    var projected=AnnalsLivingHistory.project(current,chapter,entryId,chapterRecords,topics);
    if(projected===current)continue;
    var nextTopics={}, used=Object.assign({},topics);
    chapterRecords.forEach(function(r){used[r.passage.id]=r.topic;});
    projected.chapters.forEach(function(c){c.passages.forEach(function(p){
      if(Object.prototype.hasOwnProperty.call(used,p.id))nextTopics[p.id]=used[p.id];
    });});
    state.dispatched=true; // one chapter and one signing attempt per intake tick
    var review={operation:'standing-consent-history-intake',
      boundLedger:Object.assign({},ledger,{chapters:projected.chapters,claimTopics:nextTopics})};
    return annalsDispatchHistoryRevision_(folder,id,review,2,projected.chapters,2,current.revision).dispatchAccepted===true;
  }
  return false;
}

function annalsHistoryTickReconcile_(state){
  state.history=null;
  if(!annalsHistoryIntakeReady_()||typeof annalsReconcileHistoryLocked_!=='function')return;
  var root=annalsRoot_(),pending=annalsRead_(root,'history-pending-private.json');
  if(pending&&pending.state!=='verified_live'){
    if(pending.state!=='dispatch_accepted')return;
    if(annalsReconcileHistoryLocked_().verified!==true)return;
  }
  // An Annals correction or withdrawal may have already subtracted support
  // from public History. Reconcile independent of any eligible draft or folder.
  var snapshot=annalsBoundMaintenanceState_(false), current=snapshot.current;
  var live=JSON.parse(annalsHistoryReadPublic_('https://stammtischbrewery.com/data/club-history.json'));
  if(annalsHash_(AnnalsProduction.serial(live))===annalsHash_(AnnalsProduction.serial(current))){
    state.history=snapshot;
  }else if(live.schemaVersion===2&&live.revision>current.revision){
    state.archive=annalsOpeningArchive_();
    if(annalsRebaseHistoryAfterAnnals_(state.archive,live))state.history=annalsBoundMaintenanceState_(false);
  }
}
