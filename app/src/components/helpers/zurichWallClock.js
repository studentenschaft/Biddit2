// HSG runs on Zurich time, and the calendar says so to a student abroad too:
// FullCalendar draws an event in the reader's zone, but a string without an
// offset "floats" and is drawn as written (ADR 0011). The sv-SE locale prints
// the ISO-like "YYYY-MM-DD HH:mm:ss", so only the space needs swapping.
const ZURICH = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Zurich",
  dateStyle: "short",
  timeStyle: "medium",
});

/**
 * The Zurich wall-clock time of an instant, without an offset.
 *
 * @param {Date|string|number|Object} dateLike - Anything `new Date` takes
 *   (a moment converts through its value)
 * @returns {string} "2026-09-21T10:15:00"
 */
export function toZurichWallClock(dateLike) {
  return ZURICH.format(new Date(dateLike)).replace(" ", "T");
}
