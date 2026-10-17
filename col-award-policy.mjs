/* Version-bound CoL award features. No rule is adopted by importing this module.
 * Only an independently verified complete staged release can enable a feature. */
export const OLDEST_DEATH_STEAL_CLAUSE =
  'Whoever had the oldest celebrity death in the previous calendar year also gets one Steal at the next draft. If needed, compare ages at death to the day level.';

export function verifiedAwardPolicy(snapshot, now=Date.now()) {
  const version=snapshot?.version;
  const witnessed=typeof snapshot?.candidateDigest==='string'&&/^[a-f0-9]{64}$/.test(snapshot.candidateDigest);
  const effective=version?.effectiveAt&&Number.isFinite(Date.parse(version.effectiveAt))&&Date.parse(version.effectiveAt)<=now;
  const words=version?.provisions?.['DRAFT - ORDER OF BUSINESS'];
  const oldestDeathSteal=witnessed&&version?.verified===true&&effective&&
    typeof words==='string'&&words.replace(/[\u2018\u2019]/g,"'").replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').trim().includes(OLDEST_DEATH_STEAL_CLAUSE);
  return Object.freeze({oldestDeathSteal:oldestDeathSteal===true});
}
