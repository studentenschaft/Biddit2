import { describe, expect, it } from "vitest";

import { buildExamPlan } from "../buildExamPlan.js";
import { parseExamPlanText } from "../parseExamPlanText.js";
import { validateExamPlan } from "../validateExamPlan.js";
import { SOURCE_FILE, readFixture, readSnippet } from "./readFixture.js";

const build = (text) =>
  buildExamPlan(parseExamPlanText(text), {
    semester: "HS26",
    sourceFile: SOURCE_FILE,
  });

const snippet = readSnippet("written-page.txt");
const codes = (findings) => findings.map((finding) => finding.code);

/** Validates a clone of the snippet plan after `mutate` has broken it. */
const validateBroken = (mutate) => {
  const plan = structuredClone(build(snippet));
  mutate(plan);
  return codes(validateExamPlan(plan, snippet).errors);
};

describe("validateExamPlan — the plan as published", () => {
  const raw = readFixture("winter-2027.txt");
  const { errors, warnings, stats } = validateExamPlan(build(raw), raw);

  it("finds nothing wrong with the real plan", () => {
    expect(errors).toEqual([]);
  });

  it("counts what the runbook asks the reviewer to eyeball", () => {
    expect(stats).toEqual({
      writtenCount: 178,
      oralCount: 3,
      oralNoteCount: 12,
      dateCount: 15,
      byodCount: 2,
      bySlot: { "09:15": 104, "15:15": 74 },
      byTermType: { OT: 130, AT: 48 },
      byDurationMin: { 60: 11, 90: 64, 120: 91, 150: 6, 180: 6 },
    });
  });

  it("always says that BYOD is a lower bound", () => {
    expect(codes(warnings)).toContain("W_BYOD_GLYPH_LOST");
  });

  it("repeats the PDF's own warning that the AT plan is incomplete", () => {
    expect(codes(warnings)).toContain("W_AT_INCOMPLETE");
  });

  it("reports that the oral exams still have no times", () => {
    expect(codes(warnings)).toContain("W_ORAL_NO_TIMES");
  });

  it("lists the cross-listed pairs whose suffixes disagree", () => {
    const shapes = warnings.filter(
      (warning) => warning.code === "W_ROOT_SHAPE",
    );
    expect(shapes).toHaveLength(9);
    expect(shapes[0].context).toContain("3,874 | 4,872");
  });
});

describe("validateExamPlan — one broken plan per error code", () => {
  it("E_COUNT_MISMATCH when an exam row is dropped on the floor", () => {
    expect(validateBroken((plan) => plan.written.pop())).toContain(
      "E_COUNT_MISMATCH",
    );
  });

  it("E_UNCONSUMED_LINE when a table row is not an exam and not a gutter", () => {
    const stray = readSnippet("written-stray-row.txt");
    expect(codes(validateExamPlan(build(stray), stray).errors)).toEqual([
      "E_UNCONSUMED_LINE",
    ]);
  });

  it("E_DATE_INVALID for a date that is not on the calendar", () => {
    expect(
      validateBroken((plan) => {
        plan.written[0].date = "2027-02-30";
      }),
    ).toContain("E_DATE_INVALID");
  });

  it("E_DATE_OUT_OF_PERIOD for an exam outside the exam period", () => {
    expect(
      validateBroken((plan) => {
        plan.written[0].date = "2027-03-01";
      }),
    ).toContain("E_DATE_OUT_OF_PERIOD");
  });

  it("E_ISO_MISMATCH when startIso disagrees with date and slot", () => {
    expect(
      validateBroken((plan) => {
        plan.written[0].startIso = "2027-01-18T09:15:00+02:00";
      }),
    ).toContain("E_ISO_MISMATCH");
  });

  it("E_DUPLICATE_EXAM when one course has two exams of the same term type", () => {
    expect(
      validateBroken((plan) => {
        const copy = structuredClone(plan.written[0]);
        copy.id = `${copy.id}-copy`;
        plan.written.push(copy);
      }),
    ).toContain("E_DUPLICATE_EXAM");
  });

  it("E_TITLE_EMPTY for an exam without a title", () => {
    expect(
      validateBroken((plan) => {
        plan.written[0].title = "";
      }),
    ).toContain("E_TITLE_EMPTY");
  });

  it("E_TITLE_BLEED when page furniture ends up in a title", () => {
    expect(
      validateBroken((plan) => {
        plan.written[0].title = "Prüfungsbeginn (schriftl.): 09.15 Uhr";
      }),
    ).toContain("E_TITLE_BLEED");
  });

  it("E_TITLE_BLEED when another entry is swallowed into a title", () => {
    // A root the entry regex cannot see leaves its whole row — or its
    // cross-listed tail — inside the previous title; the count and residue
    // checks cannot see that, so this one must.
    expect(
      validateBroken((plan) => {
        plan.written[0].title = "Mikroökonomik II       AJ: OT EN 120'";
      }),
    ).toContain("E_TITLE_BLEED");
    expect(
      validateBroken((plan) => {
        plan.written[0].title = "| 114,802 Deutsch C1";
      }),
    ).toContain("E_TITLE_BLEED");
  });

  it("E_SEMESTER_MISMATCH when the key contradicts the plan's own title", () => {
    // "Winter 2027" can only be HS26; a typo like FS30 must not ship a whole
    // semester's dates under the wrong key.
    expect(
      validateBroken((plan) => {
        plan.semester = "FS30";
      }),
    ).toContain("E_SEMESTER_MISMATCH");
  });

  it("allows a two-part exam on different dates, same root and term type", () => {
    expect(
      validateBroken((plan) => {
        const second = structuredClone(plan.written[0]);
        second.id = `${second.id}-part-2`;
        second.date = "2027-01-19";
        second.startIso = "2027-01-19T09:15:00+01:00";
        plan.written.push(second);
      }),
    ).not.toContain("E_DUPLICATE_EXAM");
  });

  it("E_SEMESTER_FORMAT for a semester key of the wrong shape", () => {
    expect(
      validateBroken((plan) => {
        plan.semester = "HS2026";
      }),
    ).toContain("E_SEMESTER_FORMAT");
  });

  it("E_PERIOD_ORDER when a period ends before it starts", () => {
    expect(
      validateBroken((plan) => {
        plan.examPeriod = { start: "2027-02-20", end: "2027-01-18" };
      }),
    ).toContain("E_PERIOD_ORDER");
  });
});
