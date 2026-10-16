// The calendar of the timetables in Lugano: the public holidays of Ticino,
// when the buses run as on Sundays, and the yearly timetable change. Dates
// are days of Lugano: "2026-10-16".

// Same day every year: "MM-DD"
const FIXED_HOLIDAYS = new Set([
  "01-01", // Capodanno
  "01-06", // Epifania
  "03-19", // San Giuseppe
  "05-01", // Festa del lavoro
  "06-29", // Santi Pietro e Paolo
  "08-01", // Festa nazionale
  "08-15", // Assunzione
  "11-01", // Ognissanti
  "12-08", // Immacolata Concezione
  "12-25", // Natale
  "12-26", // Santo Stefano
]);

// Days after Easter Sunday
const EASTER_HOLIDAYS = [
  1, // Lunedì di Pasqua
  39, // Ascensione
  50, // Lunedì di Pentecoste
  60, // Corpus Domini
];

const DAY_MS = 24 * 60 * 60_000;

const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

const utcDay = (date: string): number => {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

// Easter Sunday of the Gregorian calendar (anonymous algorithm)
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDate(Date.UTC(year, month - 1, day));
}

export function isTicinoHoliday(date: string): boolean {
  if (FIXED_HOLIDAYS.has(date.slice(5))) return true;
  const easter = utcDay(easterSunday(Number(date.slice(0, 4))));
  return EASTER_HOLIDAYS.some((days) => isoDate(easter + days * DAY_MS) === date);
}

// The timetables of Switzerland change on the Sunday after the second
// Saturday of December: 13 December 2026
function timetableChange(year: number): string {
  const weekday = new Date(Date.UTC(year, 11, 1)).getUTCDay();
  const firstSaturday = 1 + ((6 - weekday + 7) % 7);
  return isoDate(Date.UTC(year, 11, firstSaturday + 8));
}

// The timetable in force on the day, named by its year as the SBB do: the
// one starting in December 2026 is the timetable 2027
export function timetableYear(date: string): number {
  const year = Number(date.slice(0, 4));
  return date >= timetableChange(year) ? year + 1 : year;
}
