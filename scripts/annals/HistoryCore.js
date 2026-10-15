/* Private, source-first history ledger. No model, network, credentials or I/O.
 * Claims are exact source passages. Editorial joins are fixed and never facts.
 * New factual keys require owner review; unattended processing only corroborates
 * an unchanged, already reconciled claim. Semantic similarity is not proof.
 */
var AnnalsHistory = (function () {
  'use strict';
  // Apps Script file evaluation order is not a dependency contract.
  function editorialPolicy() {
    var value = typeof AnnalsAuto !== 'undefined' ? AnnalsAuto :
      (typeof module !== 'undefined' && module.exports ? require('./AutoCore.js') : null);
    if (!value) throw new Error('Editorial policy unavailable');
    return value;
  }
  var CHAPTERS = {origins:'Origins',gatherings:'Gathering together',assemblies:'Annual Assemblies',traditions:'Developing traditions'};
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function empty() { return {schemaVersion:1, revision:0, claims:[], revisions:[]}; }
  function validateClaim(c) {
    if (!c || typeof c.id !== 'string' || !/^[a-f0-9]{64}$/.test(c.id) ||
        typeof c.sourceId !== 'string' || !/^[a-f0-9]{64}$/.test(c.sourceId) ||
        !Object.prototype.hasOwnProperty.call(CHAPTERS,c.chapter) ||
        typeof c.factKey !== 'string' || !/^[a-z][a-z0-9-]{2,79}$/.test(c.factKey) ||
        ['subject','excerpt'].indexOf(c.field) < 0 ||
        typeof c.statement !== 'string' || !c.statement.trim() || c.statement.length > 1200 ||
        typeof c.period !== 'string' || c.period.length > 80 ||
        (c.period && c.statement.indexOf(c.period) < 0) ||
        ['recollection','supported'].indexOf(c.status) < 0 ||
        typeof c.uncertainty !== 'string' || c.uncertainty.length > 160 ||
        typeof c.evidenceNote !== 'string' || c.evidenceNote.trim().length < 10 || c.evidenceNote.length > 1000 ||
        !Number.isSafeInteger(c.order) || c.order < 0 || c.order > 100000 ||
        typeof c.receivedAt !== 'string' || !Number.isFinite(Date.parse(c.receivedAt)) ||
        typeof c.active !== 'boolean') throw new Error('Invalid private history claim');
  }
  function claim(source, raw) {
    if (!source || source.senderAuthenticated !== true || source.aiConsentActive !== true ||
        source.autoConsentAtReceipt !== true || !source.source || !raw) throw new Error('Verified private source required');
    var s = source.source;
    var policy = editorialPolicy();
    if (s.sourceTruncated || s.subjectTruncated || s.excerptTruncated ||
        !/^[a-f0-9]{64}$/.test(raw.sourceId || '') ||
        !/^[a-f0-9]{64}$/.test(raw.id || '') || !Object.prototype.hasOwnProperty.call(CHAPTERS,raw.chapter) ||
        !/^[a-z][a-z0-9-]{2,79}$/.test(raw.factKey || '') ||
        ['subject','excerpt'].indexOf(raw.field) < 0 ||
        typeof raw.statement !== 'string' || !raw.statement.trim() || raw.statement.length > 1200 ||
        String(s[raw.field] || '').indexOf(raw.statement) < 0 ||
        !Number.isSafeInteger(raw.order) || raw.order < 0 || raw.order > 100000 ||
        typeof raw.period !== 'string' || raw.period.length > 80 ||
        (raw.period && raw.statement.indexOf(raw.period) < 0)) throw new Error('Claim must match complete original evidence');
    if (typeof raw.uncertainty !== 'string' || raw.uncertainty.length > 160 ||
        ['recollection','supported'].indexOf(raw.status) < 0 ||
        typeof raw.evidenceNote !== 'string' || raw.evidenceNote.trim().length < 10 || raw.evidenceNote.length > 1000)
      throw new Error('Private grounding and uncertainty assessment required');
    // No attribution, location or other protected field is de-identified by AI.
    if (policy.protectedRoute(s.subject,s.excerpt) !== 'annals' ||
        policy.sensitiveText(raw.statement) || /["“”«»]/.test(raw.statement) ||
        policy.sensitiveText(raw.uncertainty) || /\b(?:fictional|hypothetical|diagnostic|invented|test record)\b/i.test(raw.statement))
      throw new Error('Claim requires private reconciliation');
    var result = {id:raw.id,sourceId:raw.sourceId,field:raw.field,statement:raw.statement,
      factKey:raw.factKey,chapter:raw.chapter,period:raw.period,status:raw.status,
      uncertainty:raw.uncertainty,evidenceNote:raw.evidenceNote,order:raw.order,receivedAt:s.receivedAt,active:true};
    validateClaim(result);
    return result;
  }
  function validate(ledger) {
    if (!ledger || ledger.schemaVersion !== 1 || !Number.isSafeInteger(ledger.revision) || ledger.revision < 0 ||
        !Array.isArray(ledger.claims) || ledger.claims.length > 600 || !Array.isArray(ledger.revisions)) throw new Error('Invalid private history ledger');
    ledger.claims.forEach(validateClaim);
    if (new Set(ledger.claims.map(function(c){return c.id;})).size !== ledger.claims.length) throw new Error('Duplicate private history claim');
  }
  function propose(ledger, next) {
    validate(ledger);
    validateClaim(next);
    var same = ledger.claims.filter(function(c){return c.active && c.factKey === next.factKey;});
    if (ledger.claims.some(function(c){return c.id === next.id;})) return {kind:'duplicate',affected:[]};
    if (same.some(function(c){return c.statement !== next.statement || c.period !== next.period || c.chapter !== next.chapter ||
      c.status !== next.status || c.uncertainty !== next.uncertainty || c.order !== next.order;}))
      return {kind:'dispute',affected:Array.from(new Set(same.map(function(c){return c.chapter;}).concat([next.chapter])))};
    return {kind:same.length ? 'corroboration' : 'addition',affected:same.length ? [] : [next.chapter]};
  }
  function apply(ledger, next, ownerConfirmed, at, evidenceNote) {
    var decision = propose(ledger,next);
    if (decision.kind === 'duplicate') return {ledger:copy(ledger),decision:decision};
    if (decision.kind === 'dispute' || !ownerConfirmed && decision.kind !== 'corroboration') throw new Error('Owner reconciliation required');
    if (ownerConfirmed && (typeof evidenceNote !== 'string' || evidenceNote.trim().length < 10)) throw new Error('Private review evidence required');
    var result = copy(ledger);
    result.claims.push(copy(next));
    result.revision++;
    result.revisions.push({revision:result.revision,at:at,operation:decision.kind,claimId:next.id,
      affected:decision.affected,ownerConfirmed:ownerConfirmed === true,evidenceNote:evidenceNote || ''});
    return {ledger:result,decision:decision};
  }
  function withdraw(ledger, sourceId, at, reason) {
    validate(ledger);
    if (typeof reason !== 'string' || reason.trim().length < 10) throw new Error('Private withdrawal reason required');
    var result = copy(ledger), affected=[];
    result.claims.forEach(function(c){if(c.active && c.sourceId === sourceId){c.active=false;affected.push(c.chapter);}});
    if (!affected.length) throw new Error('No active source claims');
    result.revision++;
    result.revisions.push({revision:result.revision,at:at,operation:'withdrawal',sourceId:sourceId,reason:reason,
      affected:Array.from(new Set(affected))});
    return result;
  }
  function resolve(ledger, factKey, replacement, at, reason) {
    validate(ledger);
    if (!replacement || replacement.factKey !== factKey || typeof reason !== 'string' || reason.trim().length < 10)
      throw new Error('Owner resolution and grounded replacement required');
    if(ledger.claims.some(function(c){return c.id===replacement.id;}))throw new Error('Correction requires a new grounded claim identity');
    var result=copy(ledger);
    result.claims.forEach(function(c){if(c.factKey===factKey)c.active=false;});
    var revised=apply(result,replacement,true,at,reason).ledger;
    var record=revised.revisions[revised.revisions.length-1];
    record.operation='correction';record.reason=reason;
    record.affected=Array.from(new Set(ledger.claims.filter(function(c){return c.factKey===factKey;}).map(function(c){return c.chapter;}).concat([replacement.chapter])));
    return revised;
  }
  function chapters(ledger) {
    validate(ledger);
    var policy = editorialPolicy();
    return Object.keys(CHAPTERS).map(function(id){
      var claims=ledger.claims.filter(function(c){return c.active && c.chapter===id;})
        .sort(function(a,b){return a.order-b.order || a.factKey.localeCompare(b.factKey);});
      var seen={}, paragraphs=[];
      claims.forEach(function(c){
        // Repeated evidence strengthens the private provenance, not public bulk.
        var key=c.factKey+'\n'+c.statement;
        if(seen[key])return;seen[key]=true;
        var text=(c.status==='supported' ? '' : 'A member recalls: ')+c.statement+
          (c.uncertainty ? ' (Historical uncertainty: '+c.uncertainty+')' : '');
        paragraphs.push(policy.censor(text));
      });
      return {id:id,heading:CHAPTERS[id],paragraphs:paragraphs};
    }).filter(function(c){return c.paragraphs.length;});
  }
  return Object.freeze({empty:empty,claim:claim,propose:propose,apply:apply,withdraw:withdraw,resolve:resolve,chapters:chapters});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=AnnalsHistory;
