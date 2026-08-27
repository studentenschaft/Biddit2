/**
 * The exam plan prints local Zurich wall-clock times. The UTC offset is derived
 * per date rather than hardcoded to +01:00: a summer exam plan falls in CEST.
 */

const ZURICH_TIME_ZONE = "Europe/Zurich";
// Probing at midday UTC keeps the lookup clear of the 01:00 UTC DST switch, so
// a transition day still reports the offset that applies to its exam slots.
const OFFSET_PROBE_TIME_UTC = "T12:00:00Z";
const OFFSET_PATTERN = /^[+-]\d{2}:\d{2}$/;

const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: ZURICH_TIME_ZONE,
  timeZoneName: "longOffset",
});

/** @param {string} date ISO calendar date, e.g. "2027-01-18" */
export function zurichUtcOffset(date) {
  const parts = offsetFormat.formatToParts(
    new Date(`${date}${OFFSET_PROBE_TIME_UTC}`),
  );
  const offset = parts
    .find((part) => part.type === "timeZoneName")
    ?.value.replace("GMT", "");
  if (!OFFSET_PATTERN.test(offset)) {
    throw new Error(
      `Cannot determine the Europe/Zurich UTC offset for ${date} (got "${offset}")`,
    );
  }
  return offset;
}

/**
 * @param {string} date ISO calendar date, e.g. "2027-01-18"
 * @param {string} time 24h wall clock, e.g. "09:15"
 */
export function toZurichIso(date, time) {
  return `${date}T${time}:00${zurichUtcOffset(date)}`;
}
