/**
 * Calendar export helpers for the timetable: weekly-recurring .ics files and
 * Google Calendar "add event" template links. No OAuth — the user adds events
 * to their own calendar via download/link.
 */

/** Period start–end times, index = period-1. Kept here (server-safe) so both
 *  the client grid and the public calendar feed share one source of truth. */
export const PERIOD_TIMES = [
  "09:00–10:00", "10:00–11:00", "11:00–12:00", "12:00–13:00",
  "14:00–15:00", "15:00–16:00", "16:00–17:00", "17:00–18:00",
];

export type CalendarClass = {
  id: string;
  day: string; // MON..SUN
  period: number; // 1-based, maps into periodTimes
  title: string; // e.g. "CS501 — Data Structures"
  location: string; // room name
  description?: string; // faculty etc.
};

const BYDAY: Record<string, string> = {
  MON: "MO", TUE: "TU", WED: "WE", THU: "TH", FRI: "FR", SAT: "SA", SUN: "SU",
};
const DAY_INDEX: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

/** "09:00–10:00" → ["09:00", "10:00"] (tolerates - or – separators) */
function parsePeriod(time: string): [string, string] {
  const [a, b] = time.split(/[–-]/);
  return [a.trim(), b.trim()];
}

/** Next calendar date (today included) that falls on the given weekday. */
function nextDateFor(day: string): Date {
  const now = new Date();
  const target = DAY_INDEX[day] ?? 1;
  const diff = (target - now.getDay() + 7) % 7;
  const d = new Date(now);
  d.setDate(now.getDate() + diff);
  return d;
}

function fmtDate(d: Date, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(h)}${pad(m)}00`;
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Whole-week .ics with one weekly-recurring VEVENT per class. */
export function buildWeekIcs(classes: CalendarClass[], periodTimes: string[], calendarName = "ChalkZone Timetable"): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const events = classes.map((c) => {
    const [start, end] = parsePeriod(periodTimes[c.period - 1] ?? "09:00–10:00");
    const date = nextDateFor(c.day);
    return [
      "BEGIN:VEVENT",
      `UID:${c.id}@chalkzone`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${fmtDate(date, start)}`,
      `DTEND:${fmtDate(date, end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[c.day] ?? "MO"}`,
      `SUMMARY:${escapeIcs(c.title)}`,
      `LOCATION:${escapeIcs(c.location)}`,
      ...(c.description ? [`DESCRIPTION:${escapeIcs(c.description)}`] : []),
      "END:VEVENT",
    ].join("\r\n");
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ChalkZone//Timetable//EN",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Trigger a browser download of the generated .ics file. */
export function downloadIcs(classes: CalendarClass[], periodTimes: string[], filename = "chalkzone-timetable.ics") {
  const blob = new Blob([buildWeekIcs(classes, periodTimes)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Google Calendar template link for one weekly-recurring class. */
export function googleCalendarLink(c: CalendarClass, periodTimes: string[]): string {
  const [start, end] = parsePeriod(periodTimes[c.period - 1] ?? "09:00–10:00");
  const date = nextDateFor(c.day);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: c.title,
    dates: `${fmtDate(date, start)}/${fmtDate(date, end)}`,
    recur: `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[c.day] ?? "MO"}`,
    location: c.location,
    ...(c.description ? { details: c.description } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
