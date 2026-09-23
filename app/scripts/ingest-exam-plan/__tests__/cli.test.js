// Runs cli.js as a child process: the write guards live only there.
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HEADER, TABLE_HEADER, TWO_SLOT_ROW } from "./readFixture.js";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "../cli.js");

const TWO_EXAMS = `${HEADER}
${TABLE_HEADER}
${TWO_SLOT_ROW}
`;
const THREE_EXAMS = `${TWO_EXAMS}Montag /   BA: OT EN  90'  3,202 Microeconomics II
`;

let dir;
let out;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ingest-exam-plan-"));
  out = join(dir, "exams", "HS26.json");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const ingest = (text, ...flags) => {
  const input = join(dir, "plan.txt");
  writeFileSync(input, text);
  return spawnSync(
    process.execPath,
    [CLI, "--text", input, "--out", out, ...flags],
    { encoding: "utf8" },
  );
};
const writtenIds = () =>
  JSON.parse(readFileSync(out, "utf8")).written.map((exam) => exam.id);

describe("cli", () => {
  it("refuses to drop exams the existing artifact has, listing each one", () => {
    expect(ingest(THREE_EXAMS).status).toBe(0);
    const shrunk = ingest(TWO_EXAMS);
    expect(shrunk.status).toBe(1);
    expect(shrunk.stderr).toBe(
      `Nothing written: 1 exams in ${out} are missing from this plan. Check each against the PDF; if HSG really dropped them, re-run with --allow-removals.
  OT-2027-01-18-0915-3,202
`,
    );
    expect(writtenIds()).toHaveLength(3);
  });

  it("drops them when --allow-removals says the PDF really lost them", () => {
    expect(ingest(THREE_EXAMS).status).toBe(0);
    expect(ingest(TWO_EXAMS, "--allow-removals").status).toBe(0);
    expect(writtenIds()).toHaveLength(2);
  });

  it("replaces the artifact rather than rewriting it in place", () => {
    // A new inode means the file was renamed into place, so a reader sees the
    // old artifact or the new one, never a half-written file.
    expect(ingest(THREE_EXAMS).status).toBe(0);
    const before = statSync(out).ino;
    expect(ingest(THREE_EXAMS).status).toBe(0);
    expect(statSync(out).ino).not.toBe(before);
    expect(readdirSync(dirname(out))).toEqual(["HS26.json"]);
  });

  it("leaves no temp file behind when the write fails", () => {
    // A directory in the artifact's place makes the rename fail.
    mkdirSync(out, { recursive: true });
    expect(ingest(TWO_EXAMS, "--allow-removals").status).toBe(1);
    expect(readdirSync(dirname(out))).toEqual(["HS26.json"]);
  });

  it("prints the usage after an argument error", () => {
    const { status, stderr } = ingest(TWO_EXAMS, "--semester", "HS26");
    expect(status).toBe(1);
    expect(stderr).toMatch(
      /^Unknown option '--semester'\n\nUsage: npm run ingest:exams -- .*\n$/s,
    );
  });
});
