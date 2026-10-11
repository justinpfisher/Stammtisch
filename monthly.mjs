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

// Third Fridays are outside Toronto's Sunday daylight-saving transitions.
function torontoMidnight(year, month, day) {
  const noon = Date.UTC(year, month - 1, day, 12);
  const localHour = Number(new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO_TIME_ZONE, hour: 'numeric', hourCycle: 'h23',
  }).format(new Date(noon)));
  const offsetHours = localHour - 12;
  return Date.UTC(year, month - 1, day) - offsetHours * 3_600_000;
}

export function monthlyCountdown(now = new Date()) {
  const instant = now instanceof Date ? now : new Date(now);
  const next = nextMonthlyGathering(instant);
  if (!next) return null;
  const [year, month, day] = next.isoDate.split('-').map(Number);
  const remainingMinutes = Math.max(0, Math.ceil(
    (torontoMidnight(year, month, day) - instant.getTime()) / 60_000));
  return {
    days: Math.floor(remainingMinutes / 1440),
    hours: Math.floor((remainingMinutes % 1440) / 60),
    minutes: remainingMinutes % 60,
    isToday: next.isToday,
  };
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
  const hourCount = root.querySelector('[data-monthly-hours]');
  const minuteCount = root.querySelector('[data-monthly-minutes]');
  const caption = root.querySelector('[data-monthly-caption]');
  const note = root.querySelector('.monthly-countdown-note');
  const dateText = root.querySelector('[data-monthly-date]');
  const update = () => {
    const now = new Date();
    const next = nextMonthlyGathering(now);
    const parts = monthlyCountdown(now);
    if (!next) return;
    dateText.dateTime = next.isoDate;
    dateText.textContent = next.displayDate;
    dayCount.textContent = String(parts.days);
    hourCount.textContent = String(parts.hours).padStart(2, '0');
    minuteCount.textContent = String(parts.minutes).padStart(2, '0');
    note.textContent = next.isToday ? 'The third Friday is today'
      : 'Until the third Friday begins · Toronto time';
    caption.textContent = next.isToday
      ? 'The third Friday is today'
      : `${parts.days} days, ${parts.hours} hours, and ${parts.minutes} minutes until the next third Friday begins in Toronto.`;
  };
  update();
  // A long-open page needs a refresh when Toronto passes midnight.
  setInterval(update, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
}

if (typeof document !== 'undefined') mountMonthlyGathering();
