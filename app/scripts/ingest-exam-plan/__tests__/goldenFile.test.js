/**
 * The centrepiece of the suite: it never needs poppler, because the committed
 * `winter-2027.txt` is exactly what `pdftotext -layout` produced. Rebuilding
 * the plan from it and comparing byte-for-byte pins all 178 exams and stops
 * `public/exams/HS26.json` from drifting away from the parser.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildExamPlan } from "../buildExamPlan.js";
import { parseExamPlanText } from "../parseExamPlanText.js";
import { SOURCE_FILE, readFixture } from "./readFixture.js";

const SHIPPED_ARTIFACT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../public/exams/HS26.json",
);
const JSON_INDENT = 2;

describe("golden file", () => {
  it("rebuilds the artifact shipped in public/exams, byte for byte", () => {
    const raw = readFixture("winter-2027.txt");
    const plan = buildExamPlan(parseExamPlanText(raw), {
      semester: "HS26",
      sourceFile: SOURCE_FILE,
    });
    expect(readFileSync(SHIPPED_ARTIFACT, "utf8")).toBe(
      `${JSON.stringify(plan, null, JSON_INDENT)}\n`,
    );
  });
});
