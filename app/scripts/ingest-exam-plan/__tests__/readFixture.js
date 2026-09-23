import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Path recorded in the artifact, so a fixture build matches the shipped file. */
export const SOURCE_FILE = "docs/exams/Prüfungsplan OT Winter 2027.pdf";

// Vite rewrites `new URL(<literal>, import.meta.url)` into an asset reference,
// so fixtures are resolved through node:path instead.
const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

export const readFixture = (name) =>
  readFileSync(join(FIXTURE_DIR, name), "utf8");

export const readSnippet = (name) => readFixture(join("snippets", name));

/** Title and banner that make a hand-written snippet a written-exam page. */
export const HEADER = `Prüfungsplan Winter 2027 / Examination Schedule Winter 2027 (18.01. - 20.02.2027)
Schriftliche Prüfungen / Written examinations`;
