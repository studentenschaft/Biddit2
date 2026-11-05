/**
 * ECTS credits. The university API sends credits in hundredths (300 = 3 ECTS);
 * some paths hand over values that are already ECTS. Anything above
 * RAW_CREDITS_THRESHOLD is treated as hundredths, so toEcts is idempotent.
 */

const RAW_CREDITS_THRESHOLD = 99;
const HUNDREDTHS = 100;

/** @returns {number|*} ECTS, or `fallback` when the credits are unknown. */
export const toEcts = (raw, fallback = null) => {
  if (raw == null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return value > RAW_CREDITS_THRESHOLD ? value / HUNDREDTHS : value;
};

/**
 * Display string for an ECTS value: "?" when unknown, otherwise the number
 * without trailing zeros. The toFixed(2) round-trip sheds float noise from
 * sums (0.1 + 0.2) and never rounds a real value away, since ECTS carry at
 * most two decimals.
 */
export const formatEcts = (ects) => {
  if (ects == null) return "?";
  const value = Number(ects);
  if (!Number.isFinite(value)) return "?";
  return String(Number(value.toFixed(2)));
};
