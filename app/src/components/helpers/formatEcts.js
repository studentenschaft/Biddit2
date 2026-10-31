/**
 * Format an ECTS credit value for display.
 *
 * Credit sums pick up float representation noise (0.1 + 0.2 → 0.30000000000004,
 * and subtracting a cap from a running sum is just as bad), so every rendered
 * credit figure goes through here. The toFixed(2) round-trip only sheds that
 * noise — it never rounds a genuine fraction away, since real ECTS values carry
 * at most two decimals.
 *
 * Values are not reliably numbers at every call site, hence the Number()
 * coercion.
 */
export function formatEcts(value) {
  const credits = Number(value);
  if (!Number.isFinite(credits)) return "0";
  return String(Number(credits.toFixed(2)));
}
