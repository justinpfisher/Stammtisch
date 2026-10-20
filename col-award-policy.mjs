/* Version-bound CoL award features. No rule is adopted by importing this module.
 * Only an independently verified complete staged release can enable a feature. */
export const OLDEST_DEATH_STEAL_CLAUSE =
  'Whoever had the oldest celebrity death in the previous calendar year also gets one Steal at the next draft. If needed, compare ages at death to the day level.';
const CENTENARY_MARKER='Selected interpretation: the omission ends only those extra benefits prospectively';

export function verifiedAwardPolicy(snapshot, now=Date.now()) {
  const version=snapshot?.version;
  const witnessed=typeof snapshot?.candidateDigest==='string'&&/^[a-f0-9]{64}$/.test(snapshot.candidateDigest);
  const effective=version?.effectiveAt&&Number.isFinite(Date.parse(version.effectiveAt))&&Date.parse(version.effectiveAt)<=now;
  const words=version?.provisions?.['DRAFT - ORDER OF BUSINESS'];
  const oldestDeathSteal=witnessed&&version?.verified===true&&effective&&
    typeof words==='string'&&words.replace(/[\u2018\u2019]/g,"'").replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').trim().includes(OLDEST_DEATH_STEAL_CLAUSE);
  const provisions=version?.provisions||{};
  const points=provisions.POINTS||'',blue=provisions['BLUE DIAMOND']||'',brown=provisions['BROWN DIAMOND']||'';
  const completeCentenary=version?.protocol===3&&typeof version?.digest==='string'&&/^[a-f0-9]{64}$/.test(version.digest)&&
    version?.parameters&&version?.januaryGap!==undefined&&
    points.includes(CENTENARY_MARKER)&&!blue.includes('dies at exactly 100')&&!brown.includes('dies at exactly 100')&&
    points.includes('Matter for Club Deliberation (non-operative)')&&
    ['PRIZE','BIRTHDAY BUFFET','DRAFTING','DRAFT - ORDER OF BUSINESS'].every(key=>
      typeof provisions[key]==='string'&&provisions[key].includes('Matter for Club Deliberation (non-operative)'));
  const age100PrivilegeEndsAt=witnessed&&version?.verified===true&&effective&&completeCentenary
    ? version.effectiveAt : null;
  return Object.freeze({oldestDeathSteal:oldestDeathSteal===true,age100PrivilegeEndsAt});
}
