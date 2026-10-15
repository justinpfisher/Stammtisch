/* Pure shared contracts. Identity comes from private authenticated evidence,
 * never from a face classifier. No account, network or publication authority. */
var AnnalsPhotos = (function () {
  'use strict';
  var MEMBERS = ['fish','marc','matt','ken','jamie','jerome'];
  function photos(entry) { return entry.photos || (entry.photo ? [entry.photo] : []); }
  function validate(list) {
    if (!Array.isArray(list) || !list.length || list.length > 3) throw new Error('Use one to three photographs');
    var seen = {};
    return list.map(function (p) {
      if (!p || Object.keys(p).some(function(k){return ['sha256','alt','caption','width','height'].indexOf(k)<0;}) ||
          !/^[a-f0-9]{64}$/.test(p.sha256 || '') || seen[p.sha256] ||
          typeof p.alt !== 'string' || !p.alt.trim() || p.alt.length > 180 ||
          p.caption !== undefined && (typeof p.caption !== 'string' || p.caption.length > 250) ||
          !Number.isInteger(p.width) || !Number.isInteger(p.height) ||
          p.width < 1 || p.height < 1 || p.width > 1000 || p.height > 1000)
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
  return Object.freeze({photos:photos,validate:validate,period:period,allowed:allowed,MEMBERS:MEMBERS});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=AnnalsPhotos;
