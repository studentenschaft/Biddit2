/**
 * useGridLayout.js
 *
 * Abstracts CSS Grid layout computation for the CurriculumGrid.
 * Supports two orientations:
 *   - Default: semesters as rows, categories as columns
 *   - Flipped: categories as rows, semesters as columns
 *
 * Returns the grid-template-columns string and the sticky column width,
 * so CurriculumGrid can render axis-agnostically.
 */

import { useMemo } from "react";

const MIN_CATEGORY_WIDTH = 140;
const COLLAPSED_WIDTH = 36;
export const SEMESTER_COL_WIDTH = 100;
export const CATEGORY_ROW_LABEL_WIDTH = 160;
const MIN_SEMESTER_COL_WIDTH = 130;
const ADD_SEMESTER_COL_WIDTH = 50;

export function useGridLayout({
  categories,
  semesters,
  isFlipped,
  isCategoryCollapsed,
}) {
  return useMemo(() => {
    if (!isFlipped) {
      const columnWidths = categories.map((cat) =>
        isCategoryCollapsed(cat.path)
          ? `${COLLAPSED_WIDTH}px`
          : `minmax(${MIN_CATEGORY_WIDTH}px, 1fr)`,
      );
      return {
        gridTemplateColumns: `${SEMESTER_COL_WIDTH}px ${columnWidths.join(" ")}`,
        stickyColumnWidth: SEMESTER_COL_WIDTH,
      };
    }

    // Flipped: categories as rows, semesters as columns + add-semester column
    const semesterCols = semesters.map(
      () => `minmax(${MIN_SEMESTER_COL_WIDTH}px, 1fr)`,
    );
    return {
      gridTemplateColumns: `${CATEGORY_ROW_LABEL_WIDTH}px ${semesterCols.join(" ")} ${ADD_SEMESTER_COL_WIDTH}px`,
      stickyColumnWidth: CATEGORY_ROW_LABEL_WIDTH,
    };
  }, [categories, semesters, isFlipped, isCategoryCollapsed]);
}
