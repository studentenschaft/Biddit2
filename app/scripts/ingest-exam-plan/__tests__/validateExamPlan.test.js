import { describe, expect, it } from "vitest";

import { buildExamPlan } from "../buildExamPlan.js";
import { parseExamPlanText } from "../parseExamPlanText.js";
import { validateExamPlan } from "../validateExamPlan.js";
import {
  HEADER,
  TABLE_HEADER,
  TWO_SLOT_ROW,
  readFixture,
} from "./readFixture.js";

const build = (text) => buildExamPlan(parseExamPlanText(text));

const raw = readFixture("winter-2027.txt");
const published = build(raw);
const codes = (findings) => findings.map((finding) => finding.code);

/** Validates a clone of the real plan after `mutate` has broken it. */
const validateBroken = (mutate) => {
  const plan = structuredClone(published);
  mutate(plan);
  return codes(validateExamPlan(plan, raw).errors);
};

describe("validateExamPlan — the plan as published", () => {
  const { errors, warnings, stats } = validateExamPlan(published, raw);

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

  it("repeats the PDF's own warning that the AT plan is incomplete", () => {
    expect(codes(warnings)).toEqual(["W_AT_INCOMPLETE"]);
  });
});

describe("validateExamPlan — one broken plan per error code", () => {
  it("E_COUNT_MISMATCH when an exam row is dropped on the floor", () => {
    expect(validateBroken((plan) => plan.written.pop())).toContain(
      "E_COUNT_MISMATCH",
    );
  });

  it("E_UNCONSUMED_LINE when a table row is not an exam and not a gutter", () => {
    const stray = `${HEADER}
${TABLE_HEADER}
${TWO_SLOT_ROW}
           Fortsetzung der Liste auf der naechsten Seite
`;
    expect(codes(validateExamPlan(build(stray), stray).errors)).toEqual([
      "E_UNCONSUMED_LINE",
    ]);
  });

  it("E_DATE_OUT_OF_PERIOD for an exam outside the exam period", () => {
    expect(
      validateBroken((plan) => {
        plan.written[0].date = "2027-03-01";
      }),
    ).toContain("E_DATE_OUT_OF_PERIOD");
  });

  it("E_DUPLICATE_EXAM when the same exam appears twice", () => {
    expect(
      validateBroken((plan) => {
        plan.written.push(structuredClone(plan.written[0]));
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

  it("E_TITLE_BLEED when a right-hand title or unknown entry runs into a left title", () => {
    // No real title holds even two spaces in a row; the column gap does.
    const swallowed = `${HEADER}
${TABLE_HEADER}
${TWO_SLOT_ROW} and
Montag /   BA: OT EN  90'  3,202 Microeconomics II          Privacy Engineering
           BA: OT DE 120'  3,802 Deutsch C1                 DS: OT DE  90' 5,500 Aktienrecht
`;
    expect(codes(validateExamPlan(build(swallowed), swallowed).errors)).toEqual([
      "E_TITLE_BLEED",
      "E_TITLE_BLEED",
    ]);
  });

  it("E_DURATION_OUT_OF_RANGE for a duration outside 30–240 minutes", () => {
    const misread = `${HEADER}
${TABLE_HEADER}
18.01.2027 BA: OT DE  20'  3,200 Mikroökonomik II           MA: OT EN 600' 1,908 Linear Algebra
Montag /   BA: OT EN  30'  3,202 Microeconomics II          MA: OT EN 240' 1,909 Analysis
`;
    expect(codes(validateExamPlan(build(misread), misread).errors)).toEqual([
      "E_DURATION_OUT_OF_RANGE",
      "E_DURATION_OUT_OF_RANGE",
    ]);
  });

  it("E_ORAL_EXAM_IN_NOTE when an oral row the parser missed lands in the notes", () => {
    // Nothing counts oral rows, so a row shape the parser does not know (a
    // level prefix, a dotted root) would otherwise vanish into the notes.
    const oral = `${HEADER}
${TABLE_HEADER}
${TWO_SLOT_ROW}
\fMündliche Prüfungen / Oral examinations: 30.01. - 20.02.2027
30.01.2027       Ordentliche Prüfungstermine / Regular examination dates
Samstag /        MA: 7,421 Datenschutzrecht
Saturday         7.436 Internationale Schiedsgerichtsbarkeit
                 7,702 Recht und Psychologie
`;
    expect(codes(validateExamPlan(build(oral), oral).errors)).toEqual([
      "E_ORAL_EXAM_IN_NOTE",
      "E_ORAL_EXAM_IN_NOTE",
    ]);
  });
});
