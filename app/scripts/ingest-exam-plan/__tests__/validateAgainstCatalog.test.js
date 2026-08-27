import { describe, expect, it } from "vitest";

import { buildExamPlan } from "../buildExamPlan.js";
import { parseExamPlanText } from "../parseExamPlanText.js";
import {
  courseNumberToRoot,
  validateAgainstCatalog,
} from "../validateAgainstCatalog.js";
import { SOURCE_FILE, readFixture, readSnippet } from "./readFixture.js";

const catalog = JSON.parse(readFixture("catalog-hs26.sample.json"));
const plan = buildExamPlan(parseExamPlanText(readFixture("winter-2027.txt")), {
  semester: "HS26",
  sourceFile: SOURCE_FILE,
});
const diff = validateAgainstCatalog(plan, catalog);
const roots = (entries) => entries.map((entry) => entry.root);

describe("courseNumberToRoot", () => {
  it("keeps the two segments the exam plan prints", () => {
    expect(courseNumberToRoot("3,200,1.00")).toBe("3,200");
  });

  it("maps a course and its exercise group to the same root", () => {
    expect(courseNumberToRoot("3,200,2.00")).toBe(courseNumberToRoot("3,200,1.00"));
  });
});

describe("validateAgainstCatalog", () => {
  it("lists central courses with no exam — the check that finds a dropped exam", () => {
    expect(roots(diff.centralCoursesWithoutExam)).toEqual(["7,999"]);
    expect(diff.centralCoursesWithoutExam[0].shortName).toBe("Wirtschaftsethik");
  });

  it("counts an exercise group only once", () => {
    expect(diff.centralCourseCount).toBe(10);
  });

  it("ignores decentral courses, which never appear in a central exam plan", () => {
    expect(roots(diff.centralCoursesWithoutExam)).not.toContain("8,110");
  });

  it("counts an oral exam as coverage", () => {
    expect(roots(diff.centralCoursesWithoutExam)).not.toContain("7,421");
  });

  it("reports coverage as a percentage of the central courses", () => {
    expect(diff.coveragePercent).toBe(90);
  });

  it("lists exams whose root is missing from the catalog", () => {
    expect(roots(diff.examsWithoutCourse)).toContain("3,120");
    expect(roots(diff.examsWithoutCourse)).not.toContain("3,200");
  });

  it("ignores alternative-date exams, which repeat a regular course", () => {
    expect(roots(diff.examsWithoutCourse)).not.toContain("2,805");
  });

  it("tolerates the { data: [...] } wrapper of a DevTools export", () => {
    expect(validateAgainstCatalog(plan, { data: catalog })).toEqual(diff);
  });

  it("never throws, whatever the snapshot turns out to be", () => {
    for (const junk of [null, {}, "", 42, { data: "nope" }]) {
      expect(validateAgainstCatalog(plan, junk).centralCourseCount).toBe(0);
    }
  });

  it("reports zero coverage rather than dividing by an empty catalog", () => {
    expect(validateAgainstCatalog(plan, []).coveragePercent).toBe(0);
  });

  it("works on a plan that only has a written page", () => {
    const small = buildExamPlan(
      parseExamPlanText(readSnippet("written-page.txt")),
      { semester: "HS26", sourceFile: SOURCE_FILE },
    );
    expect(roots(validateAgainstCatalog(small, catalog).centralCoursesWithoutExam))
      .toContain("7,254");
  });
});
