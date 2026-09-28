const iranDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
});

function dayNumber(value) {
  const parts = Object.fromEntries(iranDate.formatToParts(value).map(part => [part.type, Number(part.value)]));
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000);
}

export function daysRemainingIran(expiresAt, now = Date.now()) {
  const expiry = new Date(expiresAt);
  if (!Number.isFinite(expiry.getTime())) return 0;
  return Math.max(0, dayNumber(expiry) - dayNumber(new Date(now)));
}
