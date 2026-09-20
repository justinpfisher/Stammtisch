export const cavalcadeRule = 'Goes to the player with the most deaths worth fewer than 9 points, with a minimum of three qualifying deaths.';

// Justin's clarification takes precedence over the older spreadsheet wording,
// including after a new register import.
export function distinctionReason(item) {
  return item.name.trim().toLowerCase() === 'cavalcade of calamity' ? cavalcadeRule : item.reason;
}

export function ageAt(born, at) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(born || '') || !/^\d{4}-\d{2}-\d{2}$/.test(at || '') || at < born) return null;
  const [by, bm, bd] = born.split('-').map(Number);
  const [ay, am, ad] = at.split('-').map(Number);
  return ay - by - Number(am < bm || (am === bm && ad < bd));
}

export function basePoints(age) {
  if (!Number.isInteger(age) || age < 0) return null;
  return age === 100 ? 10 : 100 - age;
}

