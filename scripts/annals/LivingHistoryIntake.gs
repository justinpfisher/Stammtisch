/* Private, deterministic living History evidence gate; no mailbox or model calls here. */
var AnnalsLivingHistory=(function(){
  'use strict';
  var titles={fish:'Justin',marc:'Marc',matt:'Matt',ken:'Ken',jamie:'Jamie',jerome:'Jerome'};
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
  function fromEntry(p,entryId){
    return /^(?:claim-[a-f0-9]{24}|narrative-[a-f0-9]{24}-[1-9][0-9]*)$/.test(p.id)&&p.sources.length===1&&
      p.sources[0].kind==='annal'&&p.sources[0].entryId===entryId;
  }
  function creditLead(name,frame,reworded){
    if(reworded)return 'As '+(name||'one member')+' remembers it, ';
    if(frame==='club_record')return 'For the Club’s record, '+(name||'one member')+' recalls: ';
    if(frame==='tradition')return 'The tradition, as '+(name||'one member')+' remembers it: ';
    return (name||'A member')+' recalls: ';
  }
  function removeRevokedCredit(current,chapters,entryId,portrait){
    for(var chapter of chapters){
      var changed=false;
      var passages=chapter.passages.map(function(p){
        if(!fromEntry(p,entryId)||!p.sources[0].portrait||p.sources[0].portrait===portrait)return p;
        var source=p.sources[0],text=p.text;
        if(Object.prototype.hasOwnProperty.call(titles,source.portrait)){
          for(var frame of [['recollection',false],['club_record',false],['tradition',false],['club_record',true]]){
            var lead=creditLead(titles[source.portrait],frame[0],frame[1]);
            if(!text.startsWith(lead))continue;
            text=creditLead(null,frame[0],frame[1])+text.slice(lead.length);
            break;
          }
        }
        changed=true;
        return Object.assign({},p,{text:text,sources:[Object.assign({},source,{portrait:null})]});
      });
      if(changed)return Object.assign({},current,{chapters:current.chapters.map(function(c){
        return c===chapter?Object.assign({},c,{passages:passages}):c;
      })});
    }
    return current;
  }

  function supportedClaims(claims,source,entry){
    var original=source.source;
    if(typeof original.subject!=='string'||typeof original.excerpt!=='string'||
      /^\s*fwd?:/i.test(original.subject)||example.test(original.subject+'\n'+original.excerpt))return false;
    var own={subject:original.subject,excerpt:original.excerpt.split(
      /^[ \t]*(?:>|(?:from|sent|subject|to|cc|bcc)[ \t]*:|(?:-+[ \t]*)?(?:forwarded|original) message\b)/im,1)[0]};
    var screened=AnnalsAuto.safeSource(original.subject,original.excerpt,false);
    return screened.valid&&claims.every(function(c){
      return typeof c.span==='string'&&c.span.length>=18&&c.span.trim()===c.span&&
        !/["“”«»<>\r\n]/.test(c.span)&&!AnnalsAuto.sensitiveText(c.span)&&AnnalsAuto.censor(c.span)===c.span&&
        containsSpan(own[c.field],c.span)&&containsSpan(screened[c.field],c.span)&&
        [entry.title,entry.summary].some(function(t){return containsSpan(t,c.span);});
    });
  }
  return Object.freeze({fromEntry:fromEntry,removeRevokedCredit:removeRevokedCredit,supportedClaims:supportedClaims});
})();

function annalsHistoryIntakeReady_(){
  if(typeof AnnalsHistoryNarrative==='undefined'||
      annalsProps_().getProperty('ANNALS_HISTORY_PUBLICATION_ENABLED')!=='true')return false;
  var root=annalsRoot_(), current=annalsRead_(root,'history-published-private.json'),
    ledger=annalsRead_(root,'history-bound-ledger-private.json');
  return !!current&&current.schemaVersion===2&&Number.isSafeInteger(current.revision)&&current.revision>=1&&
    !!ledger&&ledger.schemaVersion===1&&/^[a-f0-9]{64}$/.test(ledger.privateOpeningPacketSha256)&&
    AnnalsProduction.serial(current.chapters)===AnnalsProduction.serial(ledger.chapters);
}

// This prepares the exact source-bound proof for the existing owner review.
// The model supplies suggestions, never factual corroboration or permission.
function annalsHistoryNarrativeReview_(state,id,chapterId,afterId){
  if(typeof AnnalsHistoryNarrative==='undefined'||typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))
    throw new Error('A staged narrative item is required');
  var f=annalsFolder_(id),source=annalsRead_(f,'source-private.json'),draft=annalsRead_(f,'draft-private.json');
  var proposed=draft&&draft.historyNarrative;
  if(!source||source.sourceId!==id||!proposed||proposed.chapter!==chapterId||
    annalsFile_(f,'quarantine-private.json')||annalsFile_(f,'removal-private.json')||
    !annalsOrdinaryPublicationAllowed_(source)||!Array.isArray(draft.riskFlags)||draft.riskFlags.length||
    !['anecdote','recipe','description','other'].includes(draft.interpretation&&draft.interpretation.intent))
    throw new Error('The composed proposal lacks eligible current evidence');
  annalsOrdinarySourceGate_(source);
  var chapter=state.current.chapters.find(function(c){return c.id===chapterId;});
  var after=chapter?chapter.passages.findIndex(function(p){return p.id===afterId;}):-1;
  var entryId='annal-'+id.slice(0,24);
  if((state.ledger.ownerWithdrawnEntries||{})[entryId]===true)
    throw new Error('This contribution was withdrawn from Club History');
  if(after<0||state.current.chapters.some(function(c){
    return c.passages.some(function(p){return AnnalsLivingHistory.fromEntry(p,entryId);});
  }))throw new Error('Select an exact insertion point for an unused narrative source');

  var original=annalsRead_(f,'approval-private.json');
  var saved=annalsRead_(f,'correction-approval-private.json')||original;
  var blocked=state.ledger.ownerMaintainedSourceVersions||{};
  var digest=saved&&saved.receipt&&saved.receipt.contentSha256;
  if(!saved||saved.publicationState!=='dispatch_accepted'||!saved.entry||!saved.receipt||!saved.publication||
    saved.entry.id!==entryId||saved.receipt.entryId!==entryId||
    blocked[entryId+':'+digest]===true||
    original&&original.receipt&&blocked[entryId+':'+original.receipt.contentSha256]===true||
    !annalsPrivateReceiptValid_(saved.entry,saved.receipt)||
    !AnnalsLivingHistory.supportedClaims(proposed.claims,source,saved.entry))
    throw new Error('Composed History must match exact used and signed Annals evidence');

  var archive=annalsOpeningArchive_();
  var entry=archive.entries.find(function(e){return e.id===entryId;});
  var approval=archive.approvals.find(function(r){return r.entryId===entryId;});
  var serial=AnnalsProduction.serial, hash=function(value){return annalsHash_(serial(value));};
  if(!entry||!approval||!approval.consents||approval.consents.publication!==true||
    approval.contentSha256!==digest||hash(entry)!==digest||
    serial(approval)!==serial(saved.publication)||serial(approval.consents)!==serial(saved.receipt.consents))
    throw new Error('The signed public Annals version changed');
  var portrait=annalsContributorPortrait_(source);
  var portraitAllowed=!!portrait&&portrait===entry.contributorPortrait&&approval.consents.namedAttribution===true;
  var publicSource={kind:'annal',entryId:entryId,digest:digest,label:'Supporting Annals entry',
    portrait:portraitAllowed?portrait:null};
  // The signed chapter has no annotation for existing observations.
  if(proposed.paragraphs.some(function(clauses){
    return clauses.some(function(clause){return clause.kind==='observation';});
  }))throw new Error('A History insertion cannot add an observation to the existing chapter');
  var claimIds=new Set(proposed.paragraphs.flatMap(function(clauses){
    return clauses.flatMap(function(clause){return clause.claims;});
  }));
  if(proposed.claims.some(function(c){return !claimIds.has(c.id);}))
    throw new Error('All proposed evidence, including competing accounts, must be accounted for');
  var claims=proposed.claims.map(function(c){
    return {id:c.id,chapter:chapterId,status:'eligible',order:c.order,dispute:c.dispute,variant:c.variant,
      uncertain:c.uncertain||/\b(?:may|might|possibly|probably|uncertain|around|roughly|approximately|not sure)\b/i.test(c.span),
      poignant:c.poignant,span:c.span,publicSource:publicSource,portraitAllowed:portraitAllowed};
  });
  var evidence={aliases:['Justin','Fish','Marc','Matt','Ken','Jamie','Jerome'],claims:claims};
  var proposal={mode:'revision',chapter:chapterId,
    sections:[{id:chapterId,heading:chapter.heading,paragraphs:proposed.paragraphs}]};
  var reviewedDigest=AnnalsHistoryNarrative.narrativeReviewDigest(state.current,proposal,evidence,hash);
  // A deterministic preview hash is not authority. Existing owner confirmation
  // checks the exact preview and rederives this entire binding before signing.
  var staged=AnnalsHistoryNarrative.stageHistoryNarrative({current:state.current,proposal:proposal,
    evidence:evidence,reviewedDigest:reviewedDigest},hash);
  if(staged.status!=='staged')throw new Error('The candidate does not meet the composed History contract');
  var composed=staged.chapters.find(function(c){return c.id===chapterId;}).passages;
  if(composed.some(function(p){return AnnalsAuto.sensitiveText(p.text);})||
     chapter.passages.length+composed.length>150)throw new Error('Unsafe or oversized History proposal');
  var prefix='narrative-'+hash({id:id,proposal:proposal,digest:digest}).slice(0,24)+'-';
  var passages=chapter.passages.slice();
  passages.splice.apply(passages,[after+1,0].concat(composed.map(function(p,i){
    return Object.assign({},p,{id:prefix+(i+1)});
  })));
  var chapters=state.current.chapters.map(function(c){
    return c===chapter?Object.assign({},c,{passages:passages}):c;
  });
  var consents=annalsConsentRegistry_().members[source.source.sender.toLowerCase()];
  return {chapters:chapters,claims:claims,bindingDigest:hash({reviewedDigest:reviewedDigest,after:afterId,
    source:source,assessedDraft:draft,approvedReceipt:saved.receipt,publicProof:approval,
    consents:consents,ledger:state.ledger})};
}

function annalsHistoryIntakeFolder_(folder,id,state){
  if(!state.history||state.dispatched||annalsFile_(folder,'quarantine-private.json')||
    annalsFile_(folder,'removal-private.json'))return false;
  var current=state.history.current, entryId='annal-'+id.slice(0,24);
  var active=current.chapters.filter(function(c){return c.passages.some(function(p){return AnnalsLivingHistory.fromEntry(p,entryId);});});
  if(!active.length)return false;
  var source=annalsRead_(folder,'source-private.json');
  if(!source||source.sourceId!==id)return false;
  var projected=current;
  if(annalsOrdinaryPublicationAllowed_(source)){
    annalsOrdinarySourceGate_(source);
    projected=AnnalsLivingHistory.removeRevokedCredit(current,active,entryId,annalsContributorPortrait_(source));
  }else{
    var chapter=active[0];
    var remaining=chapter.passages.filter(function(p){return !AnnalsLivingHistory.fromEntry(p,entryId);});
    projected=Object.assign({},current,{chapters:current.chapters.flatMap(function(c){
      return c!==chapter?[c]:remaining.length?[Object.assign({},c,{passages:remaining})]:[];
    })});
  }
  if(projected===current)return false;
  state.dispatched=true;
  var review={operation:'standing-consent-history-revocation',
    boundLedger:Object.assign({},state.history.ledger,{chapters:projected.chapters})};
  return annalsDispatchHistoryRevision_(folder,id,review,2,projected.chapters,2,current.revision).dispatchAccepted===true;
}

function annalsHistoryTickReconcile_(state){
  state.history=null;
  if(annalsProps_().getProperty('ANNALS_HISTORY_PUBLICATION_ENABLED')!=='true'||
    typeof annalsReconcileHistoryLocked_!=='function')return;
  var root=annalsRoot_(),pending=annalsRead_(root,'history-pending-private.json');
  if(pending&&pending.state!=='verified_live'){
    if(pending.state!=='dispatch_accepted'||!pending.review||!pending.review.boundLedger)return;
    if(annalsReconcileHistoryLocked_().verified!==true)return;
  }
  // An Annals correction or withdrawal may have already subtracted support
  // from public History. Recover an interrupted write before choosing work.
  state.history=annalsBoundMaintenanceState_(true);
}
