/**
 * Reads which written exams the plan prints on BYOD shading. The PDF marks a
 * digital exam by filling its cell with the colour of the legend swatch, which
 * `pdftotext -layout` drops. `pdftocairo -svg` draws those fills as paths and
 * `pdftotext -bbox-layout` places every word, both in the same page
 * coordinates. Pure: no fs, no clock, no process.
 */

const LEGEND = ["=", "digitale", "Prüfungen", "(BYOD)"];
const PAGE_RE = /<page\b[^>]*>(.*?)<\/page>/gs;
const FILLED_PATH_RE = /<path\b[^>]*\bfill="([^"]+)"[^>]*\bd="([^"]+)"/g;
const WORD_RE =
  /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
const ROOT_WORD_RE = /^\d{1,2},\d{3}$/;
const TERM_TYPE_WORD_RE = /^(?:OT|AT)$/;

// The swatch ends about a point left of the legend's "=", behind a hairline
// border that ends there too; a few points further left is swatch only.
const SWATCH_SAMPLE_OFFSET = 4;

const pagesOf = (markup) =>
  [...markup.matchAll(PAGE_RE)].map((match) => match[1]);

const box = (xs, ys) => ({
  xMin: Math.min(...xs),
  xMax: Math.max(...xs),
  yMin: Math.min(...ys),
  yMax: Math.max(...ys),
});

/** cairo writes a path as absolute points, so its box is their extent. */
function filledBoxes(svgPage) {
  return [...svgPage.matchAll(FILLED_PATH_RE)].map(([, fill, path]) => {
    const numbers = path.match(/-?[\d.]+/g).map(Number);
    return {
      fill,
      ...box(
        numbers.filter((_, index) => index % 2 === 0),
        numbers.filter((_, index) => index % 2 === 1),
      ),
    };
  });
}

const wordsOf = (page) =>
  [...page.matchAll(WORD_RE)].map(([, xMin, yMin, xMax, yMax, text]) => ({
    text,
    ...box([Number(xMin), Number(xMax)], [Number(yMin), Number(yMax)]),
  }));

const midX = (item) => (item.xMin + item.xMax) / 2;
const midY = (item) => (item.yMin + item.yMax) / 2;

/** What shows at a point is the fill drawn there last. */
const fillAt = (boxes, x, y) =>
  boxes.findLast(
    (each) => each.xMin <= x && x <= each.xMax && each.yMin <= y && y <= each.yMax,
  )?.fill;

function legendColour(page) {
  const at = page.words.findIndex((_, index) =>
    LEGEND.every((text, offset) => page.words[index + offset]?.text === text),
  );
  if (at === -1) return null;
  const equals = page.words[at];
  const colour = fillAt(
    page.boxes,
    equals.xMin - SWATCH_SAMPLE_OFFSET,
    midY(equals),
  );
  if (!colour) {
    throw new Error(
      `The BYOD legend has no colour swatch — page ${page.number}: nothing is filled just left of "${LEGEND.join(" ")}"`,
    );
  }
  return colour;
}

/**
 * A row prints its term type left of its roots; the nearest one belongs to
 * the same cell, not to the other column or to a title ("Strafrecht AT & BT").
 * Roots without one (the oral page) are not written exams.
 */
function termTypeOf(root, words) {
  const inRow = words.filter(
    (word) =>
      TERM_TYPE_WORD_RE.test(word.text) &&
      word.xMax <= root.xMin &&
      root.yMin <= midY(word) &&
      midY(word) <= root.yMax,
  );
  return inRow.sort((a, b) => b.xMax - a.xMax)[0]?.text;
}

/**
 * Returns the shaded roots by page and term type, e.g.
 * `{ 2: { OT: ["7,408"] } }`: the same roots can be shaded in their OT row
 * and plain in their AT row on the same page. A (page, term type, root) that
 * is both is fatal, since an exam is matched by exactly that. The legend may
 * be printed on one page only, so its colour holds for the whole plan; a plan
 * without it marks nothing.
 */
export function parseByodShading(svg, wordBoxes) {
  // cairo wraps each page of a longer document in <page>; one page is bare.
  const svgPages = svg.includes("<pageSet>") ? pagesOf(svg) : [svg];
  const pages = pagesOf(wordBoxes).map((markup, index) => ({
    number: index + 1,
    words: wordsOf(markup),
    boxes: filledBoxes(svgPages[index]),
  }));
  const colours = new Set(pages.map(legendColour).filter(Boolean));

  const shaded = {};
  for (const page of pages) {
    const cells = new Map(); // "OT 7,408" → whether its row is shaded
    for (const word of page.words) {
      const termType =
        ROOT_WORD_RE.test(word.text) && termTypeOf(word, page.words);
      if (!termType) continue;
      const cell = `${termType} ${word.text}`;
      const isShaded = colours.has(fillAt(page.boxes, midX(word), midY(word)));
      if (cells.has(cell) && cells.get(cell) !== isShaded) {
        throw new Error(
          `BYOD shading is ambiguous — page ${page.number}: ${cell} is shaded in one row and plain in another`,
        );
      }
      cells.set(cell, isShaded);
    }
    for (const cell of [...cells.keys()].sort()) {
      if (!cells.get(cell)) continue;
      const [termType, root] = cell.split(" ");
      ((shaded[page.number] ??= {})[termType] ??= []).push(root);
    }
  }
  return shaded;
}
