import { describe, expect, it } from "vitest";

import { buildExamPlan } from "../buildExamPlan.js";
import { parseExamPlanText } from "../parseExamPlanText.js";
import { validateAgainstCatalog } from "../validateAgainstCatalog.js";
import { readFixture } from "./readFixture.js";

const catalog = [
  ["3,200,1.00", "Mikroökonomik II"],
  ["3,200,2.00", "Mikroökonomik II - Übung"],
  ["3,202,1.00", "Microeconomics II"],
  ["1,908,1.00", "Linear Algebra"],
  ["5,500,1.00", "Aktienrecht"],
  ["7,116,1.00", "Digital Auditing"],
  ["7,254,1.00", "Advanced Macroeconomics II"],
  ["7,421,1.00", "Datenschutzrecht"],
  ["3,900,1.00", "Entwurf von Softwaresystemen"],
  ["5,267,1.00", "Ökonomie des Glücks"],
  ["7,999,1.00", "Wirtschaftsethik"],
  ["8,110,1.00", "Seminar: Digitale Ethik", false],
].map(([courseNumber, shortName, isCentral = true]) => ({
  courseNumber,
  shortName,
  achievementFormStatus: { isCentral },
}));

const plan = buildExamPlan(parseExamPlanText(readFixture("winter-2027.txt")));
const diff = validateAgainstCatalog(plan, catalog);
const roots = (entries) => entries.map((entry) => entry.root);

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

  it("lists exams whose root is missing from the catalog", () => {
    expect(roots(diff.examsWithoutCourse)).toContain("3,120");
    expect(roots(diff.examsWithoutCourse)).not.toContain("3,200");
  });

  it("ignores AT rows, which are another semester's alternative dates", () => {
    expect(roots(diff.examsWithoutCourse)).not.toContain("2,805");
  });

  it("tolerates the { data: [...] } wrapper of a DevTools export", () => {
    expect(validateAgainstCatalog(plan, { data: catalog })).toEqual(diff);
  });
});
