const MATCH_TIME_ZONE = 'Asia/Kolkata';

export function parseMatchSchedule(value: string | Date) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const normalized = value.trim().replace(' ', 'T');
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const date = new Date(hasTimezone ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMatchSchedule(value: string | Date, options: Intl.DateTimeFormatOptions) {
  const date = parseMatchSchedule(value);
  if (!date) return 'Time unavailable';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: MATCH_TIME_ZONE,
    ...options,
  }).format(date);
}

export function formatMatchTimeFirst(value: string | Date) {
  const time = formatMatchSchedule(value, { hour: '2-digit', minute: '2-digit', hour12: true });
  const date = formatMatchSchedule(value, { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (time === 'Time unavailable' || date === 'Time unavailable') return 'Time unavailable';
  return `${time} · ${date}`;
}