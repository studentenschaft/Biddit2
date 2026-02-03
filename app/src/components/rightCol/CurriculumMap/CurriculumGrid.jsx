/**
 * CurriculumGrid.jsx
 *
 * The main grid component that displays the 2D curriculum view.
 * Rows = semesters, Columns = requirement categories
 * Each cell contains courses assigned to that semester + category.
 *
 * Features:
 * - Multi-row nested headers to match university curriculum structure
 * - Collapsible columns (individual or by parent group) to fit more on screen
 */

import { useState, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/solid";
import CategoryHeader from "./CategoryHeader";
import SemesterRow from "./SemesterRow";
import PlanCell from "./PlanCell";

const CurriculumGrid = ({
  categories,
  categoryHierarchy,
  semesters,
  coursesBySemesterAndCategory,
  validations,
}) => {
  // Track which individual category columns are collapsed
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());
  // Track which parent category groups are collapsed
  const [collapsedParents, setCollapsedParents] = useState(new Set());

  const toggleCategoryCollapse = useCallback((categoryPath) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryPath)) {
        next.delete(categoryPath);
      } else {
        next.add(categoryPath);
      }
      return next;
    });
  }, []);

  const toggleParentCollapse = useCallback((parentId, childPaths) => {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
    // Also collapse/expand all children
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      const isCurrentlyCollapsed = collapsedParents.has(parentId);
      childPaths.forEach((path) => {
        if (isCurrentlyCollapsed) {
          next.delete(path);
        } else {
          next.add(path);
        }
      });
      return next;
    });
  }, [collapsedParents]);

  // Build a map from category path to parent ID for quick lookup
  const categoryToParent = useMemo(() => {
    const map = {};
    if (categoryHierarchy) {
      categoryHierarchy.forEach((parent) => {
        parent.children?.forEach((child) => {
          map[child.path] = parent.id;
        });
      });
    }
    return map;
  }, [categoryHierarchy]);

  // Check if a category is collapsed (either directly or via parent)
  // IMPORTANT: Must be defined before early return to satisfy React hooks rules
  const isCategoryCollapsed = useCallback((categoryPath) => {
    if (collapsedCategories.has(categoryPath)) return true;
    const parentId = categoryToParent[categoryPath];
    if (parentId && collapsedParents.has(parentId)) return true;
    return false;
  }, [collapsedCategories, collapsedParents, categoryToParent]);

  // Ensure we have data to display
  if (!categories?.length || !semesters?.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No curriculum structure available.</p>
        <p className="text-sm mt-2">
          Make sure your transcript data has been loaded.
        </p>
      </div>
    );
  }

  // Use hierarchy if available, otherwise fall back to flat structure
  const hasHierarchy = categoryHierarchy?.length > 0;

  // Calculate total leaf columns for grid
  const leafCategories = categories;
  const minCategoryWidth = 140;
  const collapsedWidth = 36;
  const semesterColWidth = 100;

  // Build grid template columns string with collapsed support
  const columnWidths = leafCategories.map((cat) =>
    isCategoryCollapsed(cat.path)
      ? `${collapsedWidth}px`
      : `minmax(${minCategoryWidth}px, 1fr)`
  );
  const gridTemplateColumns = `${semesterColWidth}px ${columnWidths.join(" ")}`;

  // Determine if we should show parent header row (only if any parent has multiple children)
  const showParentHeaders =
    hasHierarchy && categoryHierarchy.some((parent) => parent.children.length > 1);

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-300">
      <div
        className="grid gap-px bg-stone-300 min-w-fit"
        style={{ gridTemplateColumns }}
      >
        {/* Parent header row (only if hierarchy exists with multiple children) */}
        {showParentHeaders && (
          <>
            {/* Corner cell for parent row */}
            <div className="bg-stone-100 p-2 sticky left-0 z-20" />

            {/* Parent category headers with colspan and collapse toggle */}
            {categoryHierarchy.map((parent) => {
              const isParentCollapsed = collapsedParents.has(parent.id);
              const childPaths = parent.children?.map((c) => c.path) || [];

              return (
                <div
                  key={parent.id}
                  className={`bg-stone-200 border-b border-stone-400 p-2 flex items-center gap-2 ${
                    isParentCollapsed ? "justify-center" : "justify-between"
                  }`}
                  style={{
                    gridColumn: `span ${parent.colspan}`,
                  }}
                >
                  {isParentCollapsed ? (
                    // Collapsed parent view
                    <button
                      onClick={() => toggleParentCollapse(parent.id, childPaths)}
                      className="flex items-center gap-1 hover:bg-stone-300 rounded px-1 py-0.5 transition-colors"
                      title={`Expand ${parent.name}`}
                    >
                      <ChevronRightIcon className="w-4 h-4 text-gray-600" />
                      <span className="font-bold text-xs text-gray-600 truncate max-w-[60px]">
                        {parent.name.length > 8
                          ? parent.name.substring(0, 6) + "…"
                          : parent.name}
                      </span>
                    </button>
                  ) : (
                    // Expanded parent view
                    <>
                      <span className="font-bold text-sm text-gray-800 truncate">
                        {parent.name}
                      </span>
                      <button
                        onClick={() => toggleParentCollapse(parent.id, childPaths)}
                        className="p-1 hover:bg-stone-300 rounded transition-colors flex-shrink-0"
                        title={`Collapse ${parent.name}`}
                      >
                        <ChevronLeftIcon className="w-4 h-4 text-gray-600" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Leaf category header row */}
        <div
          className={`bg-stone-100 p-2 sticky left-0 z-20 ${
            showParentHeaders ? "" : "rounded-tl-lg"
          }`}
        >
          {/* Corner cell - semester/category labels */}
          <span className="text-[10px] text-gray-500 font-medium">
            Semester / Category
          </span>
        </div>
        {leafCategories.map((category, idx) => (
          <CategoryHeader
            key={category.path}
            category={category}
            isFirst={idx === 0 && !showParentHeaders}
            isLast={idx === leafCategories.length - 1 && !showParentHeaders}
            isCollapsed={isCategoryCollapsed(category.path)}
            onToggleCollapse={() => toggleCategoryCollapse(category.path)}
          />
        ))}

        {/* Data rows: semester label + cells */}
        {semesters.map((semester, semIdx) => (
          <>
            {/* Semester label cell */}
            <SemesterRow
              key={`row-${semester.key}`}
              semester={semester}
              isLast={semIdx === semesters.length - 1}
            />

            {/* Course cells for each category */}
            {leafCategories.map((category, catIdx) => {
              const courses =
                coursesBySemesterAndCategory[semester.key]?.[category.path] ||
                [];

              // Find any validations for this cell
              const cellValidations = {
                conflicts: (validations?.conflicts || []).filter(
                  (v) =>
                    v.semesterKey === semester.key &&
                    courses.some((c) => v.courses?.includes(c.id))
                ),
                warnings: (validations?.categoryWarnings || []).filter(
                  (v) => v.categoryPath === category.path
                ),
              };

              return (
                <PlanCell
                  key={`${semester.key}-${category.path}`}
                  semesterKey={semester.key}
                  categoryPath={category.path}
                  courses={courses}
                  semesterStatus={semester.status}
                  validations={cellValidations}
                  isLastRow={semIdx === semesters.length - 1}
                  isLastCol={catIdx === leafCategories.length - 1}
                  isCollapsed={isCategoryCollapsed(category.path)}
                />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
};

CurriculumGrid.propTypes = {
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      path: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      minCredits: PropTypes.number,
      maxCredits: PropTypes.number,
      earnedCredits: PropTypes.number,
      plannedCredits: PropTypes.number,
    })
  ).isRequired,
  categoryHierarchy: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      colspan: PropTypes.number.isRequired,
      children: PropTypes.array,
    })
  ),
  semesters: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      status: PropTypes.oneOf(["completed", "current", "future"]).isRequired,
      totalCredits: PropTypes.number,
    })
  ).isRequired,
  coursesBySemesterAndCategory: PropTypes.object.isRequired,
  validations: PropTypes.shape({
    conflicts: PropTypes.array,
    categoryWarnings: PropTypes.array,
    availabilityWarnings: PropTypes.array,
  }),
};

export default CurriculumGrid;
