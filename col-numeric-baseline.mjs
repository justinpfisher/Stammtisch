/* The read-only Sheet monitor refreshes these three presentation fields
 * without changing the 301 rows or their historical scoring. Keep every
 * scoring, identity, death, discovery, selection and source field signed.
 * Only explicitly known volatile display fields are excluded. */
export function numericBaselineProjection(baseline) {
  if(!baseline||!Array.isArray(baseline.members))throw Error('Complete numeric historical baseline required');
  const stable=structuredClone(baseline);
  delete stable.capturedAt;
  delete stable.asOf;
  for(const member of stable.members) {
    if(!Array.isArray(member.picks))throw Error('Complete numeric member selections required');
    for(const pick of member.picks)delete pick.ageText;
  }
  return stable;
}
