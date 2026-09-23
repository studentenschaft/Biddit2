import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Vite rewrites `new URL(<literal>, import.meta.url)` into an asset reference,
// so fixtures are resolved through node:path instead.
const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

export const readFixture = (name) =>
  readFileSync(join(FIXTURE_DIR, name), "utf8");

/** Title and banner that make a hand-written snippet a written-exam page. */
export const HEADER = `Prüfungsplan Winter 2027 / Examination Schedule Winter 2027 (18.01. - 20.02.2027)
Schriftliche Prüfungen / Written examinations`;

/** Table header whose start-time labels sit at columns 11 and 60. */
export const TABLE_HEADER =
  "Datum      Prüfungsbeginn (schriftl.): 09.15 Uhr            Prüfungsbeginn (schriftl.): 15.15 Uhr";

/**
 * A date row with one exam under each label. A page that uses only one start
 * time is refused, so every snippet needs both.
 */
export const TWO_SLOT_ROW =
  "18.01.2027 BA: OT DE  90'  3,200 Mikroökonomik II           MA: OT EN 120' 1,908 Linear Algebra";
