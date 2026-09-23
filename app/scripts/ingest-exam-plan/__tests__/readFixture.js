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
