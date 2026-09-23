// Hand-made snippets in the shape pdftocairo -svg and pdftotext -bbox-layout
// print; coordinates are taken from the Winter 2027 plan.
import { describe, expect, it } from "vitest";

import { parseByodShading } from "../parseByodShading.js";

// Not the real plan's colour: the shading colour must come from the legend.
const SHADE = "rgb(10%, 20%, 30%)";
const HEADER_BLUE = "rgb(86.299133%, 90.19928%, 94.499207%)";
const BLACK = "rgb(0%, 0%, 0%)";

const box = (fill, [x0, y0, x1, y1]) =>
  `<path fill-rule="nonzero" fill="${fill}" fill-opacity="1" d="M ${x0} ${y1} L ${x1} ${y1} L ${x1} ${y0} L ${x0} ${y0} Z M ${x0} ${y1} "/>`;
const word = (text, [x0, y0, x1, y1]) =>
  `<word xMin="${x0}" yMin="${y0}" xMax="${x1}" yMax="${y1}">${text}</word>`;

/** The swatch and the hairline border the plan draws around it. */
const SWATCH = [
  box(SHADE, [23.57, 131.38, 60.36, 138.21]),
  box(BLACK, [60.12, 131.62, 60.48, 138.33]),
];
const LEGEND = [
  word("=", [61.4, 131.27, 63.67, 137.37]),
  word("digitale", [64.76, 131.27, 78.55, 137.37]),
  word("Prüfungen", [79.64, 131.27, 99.07, 137.37]),
  word("(BYOD)", [100.16, 131.27, 113.54, 137.37]),
];

/**
 * An exam cell in table row `row` and the words of its exam, in the left-hand
 * column or shifted into the right-hand one.
 */
const RIGHT = 250.1;
const top = (row) => 173.09 + row * 6.11;
const cell = (fill, row, shift = 0) =>
  box(fill, [60.24 + shift, top(row), 310.46 + shift, top(row) + 6.23]);
const inRow = (row, x, text) =>
  word(text, [x, top(row) + 0.3, x + 17.9, top(row) + 5.9]);
const exam = (row, termType, roots, shift = 0) => [
  inRow(row, 72.56 + shift, termType),
  ...roots.map((root, index) => inRow(row, 98.4 + shift + index * 30, root)),
];

/** A one-page PDF renders as a bare <svg>, more pages as a <pageSet>. */
const svg = (...pages) =>
  pages.length === 1
    ? `<svg>${pages[0].join("\n")}</svg>`
    : `<svg><pageSet>${pages.map((paths) => `<page>${paths.join("\n")}</page>`).join("\n")}</pageSet></svg>`;
const wordBoxes = (...pages) =>
  `<doc>${pages.map((words) => `<page width="595.2" height="841.68"><flow><block><line>${words.join("\n")}</line></block></flow></page>`).join("\n")}</doc>`;

describe("parseByodShading", () => {
  it("lists the roots printed on the legend's colour, by page and term type", () => {
    const shaded = parseByodShading(
      svg([...SWATCH, cell(SHADE, 0), cell(HEADER_BLUE, 1)], [cell(SHADE, 3)]),
      wordBoxes(
        [
          ...LEGEND,
          ...exam(0, "OT", ["3,200"]),
          ...exam(1, "OT", ["3,202"]),
          ...exam(2, "OT", ["1,908"]),
        ],
        // The legend is read once for the whole plan, and a root's shading
        // on one page says nothing about another.
        [...exam(0, "OT", ["3,200"]), ...exam(3, "OT", ["3,802", "4,802"])],
      ),
    );
    expect(shaded).toEqual({
      1: { OT: ["3,200"] },
      2: { OT: ["3,802", "4,802"] },
    });
  });

  it("tells a shaded OT row from a plain AT row of the same roots", () => {
    // As 7,408 | 8,417 on page 2 of the Winter 2027 plan. A root takes the
    // term type of its own cell, not of the left-hand one; one without a term
    // type in its row (the oral page) is not a written exam.
    const shaded = parseByodShading(
      svg([...SWATCH, cell(SHADE, 0), cell(SHADE, 1, RIGHT), cell(SHADE, 2)]),
      wordBoxes([
        ...LEGEND,
        ...exam(0, "OT", ["7,408", "8,417"]),
        ...exam(1, "AT", ["7,408", "8,417"]),
        ...exam(1, "OT", ["3,900"], RIGHT),
        inRow(2, 98.4, "7,421"),
      ]),
    );
    expect(shaded).toEqual({ 1: { OT: ["3,900", "7,408", "8,417"] } });
  });

  it("marks nothing in a plan without the BYOD legend", () => {
    expect(
      parseByodShading(svg([cell(SHADE, 0)]), wordBoxes(exam(0, "OT", ["3,200"]))),
    ).toEqual({});
  });

  it("throws when the legend has no colour swatch", () => {
    expect(() =>
      parseByodShading(
        svg([cell(SHADE, 0)]),
        wordBoxes([...LEGEND, ...exam(0, "OT", ["3,200"])]),
      ),
    ).toThrow(
      'The BYOD legend has no colour swatch — page 1: nothing is filled just left of "= digitale Prüfungen (BYOD)"',
    );
  });

  it("throws when a root is shaded in one row and plain in another", () => {
    // An exam is matched by page, term type and root, so it could go either
    // way.
    expect(() =>
      parseByodShading(
        svg([...SWATCH, cell(SHADE, 0)]),
        wordBoxes([
          ...LEGEND,
          ...exam(0, "OT", ["3,814", "4,814"]),
          ...exam(1, "OT", ["3,814"]),
        ]),
      ),
    ).toThrow(
      "BYOD shading is ambiguous — page 1: OT 3,814 is shaded in one row and plain in another",
    );
  });
});
