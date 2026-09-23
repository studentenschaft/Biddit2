// HSG runs on Zurich time, and the calendar says so to a student abroad too:
// FullCalendar draws an event in the reader's zone, but a string without an
// offset "floats" and is drawn as written (ADR 0011).
const ZURICH = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/**
 * The Zurich wall-clock time of an instant, without an offset.
 *
 * @param {Date|string|number|Object} dateLike - Anything `new Date` takes
 *   (a moment converts through its value)
 * @returns {string} "2026-09-21T10:15:00"
 */
export function toZurichWallClock(dateLike) {
  const part = Object.fromEntries(
    ZURICH.formatToParts(new Date(dateLike)).map(({ type, value }) => [
      type,
      value,
    ]),
  );
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}:${part.second}`;
}
