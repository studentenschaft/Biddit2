// The golden test pins the whole HS26 artifact; these cover what it cannot.
import { describe, expect, it } from "vitest";

import { buildExamPlan } from "../buildExamPlan.js";
import { parseExamPlanText } from "../parseExamPlanText.js";
import { readFixture } from "./readFixture.js";

const parsed = parseExamPlanText(readFixture("winter-2027.txt"));
const plan = buildExamPlan(parsed);
const withTitle = (termLabel) => buildExamPlan({ ...parsed, termLabel });
const find = (exams, root) =>
  exams.find((exam) => exam.rootNumbers.includes(root));

describe("buildExamPlan", () => {
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

  it("derives the semester from the exam period in the plan's title", () => {
    expect(withTitle("Winter 2000").semester).toBe("HS99");
    expect(withTitle("Sommer 2027").semester).toBe("FS27");
    expect(withTitle("Summer 2027").semester).toBe("FS27");
  });

  it("refuses a title it cannot map to a semester", () => {
    expect(() => withTitle("Herbst 2026")).toThrow(/Cannot derive the semester/);
  });
});
