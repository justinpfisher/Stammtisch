/** Stammtisch gathers on the third Friday of each month, Toronto local date.
 * The meeting hour and exact venue are confirmed privately; this is a date countdown.
 */
const TORONTO_TIME_ZONE = 'America/Toronto';
const MS_PER_DAY = 86_400_000;

export function thirdFridayDay(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('Expected a calendar year and a month from 1 to 12');
  }
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((5 - firstWeekday + 7) % 7) + 14;
}

function torontoCalendarParts(now) {
  const fields = new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO_TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now);
  const result = Object.fromEntries(fields.filter(part => part.type !== 'literal')
    .map(part => [part.type, Number(part.value)]));
  return { year: result.year, month: result.month, day: result.day };
}

export function nextMonthlyGathering(now = new Date()) {
  const instant = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(instant.getTime())) return null;
  const today = torontoCalendarParts(instant);
  let year = today.year;
  let month = today.month;
  let day = thirdFridayDay(year, month);
  if (today.day > day) {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
    day = thirdFridayDay(year, month);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  const daysRemaining = Math.round((date.getTime() -
    Date.UTC(today.year, today.month - 1, today.day)) / MS_PER_DAY);
  return {
    isoDate: date.toISOString().slice(0, 10),
    displayDate: new Intl.DateTimeFormat('en-CA', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    }).format(date),
    daysRemaining,
    isToday: daysRemaining === 0,
  };
}

function mountMonthlyGathering() {
  const root = document.querySelector('[data-monthly-gathering]');
  if (!root) return;
  const dayCount = root.querySelector('[data-monthly-days]');
  const caption = root.querySelector('[data-monthly-caption]');
  const dateText = root.querySelector('[data-monthly-date]');
  const update = () => {
    const next = nextMonthlyGathering();
    if (!next) return;
    dateText.dateTime = next.isoDate;
    dateText.textContent = next.displayDate;
    dayCount.textContent = String(next.daysRemaining);
    caption.textContent = next.isToday
      ? 'The third Friday is today'
      : next.daysRemaining === 1
        ? 'day until the next third Friday'
        : 'days until the next third Friday';
  };
  update();
  // A long-open page needs a refresh when Toronto passes midnight.
  setInterval(update, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
}

if (typeof document !== 'undefined') mountMonthlyGathering();
