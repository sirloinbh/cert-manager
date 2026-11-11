// Dates are stored and sent as YYYY-MM-DD; the screen shows them in English, such as October 22, 2026.
// The calendar day is formatted in UTC so the reader's time zone never moves it to another day.

const full = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export function formatDate(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? day : full.format(date);
}
