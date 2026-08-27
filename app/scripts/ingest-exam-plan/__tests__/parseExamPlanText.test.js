import { describe, expect, it } from "vitest";

import {
  PAGE_KIND,
  findAfternoonColumn,
  parseExamPlanText,
  splitPages,
} from "../parseExamPlanText.js";
import { readFixture, readSnippet } from "./readFixture.js";

const plan = readFixture("winter-2027.txt");
const page = readSnippet("written-page.txt");
const oral = readSnippet("oral-page.txt");

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

  it("falls back to the page banners when the form feeds are lost", () => {
    const kinds = splitPages(readSnippet("no-form-feed.txt")).map(
      (split) => split.kind,
    );
    expect(kinds).toEqual([PAGE_KIND.written, PAGE_KIND.oral]);
  });
});

describe("findAfternoonColumn", () => {
  it("derives a different boundary for every page of the real plan", () => {
    const boundaries = splitPages(plan)
      .filter((split) => split.kind === PAGE_KIND.written)
      .map((split) => findAfternoonColumn(split.text));
    expect(boundaries).toEqual([151, 119, 123]);
  });

  it("falls back to the 15.15 label when only one slot label is present", () => {
    const exams = parseExamPlanText(
      readSnippet("written-fallback-boundary.txt"),
    ).written;
    expect(find(exams, "1,908").slot).toBe("15:15");
  });

  it("throws rather than guess when no boundary can be derived", () => {
    expect(() =>
      parseExamPlanText(readSnippet("written-no-boundary.txt")),
    ).toThrow(/Cannot locate the 15:15 column/);
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
    const mixed = `${page}Kompetenzcenter Planung und Prüfungen   19.08.2026   Seite 2 von 2\n`;
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

  it("drops an exam row that has no date and says so", () => {
    const parsedSnippet = parseExamPlanText(
      readSnippet("written-entry-before-date.txt"),
    );
    expect(parsedSnippet.written).toHaveLength(1);
    expect(codes(parsedSnippet.warnings)).toEqual(["W_ENTRY_WITHOUT_DATE"]);
  });

  it("warns when the two slot columns almost touch", () => {
    expect(
      codes(parseExamPlanText(readSnippet("written-tight-columns.txt")).warnings),
    ).toEqual(["W_COLUMN_CLUSTER_TIGHT"]);
  });

  it("stays silent about the columns of the real plan", () => {
    expect(codes(parsed.warnings)).toEqual([]);
  });
});

describe("parseExamPlanText — oral page", () => {
  const parsed = parseExamPlanText(plan);

  it("reads the dated oral exams", () => {
    expect(parsed.oral).toHaveLength(3);
    expect(parsed.oral[0]).toEqual({
      date: "2027-01-30",
      section: "Ordentliche Prüfungstermine / Regular examination dates",
      rootNumbers: ["7,421"],
      title: "Datenschutzrecht",
    });
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

  it("tells the two 08.02. blocks apart by their section", () => {
    const sections = new Set(
      parsed.oralNotes
        .filter((note) => note.date === "2027-02-08")
        .map((note) => note.section),
    );
    expect([...sections]).toEqual([
      "Ordentliche Prüfungstermine / Regular examination dates",
      "Ausserordentliche Prüfungstermine / Alternative examination dates",
    ]);
  });

  it("carries the section forward to a date row that has none", () => {
    const notes = parsed.oralNotes.filter((note) => note.date === "2027-02-20");
    expect(notes[0].section).toBe(
      "Ausserordentliche Prüfungstermine / Alternative examination dates",
    );
  });

  it("keeps the oral page table header and footer out of the notes", () => {
    const texts = parseExamPlanText(oral).oralNotes.map((note) => note.text);
    expect(texts.some((text) => text.startsWith("Beginning of"))).toBe(false);
    expect(texts.some((text) => text.startsWith("Kompetenzcenter"))).toBe(false);
  });
});
