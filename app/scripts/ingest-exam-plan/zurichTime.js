/**
 * The exam plan prints local Zurich wall-clock times. The UTC offset is derived
 * per date rather than hardcoded to +01:00: a summer exam plan falls in CEST.
 */

const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Zurich",
  timeZoneName: "longOffset",
});

/**
 * @param {string} date ISO calendar date, e.g. "2027-01-18"
 * @param {string} time 24h wall clock, e.g. "09:15"
 */
export function toZurichIso(date, time) {
  // Probed at midday UTC, clear of the 01:00 UTC DST switch, so a transition
  // day reports the offset that applies to its exam slots.
  const offset = offsetFormat
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((part) => part.type === "timeZoneName")
    .value.slice("GMT".length);
  return `${date}T${time}:00${offset}`;
}
