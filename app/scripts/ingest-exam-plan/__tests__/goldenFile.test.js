/**
 * The centrepiece of the suite: it never needs poppler, because the committed
 * `winter-2027.txt` is exactly what `pdftotext -layout` produced and
 * `winter-2027.byod.json` is what the CLI read off the PDF's BYOD shading.
 * Rebuilding the plan from them and comparing byte-for-byte pins all 178
 * exams and stops `public/exams/HS26.json` from drifting away from the parser.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildExamPlan, toArtifactJson } from "../buildExamPlan.js";
import { parseExamPlanText } from "../parseExamPlanText.js";
import { readFixture } from "./readFixture.js";

const SHIPPED_ARTIFACT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../public/exams/HS26.json",
);

describe("golden file", () => {
  it("rebuilds the artifact shipped in public/exams, byte for byte", () => {
    const plan = buildExamPlan(
      parseExamPlanText(readFixture("winter-2027.txt")),
      JSON.parse(readFixture("winter-2027.byod.json")),
    );
    expect(readFileSync(SHIPPED_ARTIFACT, "utf8")).toBe(toArtifactJson(plan));
  });
});
