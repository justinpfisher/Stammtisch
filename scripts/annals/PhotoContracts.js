/* Pure shared contracts. Identity comes from private authenticated evidence,
 * never from a face classifier. No account, network or publication authority. */
var AnnalsPhotos = (function () {
  'use strict';
  var MEMBERS = ['fish','marc','matt','ken','jamie','jerome'];
  var MODE = 'standing-consent-photos-v2';
  var MAX_BYTES = 524288, MAX_EDGE = 1600, MIN_LONG_EDGE = 800;
  function photos(entry) { return entry.photos || (entry.photo ? [entry.photo] : []); }
  function sameAssets(a,b){
    validate(a);validate(b);
    return a.length===b.length&&a.every(function(p,i){return p.sha256===b[i].sha256&&p.width===b[i].width&&p.height===b[i].height;});
  }
  function indexRow(e) {
    return {entryId:e.id,collection:['monthly_gathering','artefact'].indexOf(e.category)>=0?'club_history':e.category,
      title:e.title,text:[e.summary].concat(photos(e).reduce(function(a,p){return a.concat([p.alt,p.caption||'']);},[])).join(' '),
      submittedAt:e.submittedAt||'',eventPeriod:e.eventPeriod||e.sortDate||'',year:e.eventPeriod?Number(e.eventPeriod.slice(0,4)):e.submittedAt?Number(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric'}).format(new Date(e.submittedAt))):e.year,
      photos:photos(e).map(function(p){var row={src:'assets/annals/'+(e.photos?p.sha256:e.id)+'.jpg',alt:p.alt};
        if(p.width){row.width=p.width;row.height=p.height;}if(p.caption)row.caption=p.caption;return row;})};
  }
  function indexOrder(a,b){return b.year-a.year||(b.submittedAt||b.eventPeriod).localeCompare(a.submittedAt||a.eventPeriod)||a.entryId.localeCompare(b.entryId);}
  function validate(list) {
    if (!Array.isArray(list) || !list.length || list.length > 3) throw new Error('Use one to three photographs');
    var seen = {};
    return list.map(function (p) {
      if (!p || Object.keys(p).some(function(k){return ['sha256','alt','caption','width','height'].indexOf(k)<0;}) ||
          !/^[a-f0-9]{64}$/.test(p.sha256 || '') || seen[p.sha256] ||
          typeof p.alt !== 'string' || !p.alt.trim() || p.alt.length > 180 ||
          p.caption !== undefined && (typeof p.caption !== 'string' || p.caption.length > 250) ||
          !Number.isInteger(p.width) || !Number.isInteger(p.height) ||
          p.width < 1 || p.height < 1 || p.width > MAX_EDGE || p.height > MAX_EDGE)
        throw new Error('Invalid screened photograph');
      seen[p.sha256] = true;
      return Object.assign({}, p);
    });
  }
  function period(value) {
    if (value === '') return '';
    if (typeof value !== 'string' || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) throw new Error('Invalid event precision');
    var full = value.length === 4 ? value+'-01-01' : value.length === 7 ? value+'-01' : value;
    if (Number(value.slice(0,4)) < 1990 || Number(value.slice(0,4)) > 2100 || new Date(full+'T00:00:00Z').toISOString().slice(0,10) !== full)
      throw new Error('Invalid event period');
    return value;
  }
  function allowed(evidence, assessment, grants) {
    if (!evidence || evidence.senderAuthenticated !== true || evidence.imageConsentAtReceipt !== true ||
        !assessment || assessment.safeToPublish !== true || assessment.privateDetails !== false ||
        assessment.thirdPartyMaterial !== false || assessment.childrenOrGuests !== false ||
        evidence.originalRights !== true) return false;
    if (['drink_or_object','scenery'].indexOf(assessment.kind)>=0) return true;
    // All six grants are checked conservatively; no automated person tagging.
    return assessment.kind === 'member_group' && evidence.peopleAttestedSixOnly === true &&
      Array.isArray(grants) && grants.length === 6 && MEMBERS.every(function(m){
        return grants.some(function(g){return g.member===m && g.active===true && g.atReceipt===true;});
      });
  }
  function blobRefs(list, refs) {
    validate(list);
    if (!Array.isArray(refs) || refs.length !== list.length) throw new Error('Exact blob references required');
    var seen = {};
    refs.forEach(function(r,i){
      if (!r || Object.keys(r).sort().join(',') !== 'gitSha,sha256,size' || r.sha256 !== list[i].sha256 ||
          !/^[a-f0-9]{40}$/.test(r.gitSha || '') || seen[r.gitSha] ||
          !Number.isInteger(r.size) || r.size < 24 || r.size > MAX_BYTES ||
          Math.max(list[i].width,list[i].height) < MIN_LONG_EDGE) throw new Error('Invalid bounded blob reference');
      seen[r.gitSha] = true;
    });
    return refs;
  }
  return Object.freeze({photos:photos,sameAssets:sameAssets,validate:validate,period:period,allowed:allowed,MEMBERS:MEMBERS,
    MODE:MODE,MAX_BYTES:MAX_BYTES,MAX_EDGE:MAX_EDGE,MIN_LONG_EDGE:MIN_LONG_EDGE,blobRefs:blobRefs,indexRow:indexRow,indexOrder:indexOrder});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=AnnalsPhotos;
