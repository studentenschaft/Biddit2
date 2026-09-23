// The golden test pins the whole HS26 artifact; these cover what it cannot.
import { describe, expect, it } from "vitest";

import { buildExamPlan } from "../buildExamPlan.js";
import { parseExamPlanText } from "../parseExamPlanText.js";
import { readFixture } from "./readFixture.js";

const parsed = parseExamPlanText(readFixture("winter-2027.txt"));
const plan = buildExamPlan(parsed, {});
const withTitle = (termLabel) => buildExamPlan({ ...parsed, termLabel }, {});
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

  it("marks an exam BYOD when one of its roots is shaded in its row", () => {
    // 3,802 | 4,802 has an AT and an OT row on page 1.
    const shaded = buildExamPlan(parsed, {
      1: { OT: ["3,200", "4,802"] },
    });
    expect(find(shaded.written, "3,200").byod).toBe(true);
    const crossListed = shaded.written.filter((exam) =>
      exam.rootNumbers.includes("3,802"),
    );
    expect(crossListed.map((exam) => [exam.termType, exam.byod])).toEqual([
      ["AT", undefined],
      ["OT", true],
    ]);
    expect(find(shaded.written, "3,202")).not.toHaveProperty("byod");
  });

  it("does not mark an exam whose root is shaded on another page", () => {
    const elsewhere = buildExamPlan(parsed, { 2: { OT: ["3,200"] } });
    expect(find(elsewhere.written, "3,200")).not.toHaveProperty("byod");
  });

  it("marks an exam whose title says (BYOD) without any shading", () => {
    expect(find(plan.written, "3,140").byod).toBe(true);
  });

  it("omits byod unless the exam is marked", () => {
    expect(find(plan.written, "3,200")).not.toHaveProperty("byod");
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
