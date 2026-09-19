/** Round up partial minutes so the countdown never reaches zero early. */
export function countdownParts(target, now = Date.now()) {
  const remaining = target - now;
  if (!Number.isFinite(remaining)) return null;
  if (remaining <= 0) return { days: 0, hours: 0, minutes: 0, convened: true };
  const minutes = Math.ceil(remaining / 60_000);
  return {
    days: Math.floor(minutes / 1440),
    hours: Math.floor((minutes % 1440) / 60),
    minutes: minutes % 60,
    convened: false,
  };
}

function mountCountdown() {
  const root = document.querySelector('[data-countdown]');
  const start = document.querySelector('time[data-assembly-start]');
  if (!root || !start) return;
  const target = Date.parse(start.dateTime);
  const digits = root.querySelector('[data-countdown-digits]');
  const status = root.querySelector('[data-countdown-status]');
  let timer;
  const update = () => {
    const parts = countdownParts(target);
    if (!parts) return;
    if (parts.convened) {
      digits.hidden = true;
      status.classList.remove('sr-only');
      status.textContent = 'The 2027 Assembly has convened.';
      root.querySelector('[data-countdown-label]').textContent = 'The appointed hour';
      clearInterval(timer);
      return;
    }
    digits.hidden = false;
    status.classList.add('sr-only');
    for (const unit of ['days', 'hours', 'minutes']) {
      root.querySelector(`[data-unit="${unit}"]`).textContent = unit === 'days'
        ? String(parts[unit]) : String(parts[unit]).padStart(2, '0');
    }
    // Readable equivalent without repeated screen-reader announcements.
    status.textContent = `${parts.days} days, ${parts.hours} hours, and ${parts.minutes} minutes until the Assembly.`;
  };
  update();
  if (Date.now() < target) timer = setInterval(update, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
}

if (typeof document !== 'undefined') mountCountdown();
