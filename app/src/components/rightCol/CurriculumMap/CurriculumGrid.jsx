/**
 * CurriculumGrid.jsx
 *
 * The main grid component that displays the 2D curriculum view.
 * Supports two orientations:
 *   - Default: semesters as rows, categories as columns
 *   - Flipped: categories as rows, semesters as columns
 *
 * Features:
 * - Multi-row nested headers to match university curriculum structure
 * - Collapsible columns (individual or by parent group) in default mode
 * - Axis flip for alternative viewing orientation
 */

import { Fragment, useState, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@heroicons/react/solid";
import CategoryHeader from "./CategoryHeader";
import SemesterRow from "./SemesterRow";
import PlanCell from "./PlanCell";
import { useCurriculumPlan } from "../../helpers/useCurriculumPlan";
import { useUnifiedCourseData } from "../../helpers/useUnifiedCourseData";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import { selectedTabAtom } from "../../recoil/selectedTabAtom";
import { useHorizontalScrollAffordance } from "../../helpers/useHorizontalScrollAffordance";
import { useGridLayout } from "../../helpers/useGridLayout";

const CurriculumGrid = ({
  categories,
  categoryHierarchy,
  semesters,
  coursesBySemesterAndCategory,
  validations,
  placementMode,
  onCellPlacement,
  gradesHidden,
  isAxisFlipped,
}) => {
  // Track which individual category columns are collapsed
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());
  // Track which parent category groups are collapsed
  const [collapsedParents, setCollapsedParents] = useState(new Set());

  // Hooks for semester operations
  const { addSemester, setSemesterNote } = useCurriculumPlan();

  // Hooks for "click course → open details" feature
  const unifiedCourseData = useRecoilValue(unifiedCourseDataState);
  const { updateSelectedCourseInfo } = useUnifiedCourseData();
  const setSelectedTab = useSetRecoilState(selectedTabAtom);

  const handleCourseClick = useCallback((item) => {
    const semKey = item.semester;
    const available = unifiedCourseData.semesters?.[semKey]?.available || [];
    const fullCourse = available.find(
      (c) => c.courseNumber === item.courseId || c.id === item.courseId
    );

    if (fullCourse) {
      updateSelectedCourseInfo(fullCourse);
      setSelectedTab(0);
    }
  }, [unifiedCourseData, updateSelectedCourseInfo, setSelectedTab]);

  // Scroll affordance — gradient fades indicating hidden content
  const { scrollContainerRef, canScrollLeft, canScrollRight } =
    useHorizontalScrollAffordance();

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

  // Grid layout computation (axis-aware)
  const { gridTemplateColumns, stickyColumnWidth } = useGridLayout({
    categories,
    semesters,
    isFlipped: isAxisFlipped,
    isCategoryCollapsed,
  });

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

  // Build lookup map for parent completion status
  const parentCompletionMap = useMemo(() => {
    const map = {};
    if (categoryHierarchy) {
      categoryHierarchy.forEach((parent) => {
        if (parent.isComplete) {
          parent.children?.forEach((child) => {
            map[child.path] = true;
          });
        }
      });
    }
    return map;
  }, [categoryHierarchy]);

  const leafCategories = categories;

  // Determine if we should show parent header row (only if any parent has multiple children)
  const showParentHeaders =
    hasHierarchy && categoryHierarchy.some((parent) => parent.children.length > 1);

  // Shared handler for "add semester" clicks
  const handleAddSemester = () => {
    const lastSemester = semesters[semesters.length - 1];
    if (lastSemester) {
      addSemester(lastSemester.key);
    }
  };

  // Helper: render a PlanCell for a given semester × category intersection
  const renderPlanCell = (semester, category, { isLastCol }) => {
    const courses =
      coursesBySemesterAndCategory[semester.key]?.[category.path] || [];

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

    const isColumnComplete = category.isComplete || parentCompletionMap[category.path];

    return (
      <PlanCell
        key={`${semester.key}-${category.path}`}
        semesterKey={semester.key}
        categoryPath={category.path}
        courses={courses}
        semesterStatus={semester.status}
        validations={cellValidations}
        isLastCol={isLastCol}
        isCollapsed={isAxisFlipped ? false : isCategoryCollapsed(category.path)}
        isCategoryComplete={isColumnComplete}
        categoryName={category.name}
        validClassifications={category.validClassifications}
        placementMode={placementMode}
        onCellPlacement={onCellPlacement}
        onCourseClick={handleCourseClick}
        gradesHidden={gradesHidden}
      />
    );
  };

  // Scroll affordance gradient overlays (shared between modes)
  const scrollAffordance = (
    <>
      <div
        className={`absolute top-0 right-0 bottom-0 w-16 pointer-events-none
          rounded-r-lg transition-opacity duration-300
          ${canScrollRight ? "opacity-100" : "opacity-0"}`}
        style={{
          background:
            "linear-gradient(to left, rgba(255,255,255,1), transparent)",
        }}
        aria-hidden="true"
      />
      <div
        className={`absolute top-0 bottom-0 w-14 pointer-events-none
          transition-opacity duration-300
          ${canScrollLeft ? "opacity-100" : "opacity-0"}`}
        style={{
          left: `${stickyColumnWidth}px`,
          background:
            "linear-gradient(to right, rgba(255,255,255,1), transparent)",
        }}
        aria-hidden="true"
      />
    </>
  );

  // ─── Flipped mode: categories as rows, semesters as columns ──────────
  if (isAxisFlipped) {
    // Helper: render the "add semester" column cell (narrow + icon)
    const addSemCol = (key) => (
      <div
        key={key}
        className="bg-gray-50 border-b border-r border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-center"
        onClick={handleAddSemester}
        title="Add next semester"
      >
        <PlusIcon className="w-3.5 h-3.5 text-gray-300" />
      </div>
    );

    // Resolve a category from a hierarchy child entry
    const findCategory = (childPath) =>
      leafCategories.find((c) => c.path === childPath);

    // Render cells for one category row
    const renderCategoryRow = (category) => (
      <Fragment key={category.path}>
        {/* Category row label (sticky left) */}
        <CategoryHeader
          category={category}
          orientation="row"
          isParentComplete={parentCompletionMap[category.path] || false}
        />

        {/* PlanCells for each semester column */}
        {semesters.map((semester, semIdx) =>
          renderPlanCell(semester, category, {
            isLastCol: semIdx === semesters.length - 1,
          })
        )}

        {/* Add-semester column cell */}
        {addSemCol(`add-${category.path}`)}
      </Fragment>
    );

    return (
      <div className="relative">
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto scrollbar-thin-visible rounded-l-lg border-t border-b border-l border-black/5"
        >
          <div
            className="grid min-w-fit bg-white"
            style={{ gridTemplateColumns }}
          >
            {/* ── Header row: corner + semester column headers + add-semester ── */}
            <div className="bg-gray-50 p-2 sticky left-0 z-20 border-b border-gray-100 rounded-tl-lg">
              <span className="text-[10px] text-gray-500 font-medium">
                Category / Semester
              </span>
            </div>
            {semesters.map((semester) => (
              <SemesterRow
                key={`col-${semester.key}`}
                semester={semester}
                orientation="column"
                onSetNote={setSemesterNote}
              />
            ))}
            {/* Add-semester header cell */}
            <div
              className="bg-gray-50 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-center rounded-tr-lg"
              onClick={handleAddSemester}
              title="Add next semester"
            >
              <PlusIcon className="w-4 h-4 text-gray-500" />
            </div>

            {/* ── Category rows, grouped by parent hierarchy ── */}
            {hasHierarchy
              ? categoryHierarchy.map((parent) => (
                  <Fragment key={parent.id}>
                    {/* Parent group header spanning all columns */}
                    {parent.children.length > 1 && (() => {
                      const targetCredits = parent.maxCredits || parent.minCredits || 0;
                      return (
                        <div
                          className="relative bg-gray-100 p-2 border-b border-gray-100 flex items-center gap-2 overflow-hidden"
                          style={{ gridColumn: "1 / -1" }}
                        >
                          {targetCredits > 0 && (
                            <div
                              className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                                parent.isComplete ? "bg-green-100" : "bg-gray-200"
                              }`}
                              style={{
                                width: `${Math.min(100, Math.round((((parent.earnedCredits || 0) + (parent.plannedCredits || 0)) / targetCredits) * 100))}%`,
                              }}
                            />
                          )}
                          <div className="relative z-10 flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-800">
                              {parent.name}
                            </span>
                            {targetCredits > 0 && (
                              <span className="text-[10px] text-gray-600">
                                <span
                                  className={
                                    parent.isComplete
                                      ? "font-semibold text-green-700"
                                      : "font-medium"
                                  }
                                >
                                  {(parent.earnedCredits || 0) + (parent.plannedCredits || 0)}
                                </span>
                                <span className="text-gray-500">
                                  {" "}
                                  / {targetCredits} ECTS
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Child category rows */}
                    {parent.children?.map((child) => {
                      const category = findCategory(child.path);
                      if (!category) return null;
                      return renderCategoryRow(category);
                    })}
                  </Fragment>
                ))
              : leafCategories.map((category) => renderCategoryRow(category))}
          </div>
        </div>

        {scrollAffordance}
      </div>
    );
  }

  // ─── Default mode: semesters as rows, categories as columns ──────────
  return (
    <div className="relative">
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto scrollbar-thin-visible rounded-l-lg border-t border-b border-l border-black/5"
      >
        <div
          className="grid min-w-fit bg-white"
          style={{ gridTemplateColumns }}
        >
        {/* Parent header row (only if hierarchy exists with multiple children) */}
        {showParentHeaders && (
          <>
            {/* Corner cell for parent row */}
            <div className="bg-gray-100 p-2 sticky left-0 z-20 border-b border-gray-100" />

            {/* Parent category headers with colspan and collapse toggle */}
            {categoryHierarchy.map((parent) => {
              const isParentCollapsed = collapsedParents.has(parent.id);
              const childPaths = parent.children?.map((c) => c.path) || [];
              const targetCredits = parent.maxCredits || parent.minCredits || 0;

              return (
                <div
                  key={parent.id}
                  className={`relative border-b border-gray-100 p-2 flex items-center gap-2 overflow-hidden ${
                    isParentCollapsed ? "justify-center" : "justify-between"
                  }`}
                  style={{
                    gridColumn: `span ${parent.colspan}`,
                    backgroundColor: '#f3f4f6', // gray-100 base
                  }}
                >
                  {/* Progress fill background for parent */}
                  {targetCredits > 0 && (
                    <div
                      className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                        parent.isComplete ? 'bg-green-100' : 'bg-gray-200'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.round((((parent.earnedCredits || 0) + (parent.plannedCredits || 0)) / targetCredits) * 100))}%`,
                      }}
                    />
                  )}

                  {isParentCollapsed ? (
                    // Collapsed parent view
                    <button
                      onClick={() => toggleParentCollapse(parent.id, childPaths)}
                      className="relative z-10 flex items-center gap-1 hover:bg-gray-200 rounded px-1 py-0.5 transition-colors"
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
                    <div className="relative z-10 flex items-center justify-between w-full gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm text-gray-800 truncate">
                          {parent.name}
                        </span>
                        {targetCredits > 0 && (
                          <span className="text-[10px] text-gray-600">
                            <span className={parent.isComplete ? "font-semibold text-green-700" : "font-medium"}>
                              {(parent.earnedCredits || 0) + (parent.plannedCredits || 0)}
                            </span>
                            <span className="text-gray-500"> / {targetCredits} ECTS</span>
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleParentCollapse(parent.id, childPaths)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                        title={`Collapse ${parent.name}`}
                      >
                        <ChevronLeftIcon className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Leaf category header row */}
        <div
          className={`bg-gray-50 p-2 sticky left-0 z-20 border-b border-gray-100 ${
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
            isParentComplete={parentCompletionMap[category.path] || false}
          />
        ))}

        {/* Data rows: semester label + cells */}
        {semesters.map((semester, semIdx) => (
          <Fragment key={`row-${semester.key}`}>
            {/* Semester label cell */}
            <SemesterRow
              semester={semester}
              isLast={semIdx === semesters.length - 1}
              onSetNote={setSemesterNote}
            />

            {/* Course cells for each category */}
            {leafCategories.map((category, catIdx) =>
              renderPlanCell(semester, category, {
                isLastCol: catIdx === leafCategories.length - 1,
              })
            )}
          </Fragment>
        ))}

        {/* Add Semester row */}
        <div
          className="bg-gray-50 border-b border-gray-100 p-2 sticky left-0 z-10 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-center min-h-[50px]"
          onClick={handleAddSemester}
          title="Add next semester"
        >
          <div className="flex items-center gap-1.5 text-gray-600">
            <PlusIcon className="w-4 h-4" />
            <span className="text-xs font-medium">Add Semester</span>
          </div>
        </div>
        {/* Empty cells for the add semester row */}
        {leafCategories.map((category) => (
          <div
            key={`add-row-${category.path}`}
            className="bg-gray-50 border-b border-r border-gray-100 min-h-[50px] cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-center"
            onClick={handleAddSemester}
            title="Add next semester"
          >
            <PlusIcon className="w-4 h-4 text-gray-300" />
          </div>
        ))}
      </div>
    </div>

      {scrollAffordance}
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
  placementMode: PropTypes.shape({
    label: PropTypes.string.isRequired,
    credits: PropTypes.number.isRequired,
  }),
  onCellPlacement: PropTypes.func,
  gradesHidden: PropTypes.bool,
  isAxisFlipped: PropTypes.bool,
};

export default CurriculumGrid;
