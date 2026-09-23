import { describe, expect, it } from "vitest";

import {
  PAGE_KIND,
  parseExamPlanText,
  splitPages,
} from "../parseExamPlanText.js";
import {
  HEADER,
  TABLE_HEADER,
  TWO_SLOT_ROW,
  readFixture,
} from "./readFixture.js";

const plan = readFixture("winter-2027.txt");

const codes = (warnings) => warnings.map((warning) => warning.code);
const find = (exams, root) =>
  exams.find((exam) => exam.rootNumbers.includes(root));

describe("splitPages", () => {
  it("splits the real plan into three written pages and one oral page", () => {
    const kinds = splitPages(plan).map((split) => split.kind);
    expect(kinds).toEqual([
      PAGE_KIND.written,
      PAGE_KIND.written,
      PAGE_KIND.written,
      PAGE_KIND.oral,
    ]);
  });

  it("keeps the page numbers of the PDF, so findings can be looked up", () => {
    expect(splitPages(plan).map((split) => split.number)).toEqual([1, 2, 3, 4]);
  });

  it("throws on a page without a banner that still lists courses", () => {
    // An oral list continued on a page without the banner would otherwise be
    // dropped, and nothing counts oral rows.
    const continued = `${HEADER}
${TABLE_HEADER}
${TWO_SLOT_ROW}
\fDatum
30.01.2027       7,702 Recht und Psychologie
`;
    expect(() => splitPages(continued)).toThrow(
      "no written or oral banner but lists course 7,702 — page 2",
    );
  });
});

describe("parseExamPlanText — start times", () => {
  const LABEL = (time) => `Prüfungsbeginn (schriftl.): ${time} Uhr`;

  it("stamps the exams with the start times the header prints", () => {
    const shifted = parseExamPlanText(`${HEADER}
${TABLE_HEADER.replace("09.15", "08.15").replace("15.15", "14.15")}
${TWO_SLOT_ROW}
`);
    expect(find(shifted.written, "3,200").slot).toBe("08:15");
    expect(find(shifted.written, "1,908").slot).toBe("14:15");
  });

  it("gives every exam the one start time a header prints", () => {
    // The alternative-date plans are mostly morning exams, so a page may
    // well print a single start time.
    const morningOnly = parseExamPlanText(`${HEADER}
Datum      ${LABEL("09.15")}
18.01.2027 BA: OT DE  90'  3,200 Mikroökonomik II
Montag /   BA: OT EN  90'  3,202 Microeconomics II
`);
    expect(morningOnly.written.map((exam) => exam.slot)).toEqual([
      "09:15",
      "09:15",
    ]);
  });

  it("keeps a two-time page whose exams all use one start time", () => {
    const oneColumn = parseExamPlanText(`${HEADER}
${TABLE_HEADER}
18.01.2027 BA: OT DE  90'  3,200 Mikroökonomik II
Montag /   BA: OT EN  90'  3,202 Microeconomics II
`);
    expect(oneColumn.written.map((exam) => exam.slot)).toEqual([
      "09:15",
      "09:15",
    ]);
  });

  it("throws when the header prints no start time", () => {
    const noLabel = `${HEADER}
Datum      Beginn 09.15 Uhr
${TWO_SLOT_ROW}
`;
    expect(() => parseExamPlanText(noLabel)).toThrow(
      "Cannot read the start times — page 1 line 4: expected one or two ascending",
    );
  });

  it("throws on a third start-time column", () => {
    const threeLabels = `${HEADER}
${TABLE_HEADER}      ${LABEL("18.15")}
${TWO_SLOT_ROW}
`;
    expect(() => parseExamPlanText(threeLabels)).toThrow(
      /found 09:15, 15:15, 18:15$/,
    );
  });

  it("throws when the later start time is printed on the left", () => {
    const swapped = `${HEADER}
Datum      ${LABEL("15.15")}            ${LABEL("09.15")}
${TWO_SLOT_ROW}
`;
    expect(() => parseExamPlanText(swapped)).toThrow(/found 15:15, 09:15$/);
  });

  it("throws on an exam that starts halfway between the two labels", () => {
    // Real entries start within one column of their label; one this far from
    // both could belong to either start time.
    const ambiguous = `${HEADER}
${TABLE_HEADER}
${TWO_SLOT_ROW}
${"Montag /".padEnd(36)}BA: OT EN  90'  3,202 Microeconomics II
`;
    expect(() => parseExamPlanText(ambiguous)).toThrow(
      "Exam does not start under a start-time label — page 1 line 6: column 36, labels at 11, 60",
    );
  });

  it("throws on an exam in a column the header gives no start time for", () => {
    // A second label the regex cannot read must not put the afternoon
    // exams under the morning time.
    const unlabelled = `${HEADER}
Datum      ${LABEL("09.15")}            Beginn (schriftl.): 15.15 Uhr
${TWO_SLOT_ROW}
`;
    expect(() => parseExamPlanText(unlabelled)).toThrow(
      "Exam does not start under a start-time label — page 1 line 5: column 60, labels at 11",
    );
  });

  it("places the rows under a second table header by that header's labels", () => {
    const secondTable = parseExamPlanText(`${HEADER}
${TABLE_HEADER}
${TWO_SLOT_ROW}
${"Datum".padEnd(60)}${LABEL("09.15").padEnd(80)}${LABEL("15.15")}
${"19.01.2027".padEnd(60)}BA: OT DE 120'  3,802 Deutsch C1
`);
    expect(find(secondTable.written, "3,802").slot).toBe("09:15");
  });

  it("throws when two table headers on a page print different start times", () => {
    const disagreeing = `${HEADER}
${TABLE_HEADER}
${TWO_SLOT_ROW}
${TABLE_HEADER.replace("15.15", "14.15")}
`;
    expect(() => parseExamPlanText(disagreeing)).toThrow(
      "Table headers disagree on the start times — page 1 line 6: 09:15, 14:15 after 09:15, 15:15",
    );
  });
});

describe("parseExamPlanText — header and footers", () => {
  it("reads the term label and the exam period", () => {
    const parsed = parseExamPlanText(plan);
    expect(parsed.termLabel).toBe("Winter 2027");
    expect(parsed.examPeriod).toEqual({
      start: "2027-01-18",
      end: "2027-02-20",
    });
  });

  it("reads the oral exam period from the oral page banner", () => {
    expect(parseExamPlanText(plan).oralExamPeriod).toEqual({
      start: "2027-01-30",
      end: "2027-02-20",
    });
  });

  it("reads the revision date from the page footers", () => {
    expect(parseExamPlanText(plan).publishedAt).toBe("2026-08-18");
  });

  it("warns when pages carry different revision dates", () => {
    const mixed = `${plan}\nKompetenzcenter Planung und Prüfungen   19.08.2026   Seite 5 von 5\n`;
    expect(codes(parseExamPlanText(mixed).warnings)).toContain(
      "W_PUBLISHED_AT_MIXED",
    );
  });

  it("throws when the plan header is missing", () => {
    expect(() =>
      parseExamPlanText(
        "Mündliche Prüfungen / Oral examinations: 30.01. - 20.02.2027",
      ),
    ).toThrow(/Cannot read the plan header/);
  });

  it("throws when the exam period in the header is not on the calendar", () => {
    const impossible = `${HEADER.replace("20.02.2027", "30.02.2027")}
${TABLE_HEADER}
${TWO_SLOT_ROW}
`;
    expect(() => parseExamPlanText(impossible)).toThrow(
      "Not a calendar date — plan header: 30.02.2027",
    );
  });

  it("throws when no page footer carries the revision date", () => {
    const reworded = `${HEADER.replace("Seite 1 von 1", "Seite 1/1")}
${TABLE_HEADER}
${TWO_SLOT_ROW}
`;
    expect(() => parseExamPlanText(reworded)).toThrow(
      /Cannot read the revision date/,
    );
  });

  it("throws when an oral page is present but its period cannot be read", () => {
    const enDash = `${HEADER}
${TABLE_HEADER}
${TWO_SLOT_ROW}
\fMündliche Prüfungen / Oral examinations: 30.01. – 20.02.2027
`;
    expect(() => parseExamPlanText(enDash)).toThrow(
      /Cannot read the oral exam period/,
    );
  });
});

describe("parseExamPlanText — written rows", () => {
  const parsed = parseExamPlanText(plan);

  it("keeps every exam row of the plan", () => {
    expect(parsed.written).toHaveLength(178);
  });

  it("reads level, term type, language and duration", () => {
    expect(find(parsed.written, "3,200")).toMatchObject({
      level: "BA",
      termType: "OT",
      language: "DE",
      durationMin: 90,
      title: "Mikroökonomik II",
    });
  });

  it("dates the exams that share the date row", () => {
    expect(find(parsed.written, "3,200").date).toBe("2027-01-18");
  });

  it("carries the date forward to the rows below it", () => {
    expect(find(parsed.written, "3,502").date).toBe("2027-01-21");
  });

  it("reads a date row that is indented", () => {
    // Missed, it would leave the whole day under the previous date.
    const indented = parseExamPlanText(`${HEADER}
${TABLE_HEADER}
${TWO_SLOT_ROW}
 19.01.2027 BA: OT DE 120'  3,802 Deutsch C1
`);
    expect(find(indented.written, "3,802").date).toBe("2027-01-19");
  });

  it("splits a line that carries a morning and an afternoon exam", () => {
    expect(find(parsed.written, "3,200").slot).toBe("09:15");
    expect(find(parsed.written, "1,908").slot).toBe("15:15");
  });

  it("splits cross-listed course roots", () => {
    expect(find(parsed.written, "3,802").rootNumbers).toEqual([
      "3,802",
      "4,802",
    ]);
  });

  it("keeps cross-listed roots whose suffixes differ", () => {
    expect(find(parsed.written, "3,874").rootNumbers).toEqual([
      "3,874",
      "4,872",
    ]);
  });

  it("parses roots with two-digit prefixes wherever they sit", () => {
    // The catalog has numbers like "11,702,1.00" — a root the entry regex
    // cannot see is dropped silently, so the width must not be assumed.
    const wide = parseExamPlanText(`${HEADER}
${TABLE_HEADER}
18.01.2027 BA: OT DE  90'  3,200 Mikroökonomik II           MA: OT EN 120' 11,702 Digital Business
Montag /   MA: OT DE  90'  3,802 | 14,802 Deutsch C1
`);
    expect(wide.written).toHaveLength(3);
    expect(find(wide.written, "11,702").slot).toBe("15:15");
    expect(find(wide.written, "3,802").rootNumbers).toEqual([
      "3,802",
      "14,802",
    ]);
    expect(find(wide.written, "3,200").title).toBe("Mikroökonomik II");
  });

  it("assigns an entry that starts left of its label to that label's column", () => {
    // Right-column entries start at exactly their label's column, so a
    // boundary on the label itself has no margin for a one-column shift.
    const shifted = parseExamPlanText(`${HEADER}
${TABLE_HEADER}
${TWO_SLOT_ROW.replace("  MA: OT", " MA: OT")}
`);
    expect(find(shifted.written, "1,908").slot).toBe("15:15");
  });

  it("records the page each exam is printed on", () => {
    // BYOD comes from the page's shading, matched by page, term type and root.
    expect(find(parsed.written, "3,200").page).toBe(1);
    expect(find(parsed.written, "3,140").page).toBe(3);
  });

  it("reads alternative-date rows as their own exams", () => {
    const alternative = parsed.written.filter((exam) => exam.termType === "AT");
    expect(alternative).toHaveLength(48);
    expect(find(alternative, "4,120").title).toBe("Methods: Statistics");
  });

  it("flags the exams whose title spells out BYOD", () => {
    const byod = parsed.written.filter((exam) => exam.byod);
    expect(byod.map((exam) => exam.rootNumbers[0])).toEqual(["3,140", "4,140"]);
  });

  it("leaves byod false when the title says nothing", () => {
    expect(find(parsed.written, "3,200").byod).toBe(false);
  });

  it("trims the title at the next exam on the same line", () => {
    expect(find(parsed.written, "3,202").title).toBe("Microeconomics II");
  });

  it("keeps a title that runs to the end of the line intact", () => {
    expect(find(parsed.written, "7,254").title).toBe(
      "Adv. Macro II: Asset Prices, Fluctuations + Unempl.",
    );
  });

  it("ignores legends, notices and footers", () => {
    const titles = parsed.written.map((exam) => exam.title);
    expect(titles.some((title) => title.includes("Prüfungswoche"))).toBe(false);
    expect(titles.some((title) => title.includes("Kompetenzcenter"))).toBe(false);
  });

  it("throws on a date row that is not on the calendar, naming the line", () => {
    const dated = (date) => `${HEADER}
${TABLE_HEADER}
${TWO_SLOT_ROW.replace("18.01.2027", date)}
`;
    expect(() => parseExamPlanText(dated("18.13.2027"))).toThrow(
      "Not a calendar date — page 1 line 5: 18.13.2027",
    );
    expect(() => parseExamPlanText(dated("31.02.2027"))).toThrow(
      "Not a calendar date — page 1 line 5: 31.02.2027",
    );
  });

  it("throws on an exam row that has no date, naming where it sits", () => {
    const undated = `${HEADER}
${TABLE_HEADER}
           BA: OT DE  90'  3,200 Mikroökonomik II
18.01.2027 BA: OT EN  90'  3,202 Microeconomics II
`;
    expect(() => parseExamPlanText(undated)).toThrow(
      "page 1 line 5: BA: OT DE  90'  3,200 Mikroökonomik II",
    );
  });

  it("stays silent about the real plan", () => {
    expect(codes(parsed.warnings)).toEqual([]);
  });
});

describe("parseExamPlanText — oral page", () => {
  const parsed = parseExamPlanText(plan);
  const range = (item) => `${item.dateStart} … ${item.dateEnd}`;

  it("dates the oral exams with their block's whole range", () => {
    // The page prints "30.01.2027 … - … 06.02.2027" and no day within it.
    expect(parsed.oral).toHaveLength(3);
    expect(parsed.oral[0]).toEqual({
      dateStart: "2027-01-30",
      dateEnd: "2027-02-06",
      section: "Ordentliche Prüfungstermine / Regular examination dates",
      rootNumbers: ["7,421"],
      title: "Datenschutzrecht",
    });
    expect(new Set(parsed.oral.map(range))).toEqual(
      new Set(["2027-01-30 … 2027-02-06"]),
    );
  });

  it("strips the dash and weekday gutter from the exam rows", () => {
    expect(parsed.oral.map((exam) => exam.rootNumbers[0])).toEqual([
      "7,421",
      "7,436",
      "7,702",
    ]);
  });

  it("keeps the narrative rows as notes instead of dropping them", () => {
    expect(parsed.oralNotes).toHaveLength(12);
    expect(parsed.oralNotes[0].text).toMatch(/^Die individuellen mündlichen/);
  });

  it("files the rows at a range's closing date under the whole block", () => {
    // One entry per block: the closing row's text (Sprachen) relabels the
    // block's notes, and a bare closing row (13.02., 20.02.) keeps the label.
    const blocks = new Set(
      parsed.oralNotes.map((note) => `${range(note)} ${note.section}`),
    );
    expect([...blocks]).toEqual([
      "2027-01-30 … 2027-02-06 Sprachen / Languages (inkl. Ausserordentlicher Prüfungstermin aus Sommer 2026 / incl. alternative examination dates from Summer 2026)",
      "2027-02-08 … 2027-02-13 Ordentliche Prüfungstermine / Regular examination dates",
      "2027-02-08 … 2027-02-20 Ausserordentliche Prüfungstermine / Alternative examination dates",
    ]);
  });

  it("reads a '-' in the text column as a note, not as a range", () => {
    // Taken for the gutter dash, it would reopen the closed first block and
    // stretch its exams to the 08.02. row below.
    const lastNote =
      "The individual oral exam dates (incl. Room allocation) are available in Compass at the end of CW 50.";
    const dashNote = "- Details siehe Compass / see Compass for details";
    const withDashNote = parseExamPlanText(
      plan.replace(lastNote, `${lastNote}\n                 ${dashNote}`),
    );
    expect(new Set(withDashNote.oral.map(range))).toEqual(
      new Set(["2027-01-30 … 2027-02-06"]),
    );
    const note = withDashNote.oralNotes.find((each) => each.text === dashNote);
    expect(range(note)).toBe("2027-01-30 … 2027-02-06");
    expect(withDashNote.oralNotes.map(range)).toEqual([
      ...parsed.oralNotes.slice(0, 2).map(range),
      range(note),
      ...parsed.oralNotes.slice(2).map(range),
    ]);
  });

  /** The plan's oral page, cut down to the given rows. */
  const oralPlan = (rows) => `${HEADER}
${TABLE_HEADER}
${TWO_SLOT_ROW}
\fMündliche Prüfungen / Oral examinations: 30.01. - 20.02.2027
${rows}
`;

  it("dates a block without a '-' with its one day", () => {
    const { oral } = parseExamPlanText(
      oralPlan(`30.01.2027       Ordentliche Prüfungstermine / Regular examination dates
Samstag /        7,421 Datenschutzrecht
Saturday         7,436 Internationale Schiedsgerichtsbarkeit

08.02.2027       Ordentliche Prüfungstermine / Regular examination dates
Montag /         7,702 Recht und Psychologie`),
    );
    expect(oral.map(range)).toEqual([
      "2027-01-30 … 2027-01-30",
      "2027-01-30 … 2027-01-30",
      "2027-02-08 … 2027-02-08",
    ]);
  });

  it("throws when a range is never closed", () => {
    const unclosed = oralPlan(`30.01.2027       Ordentliche Prüfungstermine / Regular examination dates
Samstag /        7,421 Datenschutzrecht
-                7,436 Internationale Schiedsgerichtsbarkeit`);
    expect(() => parseExamPlanText(unclosed)).toThrow(
      "Oral date range is never closed — page 2 line 4",
    );
  });

  it("throws on a lone '-' that drifted out of the date gutter", () => {
    // Read as a note, it would leave the range unopened, and its closing
    // date row would open a block of its own.
    const drifted = oralPlan(`30.01.2027       Ordentliche Prüfungstermine / Regular examination dates
Samstag /        7,421 Datenschutzrecht
    -
06.02.2027
Saturday         7,436 Internationale Schiedsgerichtsbarkeit`);
    expect(() => parseExamPlanText(drifted)).toThrow(
      'A lone "-" sits outside the date gutter — page 2 line 4',
    );
  });

  it("reads a date in the text column as a note, not as a date row", () => {
    // Taken for a date row, it would open a block and move the exams below
    // it to that date.
    const { oral, oralNotes } = parseExamPlanText(
      oralPlan(`30.01.2027       Ordentliche Prüfungstermine / Regular examination dates
Samstag /        7,421 Datenschutzrecht
                 06.02.2027: Ersatztermin / make-up date
Saturday         7,436 Internationale Schiedsgerichtsbarkeit`),
    );
    expect(oral.map(range)).toEqual([
      "2027-01-30 … 2027-01-30",
      "2027-01-30 … 2027-01-30",
    ]);
    expect(oralNotes).toEqual([
      {
        dateStart: "2027-01-30",
        dateEnd: "2027-01-30",
        section: "Ordentliche Prüfungstermine / Regular examination dates",
        text: "06.02.2027: Ersatztermin / make-up date",
      },
    ]);
  });

  it("throws when a closed range is opened again", () => {
    // Allowed, the next block's date row would silently extend this one.
    const reopened = oralPlan(`30.01.2027       Ordentliche Prüfungstermine / Regular examination dates
Samstag /        7,421 Datenschutzrecht
-                7,436 Internationale Schiedsgerichtsbarkeit
06.02.2027
-
08.02.2027       Ordentliche Prüfungstermine / Regular examination dates
Montag /         7,702 Recht und Psychologie`);
    expect(() => parseExamPlanText(reopened)).toThrow(
      "Oral date range is opened again after its closing date — page 2 line 6",
    );
  });

  it("keeps the oral page table header and footer out of the notes", () => {
    const texts = parsed.oralNotes.map((note) => note.text);
    expect(texts.some((text) => text.startsWith("Beginning of"))).toBe(false);
    expect(texts.some((text) => text.startsWith("Kompetenzcenter"))).toBe(false);
  });
});
