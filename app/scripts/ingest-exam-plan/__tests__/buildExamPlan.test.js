import { describe, expect, it } from "vitest";

import { SCHEMA_VERSION, buildExamPlan } from "../buildExamPlan.js";
import { parseExamPlanText } from "../parseExamPlanText.js";
import { SOURCE_FILE, readFixture, readSnippet } from "./readFixture.js";

const build = (text, options = {}) =>
  buildExamPlan(parseExamPlanText(text), {
    semester: "HS26",
    sourceFile: SOURCE_FILE,
    ...options,
  });

const plan = build(readFixture("winter-2027.txt"));
const find = (exams, root) =>
  exams.find((exam) => exam.rootNumbers.includes(root));

describe("buildExamPlan", () => {
  it("stamps the schema version and the provenance it was given", () => {
    expect(plan.schemaVersion).toBe(SCHEMA_VERSION);
    expect(plan.semester).toBe("HS26");
    expect(plan.sourceTermLabel).toBe("Winter 2027");
    expect(plan.source).toEqual({
      file: SOURCE_FILE,
      publishedAt: "2026-08-18",
    });
  });

  it("refuses to invent the semester key", () => {
    expect(() => build(readSnippet("written-page.txt"), { semester: undefined })).toThrow(
      /never inferred/,
    );
  });

  it("derives startIso from the date and the slot in Europe/Zurich", () => {
    expect(find(plan.written, "3,200").startIso).toBe(
      "2027-01-18T09:15:00+01:00",
    );
    expect(find(plan.written, "1,908").startIso).toBe(
      "2027-01-18T15:15:00+01:00",
    );
  });

  it("builds ids from term type, date, slot and roots", () => {
    const crossListed = plan.written.filter((exam) =>
      exam.rootNumbers.includes("3,802"),
    );
    expect(crossListed.map((exam) => exam.id)).toEqual([
      "AT-2027-01-19-0915-3,802|4,802",
      "OT-2027-01-19-0915-3,802|4,802",
    ]);
  });

  it("omits byod unless the exam is marked", () => {
    expect(find(plan.written, "3,200")).not.toHaveProperty("byod");
    expect(find(plan.written, "3,140").byod).toBe(true);
  });

  it("sorts written exams by date, slot, root and term type", () => {
    const keys = plan.written.map(
      (exam) => `${exam.date} ${exam.slot} ${exam.rootNumbers[0]} ${exam.termType}`,
    );
    expect(keys).toEqual([...keys].sort());
  });

  it("produces the same artifact on every run", () => {
    expect(build(readFixture("winter-2027.txt"))).toEqual(plan);
  });

  it("leaves oral exams without a start time and says why", () => {
    expect(plan.oral[0]).toEqual({
      id: "ORAL-2027-01-30-7,421",
      date: "2027-01-30",
      startIso: null,
      timesPublishedLater: true,
      section: "Ordentliche Prüfungstermine / Regular examination dates",
      rootNumbers: ["7,421"],
      title: "Datenschutzrecht",
    });
  });

  it("keeps the narrative oral rows so the artifact stays a full copy of the PDF", () => {
    expect(plan.oralNotes).toHaveLength(12);
  });
});
