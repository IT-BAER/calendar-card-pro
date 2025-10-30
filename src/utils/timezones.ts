/*
 * Timezone utilities
 * - Uses Intl.supportedValuesOf('timeZone') when available to get the full canonical IANA list at runtime.
 * - Provides a helper to build friendly labels that include the current UTC offset and short abbreviation (when available).
 */

export type TimezoneOption = { value: string; label: string };

/**
 * Return an array of IANA timezone IDs.
 * Uses Intl.supportedValuesOf('timeZone') when available; falls back to a small curated list if not.
 */
export function getIanaTimeZones(): string[] {
  try {
    const anyIntl = Intl as unknown as { supportedValuesOf?: (type: string) => string[] };
    if (typeof anyIntl.supportedValuesOf === 'function') {
      const zones = anyIntl.supportedValuesOf('timeZone');
      if (Array.isArray(zones) && zones.length > 0) return zones;
    }
  } catch {
    // ignore and fall back
  }

  // Fallback: a reasonable curated list of common timezones.
  // This will be used only in older environments that don't support supportedValuesOf.
  return [
    'UTC',
    'Europe/London',
    'Europe/Dublin',
    'Europe/Lisbon',
    'Europe/Amsterdam',
    'Europe/Paris',
    'Europe/Brussels',
    'Europe/Berlin',
    'Europe/Madrid',
    'Europe/Rome',
    'Europe/Zurich',
    'Europe/Stockholm',
    'Europe/Oslo',
    'Europe/Copenhagen',
    'Europe/Helsinki',
    'Europe/Warsaw',
    'Europe/Prague',
    'Europe/Budapest',
    'Europe/Vienna',
    'Europe/Athens',
    'Europe/Moscow',
    'Africa/Cairo',
    'Africa/Johannesburg',
    'Asia/Jerusalem',
    'Asia/Dubai',
    'Asia/Riyadh',
    'Asia/Karachi',
    'Asia/Kolkata',
    'Asia/Dhaka',
    'Asia/Yangon',
    'Asia/Bangkok',
    'Asia/Jakarta',
    'Asia/Ho_Chi_Minh',
    'Asia/Manila',
    'Asia/Hong_Kong',
    'Asia/Shanghai',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Australia/Sydney',
    'Australia/Melbourne',
    'Australia/Brisbane',
    'Australia/Perth',
    'Pacific/Auckland',
    'Pacific/Fiji',
    'America/St_Johns',
    'America/Halifax',
    'America/Toronto',
    'America/New_York',
    'America/Indiana/Indianapolis',
    'America/Chicago',
    'America/Winnipeg',
    'America/Denver',
    'America/Edmonton',
    'America/Phoenix',
    'America/Los_Angeles',
    'America/Vancouver',
    'America/Anchorage',
    'America/Honolulu',
    'America/Mexico_City',
    'America/Bogota',
    'America/Lima',
    'America/Caracas',
    'America/Sao_Paulo',
    'America/Argentina/Buenos_Aires',
    'America/Santiago',
    'America/Montevideo',
    'Atlantic/Reykjavik',
    'Pacific/Honolulu',
  ];
}

/**
 * Compute the timezone offset in minutes for a given IANA timezone at the provided date.
 * Method: format the date in the target time zone to parts and build an ISO string which is
 * then interpreted as UTC to derive the offset.
 */
function getOffsetMinutesForTimeZone(timeZone: string, date = new Date()): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  if (!map.year) throw new Error('Could not compute offset');

  const iso = `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}Z`;
  const asUtc = new Date(iso);
  // Positive means timezone is ahead of UTC (e.g., UTC+1 => +60)
  const offsetMinutes = Math.round((asUtc.getTime() - date.getTime()) / 60000);
  return offsetMinutes;
}

function formatOffsetLabel(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}

/**
 * Build timezone option objects with friendly labels.
 * Label format: "Region/City — City (UTC±HH:MM [TZABBR])" where TZABBR is included when available.
 */
export function makeTimezoneOptions(locale = 'en-US', date = new Date()): TimezoneOption[] {
  const zones = getIanaTimeZones();
  const out: TimezoneOption[] = [];

  for (const tz of zones) {
    try {
      const offsetMinutes = getOffsetMinutesForTimeZone(tz, date);
      const offsetLabel = formatOffsetLabel(offsetMinutes);

      // Try to get a short name/abbreviation (may be GMT+1 or CET/CEST depending on browser)
      let abbr = '';
      try {
        const parts = Intl.DateTimeFormat(locale, {
          timeZone: tz,
          timeZoneName: 'short',
        }).formatToParts(date);
        abbr = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
      } catch {
        abbr = '';
      }

      const city = tz.split('/').slice(-1)[0].replace(/_/g, ' ');
      const label =
        abbr && !/^GMT|UTC/.test(abbr)
          ? `${tz} — ${city} (${offsetLabel} ${abbr})`
          : `${tz} — ${city} (${offsetLabel})`;

      out.push({ value: tz, label });
    } catch {
      // If anything fails, fall back to the raw tz id
      out.push({ value: tz, label: tz });
    }
  }

  return out;
}
