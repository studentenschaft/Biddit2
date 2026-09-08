/**
 * curriculumMapSelector.test.js
 *
 * Tests for the pure helper functions used by the curriculum map selector.
 * These test business logic without Recoil dependency.
 */

import { describe, it, expect } from 'vitest';
import { snapshot_UNSTABLE } from 'recoil';
import {
  _testHelpers,
  curriculumMapSelector,
  normalizeCourseCredits,
  findCreditsInAnySemester,
  formatCreditRange,
  getRequirementThreshold,
  getFillPercentage,
} from '../curriculumMapSelector';
import { unifiedAcademicDataState } from '../unifiedAcademicDataAtom';
import { unifiedCourseDataState } from '../unifiedCourseDataAtom';
import { curriculumPlanState, getDefaultPlanState } from '../curriculumPlanAtom';
import MBI from '../../testing/mockData/Scorecard_MBI.json';
import BBWL from '../../testing/mockData/Scorecard_BBWL.json';
import BIA from '../../testing/mockData/Scorecard_BIA.json';
import BSC from '../../testing/mockData/Scorecard_BSC.json';

const {
  normalizeSemesterKey,
  extractClassifications,
  extractCategoryHierarchy,
  extractCoursesFromHierarchy,
  flattenCategoriesForGrid,
  buildCategoryHierarchy,
  meetsRequirement,
  fallsShort,
  summarizeLeafCredits,
  matchClassificationToCategory,
  resolveFallbackCategory,
  inferClassificationFromCourseName,
  resolveCategoryForCourse,
  estimateCompletion,
  computeSemesterCreditStats,
} = _testHelpers;

// ── normalizeSemesterKey ──────────────────────────────────────────────────

describe('normalizeSemesterKey', () => {
  it('removes spaces from semester keys', () => {
    expect(normalizeSemesterKey('FS 25')).toBe('FS25');
    expect(normalizeSemesterKey('HS 24')).toBe('HS24');
  });

  it('returns already-normalized keys unchanged', () => {
    expect(normalizeSemesterKey('FS25')).toBe('FS25');
  });

  it('handles null/empty input', () => {
    expect(normalizeSemesterKey(null)).toBe('');
    expect(normalizeSemesterKey('')).toBe('');
    expect(normalizeSemesterKey(undefined)).toBe('');
  });

  it('removes multiple spaces', () => {
    expect(normalizeSemesterKey('FS  25')).toBe('FS25');
  });
});

// ── normalizeCourseCredits ────────────────────────────────────────────────

describe('normalizeCourseCredits', () => {
  it('divides raw API values (>99) by 100', () => {
    expect(normalizeCourseCredits(600)).toBe(6);
    expect(normalizeCourseCredits(300)).toBe(3);
  });

  it('passes through already-normalized values', () => {
    expect(normalizeCourseCredits(6)).toBe(6);
    expect(normalizeCourseCredits(0)).toBe(0);
  });

  it('returns the default fallback (3) when raw is missing', () => {
    expect(normalizeCourseCredits(null)).toBe(3);
    expect(normalizeCourseCredits(undefined)).toBe(3);
  });

  it('returns null (unknown) when an explicit null fallback is given', () => {
    // The curriculum map passes null so unresolved credits render as "?"
    // instead of a fabricated number.
    expect(normalizeCourseCredits(null, null)).toBeNull();
    expect(normalizeCourseCredits(undefined, null)).toBeNull();
  });
});

// ── findCreditsInAnySemester ──────────────────────────────────────────────

describe('findCreditsInAnySemester', () => {
  const semesters = {
    HS26: {
      available: [
        { courseNumber: '9,120,1.00', credits: 600 }, // Board Governance (main)
        { courseNumber: '7,852,2.01', credits: 0 }, // an exercise group
      ],
    },
    FS26: { available: [{ id: 'abc-id', credits: 300 }] },
    HS27: { available: [] }, // projected future semester, no catalog
  };

  it('resolves credits from another loaded semester by courseNumber', () => {
    expect(findCreditsInAnySemester('9,120,1.00', semesters)).toBe(600);
  });

  it('resolves by id as well as courseNumber', () => {
    expect(findCreditsInAnySemester('abc-id', semesters)).toBe(300);
  });

  it('returns 0 for exercise groups (an explicit 0, not "unknown")', () => {
    expect(findCreditsInAnySemester('7,852,2.01', semesters)).toBe(0);
  });

  it('returns null when the course is in no loaded catalog', () => {
    expect(findCreditsInAnySemester('99,999,1.00', semesters)).toBeNull();
  });

  it('handles missing input safely', () => {
    expect(findCreditsInAnySemester(null, semesters)).toBeNull();
    expect(findCreditsInAnySemester('x', {})).toBeNull();
    expect(findCreditsInAnySemester('x', null)).toBeNull();
  });

  it('a course on a catalog-less semester resolves to real ECTS via the fallback', () => {
    // Board Governance is placed on HS27 (no catalog) but exists in HS26 → 6 ECTS,
    // instead of the "?" it showed before this fallback.
    const raw = findCreditsInAnySemester('9,120,1.00', semesters);
    expect(normalizeCourseCredits(raw, null)).toBe(6);
  });
});

// ── extractClassifications ────────────────────────────────────────────────

describe('extractClassifications', () => {
  it('matches compulsory/pflicht keywords', () => {
    const result = extractClassifications({ description: 'Compulsory Subjects' });
    expect(result).toContain('compulsory');
    expect(result).toContain('pflicht');
  });

  it('matches elective/wahl keywords', () => {
    const result = extractClassifications({ description: 'Elective Courses' });
    expect(result).toContain('elective');
    expect(result).toContain('wahl');
  });

  it('does NOT match elective for Wahlpflicht (compulsory elective)', () => {
    const result = extractClassifications({ description: 'Wahlpflicht' });
    // Should match pflicht but NOT wahl/elective
    expect(result).toContain('pflicht');
    expect(result).not.toContain('elective');
    expect(result).not.toContain('wahl');
  });

  it('matches context keywords', () => {
    const result = extractClassifications({ description: 'Contextual Studies' });
    expect(result).toContain('context');
    expect(result).toContain('Kontextstudium');
  });

  it('matches thesis keywords', () => {
    const result = extractClassifications({ description: 'Master Thesis' });
    expect(result).toContain('thesis');
    expect(result).toContain('masterarbeit');
  });

  it('matches focus/major keywords', () => {
    const result = extractClassifications({ description: 'Focus Area' });
    expect(result).toContain('focus');
    expect(result).toContain('Major');
  });

  it('returns empty for unrecognized categories', () => {
    const result = extractClassifications({ description: 'Random Unknown Category' });
    expect(result).toEqual([]);
  });

  it('is case-insensitive', () => {
    const result = extractClassifications({ description: 'COMPULSORY' });
    expect(result).toContain('compulsory');
  });

  it('uses shortName as fallback', () => {
    const result = extractClassifications({ shortName: 'Seminare' });
    expect(result).toContain('seminar');
  });

  it('matches multiple keywords in one category', () => {
    const result = extractClassifications({ description: 'Core Research Methods' });
    expect(result).toContain('core');
    expect(result).toContain('method');
  });
});

// ── extractCategoryHierarchy ──────────────────────────────────────────────

describe('extractCategoryHierarchy', () => {
  it('extracts title items as categories', () => {
    const items = [
      { isTitle: true, description: 'Core Studies', hierarchy: '001', minCredits: '15', maxCredits: '30', sumOfCredits: '12' },
    ];
    const result = extractCategoryHierarchy(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'Core Studies',
      path: 'Core Studies',
      level: 0,
      minCredits: 15,
      maxCredits: 30,
      earnedCredits: 12,
    });
  });

  it('builds nested paths for children', () => {
    const items = [
      {
        isTitle: true,
        description: 'Core',
        hierarchy: '001',
        items: [
          { isTitle: true, description: 'Compulsory', hierarchy: '002' },
        ],
      },
    ];
    const result = extractCategoryHierarchy(items);
    expect(result[0].children[0].path).toBe('Core/Compulsory');
    expect(result[0].children[0].level).toBe(1);
  });

  it('skips non-title items', () => {
    const items = [
      { isTitle: false, description: 'Some Course', semester: 'FS25' },
      { isTitle: true, description: 'Category', hierarchy: '001' },
    ];
    const result = extractCategoryHierarchy(items);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Category');
  });

  it('handles empty/null input', () => {
    expect(extractCategoryHierarchy(null)).toEqual([]);
    expect(extractCategoryHierarchy([])).toEqual([]);
  });
});

// ── extractCoursesFromHierarchy ───────────────────────────────────────────

describe('extractCoursesFromHierarchy', () => {
  it('extracts courses from under title items', () => {
    const items = [
      {
        isTitle: true,
        description: 'Compulsory',
        hierarchy: '001',
        items: [
          {
            isTitle: false,
            description: 'Intro to CS',
            courseNumber: '1234',
            semester: 'FS 25',
            sumOfCredits: '3',
            gradeText: '5.0',
          },
        ],
      },
    ];
    const result = extractCoursesFromHierarchy(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'Intro to CS',
      courseId: '1234',
      semester: 'FS 25',
      credits: 3,
      categoryPath: 'Compulsory',
      isCompleted: true,
      status: 'completed',
    });
  });

  it('marks courses without grades as enrolled', () => {
    const items = [
      {
        isTitle: true,
        description: 'Cat',
        items: [
          { isTitle: false, description: 'Course A', semester: 'FS25', sumOfCredits: '6' },
        ],
      },
    ];
    const result = extractCoursesFromHierarchy(items);
    expect(result[0].isCompleted).toBe(false);
    expect(result[0].status).toBe('enrolled');
  });

  it('skips items without semester', () => {
    const items = [
      { isTitle: false, description: 'No semester item' },
    ];
    const result = extractCoursesFromHierarchy(items);
    expect(result).toHaveLength(0);
  });
});

// ── flattenCategoriesForGrid ──────────────────────────────────────────────

describe('flattenCategoriesForGrid', () => {
  it('returns leaf categories only', () => {
    const categories = [
      {
        id: 'root', name: 'Program', children: [
          {
            id: 'core', name: 'Core', children: [
              { id: 'comp', name: 'Compulsory', children: [] },
              { id: 'elec', name: 'Elective', children: [] },
            ],
          },
          { id: 'thesis', name: 'Thesis', children: [] },
        ],
      },
    ];
    const result = flattenCategoriesForGrid(categories);
    expect(result.map(c => c.name)).toEqual(['Compulsory', 'Elective', 'Thesis']);
  });

  it('skips single program wrapper at level 0', () => {
    const categories = [
      {
        id: 'root', name: 'Master in XYZ', children: [
          { id: 'a', name: 'A', children: [] },
          { id: 'b', name: 'B', children: [] },
        ],
      },
    ];
    const result = flattenCategoriesForGrid(categories);
    // Should skip "Master in XYZ" and return A, B directly
    expect(result.map(c => c.name)).toEqual(['A', 'B']);
  });

  it('does not skip level 0 if multiple categories exist', () => {
    const categories = [
      { id: 'a', name: 'A', children: [] },
      { id: 'b', name: 'B', children: [] },
    ];
    const result = flattenCategoriesForGrid(categories);
    expect(result.map(c => c.name)).toEqual(['A', 'B']);
  });

  it('tracks grouping parent for nested categories', () => {
    const categories = [
      {
        id: 'root', name: 'Program', children: [
          {
            id: 'core', name: 'Core', children: [
              { id: 'comp', name: 'Compulsory', children: [] },
            ],
          },
        ],
      },
    ];
    const result = flattenCategoriesForGrid(categories);
    expect(result[0].topLevelParentId).toBe('core');
  });
});

// ── matchClassificationToCategory ─────────────────────────────────────────

describe('matchClassificationToCategory', () => {
  // `ancestors` is what flattenCategoriesForGrid attaches to every grid leaf.
  const flatCategories = [
    { name: 'Compulsory', path: 'Core/Compulsory', ancestors: [{ id: 'core', name: 'Core' }], validClassifications: ['compulsory', 'pflicht'] },
    { name: 'Elective', path: 'Core/Elective', ancestors: [{ id: 'core', name: 'Core' }], validClassifications: ['elective', 'wahl'] },
    { name: 'Contextual Studies', path: 'Context', ancestors: [], validClassifications: ['context', 'kontext', 'Kontextstudium'] },
  ];

  it('matches by exact category name (case-insensitive)', () => {
    const result = matchClassificationToCategory('compulsory', flatCategories);
    expect(result?.path).toBe('Core/Compulsory');
  });

  it('matches by exact category name regardless of case', () => {
    const result = matchClassificationToCategory('ELECTIVE', flatCategories);
    expect(result?.path).toBe('Core/Elective');
  });

  it('falls back to validClassifications matching', () => {
    const result = matchClassificationToCategory('pflicht', flatCategories);
    expect(result?.path).toBe('Core/Compulsory');
  });

  it('matches first validClassification hit when multiple could match', () => {
    // "Wahlbereich context" contains both "wahl" (Elective) and "context" (Contextual Studies)
    // The algorithm matches the first category whose validClassification appears in the string
    const result = matchClassificationToCategory('Wahlbereich context', flatCategories);
    // "wahl" is in Elective's validClassifications and appears in "Wahlbereich"
    expect(result?.path).toBe('Core/Elective');
  });

  it('matches context classification when unambiguous', () => {
    const result = matchClassificationToCategory('Kontextstudium', flatCategories);
    expect(result?.path).toBe('Context');
  });

  it('returns undefined for unmatched classifications', () => {
    const result = matchClassificationToCategory('completely unknown', flatCategories);
    expect(result).toBeUndefined();
  });
});

// ── estimateCompletion ────────────────────────────────────────────────────

describe('estimateCompletion', () => {
  it('returns "Completed" when earned >= required', () => {
    expect(estimateCompletion(180, 180, [])).toBe('Completed');
    expect(estimateCompletion(180, 200, [])).toBe('Completed');
  });

  it('projects from future semesters when available', () => {
    const semesters = [
      { key: 'FS25', status: 'completed', totalCredits: 30 },
      { key: 'HS25', status: 'current', totalCredits: 30 },
      { key: 'FS26', status: 'future', totalCredits: 30 },
      { key: 'HS26', status: 'future', totalCredits: 30 },
    ];
    const result = estimateCompletion(180, 120, semesters);
    // Needs 60 more credits, avg 30/semester = 2 more semesters
    // First future semester is FS26, second is HS26
    expect(result).toBe('HS26');
  });

  it('returns "TBD" when no semesters available', () => {
    expect(estimateCompletion(180, 0, [])).toBe('TBD');
  });
});

// ── computeSemesterCreditStats ────────────────────────────────────────────

describe('computeSemesterCreditStats', () => {
  const completed = { status: 'completed', isCompleted: true, credits: 6 };
  const enrolled = { status: 'enrolled', isCompleted: false, credits: 4 };
  const planned = { status: 'planned', isCompleted: false, credits: 30 };
  const placeholder = { status: 'placeholder', credits: 8 };

  it('counts only wishlist/placeholder courses as planned, not enrolled ones', () => {
    const stats = computeSemesterCreditStats([
      completed,
      enrolled,
      planned,
      placeholder,
    ]);

    expect(stats.totalCredits).toBe(48);
    expect(stats.completedCredits).toBe(6);
    expect(stats.plannedCredits).toBe(38);
  });

  it('a purely planned semester has planned == total (the FS27 thesis case)', () => {
    const stats = computeSemesterCreditStats([planned]);

    expect(stats.totalCredits).toBe(30);
    expect(stats.plannedCredits).toBe(30);
    expect(stats.completedCredits).toBe(0);
  });

  it('enrolled in-progress courses count toward total only', () => {
    const stats = computeSemesterCreditStats([enrolled]);

    expect(stats.totalCredits).toBe(4);
    expect(stats.plannedCredits).toBe(0);
    expect(stats.completedCredits).toBe(0);
  });

  it('handles empty input and missing credits', () => {
    expect(computeSemesterCreditStats([])).toEqual({
      totalCredits: 0,
      completedCredits: 0,
      plannedCredits: 0,
    });
    expect(
      computeSemesterCreditStats([{ status: 'planned' }]).plannedCredits,
    ).toBe(0);
  });
});

// ── Credit requirements: minimums, caps and parent roll-up ────────────────

describe('meetsRequirement', () => {
  it('never treats a category with no requirement as complete', () => {
    // Guards the `total >= 0` bug: min 0 / max 0 categories (e.g. "Languages")
    // used to be permanently green.
    expect(meetsRequirement({ minCredits: 0, maxCredits: 0, earnedCredits: 0 }))
      .toBe(false);
  });

  it('uses the minimum as the threshold when one is set', () => {
    const cat = { minCredits: 12, maxCredits: 27 };
    expect(meetsRequirement({ ...cat, earnedCredits: 9 })).toBe(false);
    expect(meetsRequirement({ ...cat, earnedCredits: 12 })).toBe(true);
  });

  it('falls back to the maximum when there is no minimum', () => {
    expect(meetsRequirement({ minCredits: 0, maxCredits: 9, earnedCredits: 9 }))
      .toBe(true);
  });
});

describe('buildCategoryHierarchy', () => {
  // Mirrors the MacFin case from the bug report: the parent's total clears its
  // own target only because one child is over its ceiling while another is
  // short of its floor.
  const macFinLeaves = [
    { id: 'c', name: 'Compulsory Subjects', path: 'CS/Compulsory', topLevelParentId: 'core',
      minCredits: 15, maxCredits: 15, earnedCredits: 15, plannedCredits: 0 },
    { id: 'b', name: 'Basic Courses', path: 'CS/Basic', topLevelParentId: 'core',
      minCredits: 12, maxCredits: 27, earnedCredits: 9, plannedCredits: 0 },
    { id: 'a', name: 'Advanced Courses', path: 'CS/Advanced', topLevelParentId: 'core',
      minCredits: 12, maxCredits: 24, earnedCredits: 21, plannedCredits: 0 },
    { id: 'e', name: 'Electives', path: 'CS/Electives', topLevelParentId: 'core',
      minCredits: 0, maxCredits: 9, earnedCredits: 10, plannedCredits: 0 },
  ];
  // Wrapped in a program root, as the real scorecard is: buildCategoryHierarchy
  // skips a lone top-level wrapper and groups by its children.
  const program = [{
    id: 'prog', name: 'MacFin', path: 'MacFin',
    minCredits: 90, maxCredits: 90,
    children: [{
      id: 'core', name: 'Core Studies', path: 'CS',
      minCredits: 54, maxCredits: 54, children: [{ id: 'x' }],
    }],
  }];

  it('is not complete when a child is below its minimum', () => {
    const [core] = buildCategoryHierarchy(program, macFinLeaves);

    // 15 + 9 + 21 + min(10, 9) — the elective overshoot does not count.
    expect(core.countedTotal).toBe(54);
    expect(core.excessCredits).toBe(1);
    expect(core.isComplete).toBe(false);
  });

  it('is complete once the short child reaches its minimum', () => {
    const leaves = macFinLeaves.map((l) =>
      l.id === 'b' ? { ...l, earnedCredits: 12 } : l,
    );
    const [core] = buildCategoryHierarchy(program, leaves);

    expect(core.isComplete).toBe(true);
    expect(core.countedTotal).toBe(54);
    // 58 credits held against a 54-credit parent: 1 lost to the elective
    // ceiling, 3 more to the parent's. Excess is reported, never a blocker.
    expect(core.excessCredits).toBe(4);
  });

  it('is not held back by children that have no minimum', () => {
    // Two shapes that must never block a parent, both from the real BBWL /
    // BIA / BSC scorecards:
    //   "Skills"    min 0 / max 12 — a ceiling, not an obligation
    //   "Languages" min 0 / max  0 — no requirement at all, so it can never
    //                                itself be "complete"
    // Gating on every-child-complete would keep Contextual Studies grey
    // forever for three of the four shipped programs.
    const leaves = [
      { id: 'aoc', name: 'Area of Concentration', path: 'CX/AoC', topLevelParentId: 'ctx',
        minCredits: 12, maxCredits: 24, earnedCredits: 20, plannedCredits: 0 },
      { id: 'sk', name: 'Skills', path: 'CX/Skills', topLevelParentId: 'ctx',
        minCredits: 0, maxCredits: 12, earnedCredits: 4, plannedCredits: 0 },
      { id: 'lang', name: 'Languages', path: 'CX/Languages', topLevelParentId: 'ctx',
        minCredits: 0, maxCredits: 0, earnedCredits: 4, plannedCredits: 0 },
    ];
    const bbwl = [{
      id: 'prog', name: 'BBWL', path: 'BBWL',
      minCredits: 120, maxCredits: 120,
      children: [{
        id: 'ctx', name: 'Contextual Studies', path: 'CX',
        minCredits: 24, maxCredits: 24, children: [{ id: 'x' }],
      }],
    }];

    const [ctx] = buildCategoryHierarchy(bbwl, leaves);

    // Capped at Contextual Studies' own ceiling of 24; the surplus 4 is
    // reported rather than inflating the total.
    expect(ctx.countedTotal).toBe(24);
    expect(ctx.excessCredits).toBe(4);
    expect(ctx.isComplete).toBe(true);
  });
});

describe('fallsShort', () => {
  it('is not the negation of meetsRequirement', () => {
    // A maximum is a ceiling, not an obligation. "Skills" (min 0 / max 12) at 4
    // is under-filled, so it is not complete — but it is not deficient either,
    // and must not hold its parent back.
    const skills = { minCredits: 0, maxCredits: 12, earnedCredits: 4 };

    expect(meetsRequirement(skills)).toBe(false);
    expect(fallsShort(skills)).toBe(false);
  });

  it('flags only an unmet explicit minimum', () => {
    expect(fallsShort({ minCredits: 12, maxCredits: 27, earnedCredits: 9 })).toBe(true);
    expect(fallsShort({ minCredits: 12, maxCredits: 27, earnedCredits: 12 })).toBe(false);
    expect(fallsShort({ minCredits: 0, maxCredits: 0, earnedCredits: 0 })).toBe(false);
  });
});

describe('summarizeLeafCredits', () => {
  it('caps each leaf at its own ceiling and reports the surplus', () => {
    const { countedTotal, excessCredits } = summarizeLeafCredits([
      { minCredits: 0, maxCredits: 9, earnedCredits: 10 },
      { minCredits: 12, maxCredits: 24, earnedCredits: 21 },
    ]);
    expect(countedTotal).toBe(30);
    expect(excessCredits).toBe(1);
  });

  it('treats a zero maximum as no ceiling', () => {
    // "Languages" is min 0 / max 0 and its credits still count toward the
    // parent — the university's own roll-up includes them.
    const { countedTotal, excessCredits } = summarizeLeafCredits([
      { minCredits: 0, maxCredits: 0, earnedCredits: 4 },
    ]);
    expect(countedTotal).toBe(4);
    expect(excessCredits).toBe(0);
  });

  it('counts planned credits alongside earned ones', () => {
    const { countedTotal } = summarizeLeafCredits([
      { minCredits: 6, maxCredits: 12, earnedCredits: 3, plannedCredits: 4 },
    ]);
    expect(countedTotal).toBe(7);
  });

  it('is empty-safe', () => {
    expect(summarizeLeafCredits([])).toEqual({
      countedTotal: 0,
      excessCredits: 0,
      allLeavesMeetRequirement: true,
    });
  });
});

describe('formatCreditRange', () => {
  it('renders a true range with an en dash', () => {
    expect(formatCreditRange({ minCredits: 12, maxCredits: 27 })).toBe('12–27');
  });

  it('collapses to a single figure when the bounds coincide', () => {
    expect(formatCreditRange({ minCredits: 15, maxCredits: 15 })).toBe('15');
  });

  it('collapses to the effective threshold when only one bound is set', () => {
    expect(formatCreditRange({ minCredits: 0, maxCredits: 12 })).toBe('12');
    expect(formatCreditRange({ minCredits: 12, maxCredits: 0 })).toBe('12');
  });

  it('renders nothing when there is no requirement', () => {
    expect(formatCreditRange({ minCredits: 0, maxCredits: 0 })).toBe('');
    expect(formatCreditRange()).toBe('');
  });
});

describe('getFillPercentage', () => {
  it('is denominated by the requirement threshold, not the ceiling', () => {
    // min 12 / max 24 at 12 is complete, so the bar must read full even though
    // the label still advertises a ceiling of 24.
    expect(getFillPercentage(12, { minCredits: 12, maxCredits: 24 })).toBe(100);
    expect(getFillPercentage(9, { minCredits: 12, maxCredits: 27 })).toBe(75);
  });

  it('clamps and stays finite without a requirement', () => {
    expect(getFillPercentage(30, { minCredits: 12, maxCredits: 24 })).toBe(100);
    expect(getFillPercentage(4, { minCredits: 0, maxCredits: 0 })).toBe(0);
  });
});

describe('getRequirementThreshold', () => {
  it('prefers the minimum, falling back to the maximum', () => {
    expect(getRequirementThreshold({ minCredits: 12, maxCredits: 27 })).toBe(12);
    expect(getRequirementThreshold({ minCredits: 0, maxCredits: 12 })).toBe(12);
    expect(getRequirementThreshold({ minCredits: 0, maxCredits: 0 })).toBe(0);
    expect(getRequirementThreshold()).toBe(0);
  });
});

describe('roll-up against real scorecards', () => {
  const findNode = (items, name) => {
    for (const it of items || []) {
      if (it.description === name) return it;
      const found = findNode(it.items, name);
      if (found) return found;
    }
    return null;
  };

  it.each([
    ['MBI', MBI],
    ['BBWL', BBWL],
    ['BIA', BIA],
    ['BSC', BSC],
  ])('reproduces the university’s own totals for %s', (_name, raw) => {
    const categories = extractCategoryHierarchy(raw.items);
    const hierarchy = buildCategoryHierarchy(
      categories,
      flattenCategoriesForGrid(categories),
    );

    expect(hierarchy.length).toBeGreaterThan(0);

    for (const parent of hierarchy) {
      const apiSum = findNode(raw.items, parent.name)?.sumOfCredits;
      // Some nodes ship without a total (BIA's Contextual Studies); we derive
      // one from the leaves, so there is nothing to compare against.
      if (apiSum == null) continue;

      // No shipped scorecard has a category over its ceiling, so our roll-up
      // must land on the university's number exactly. If capping ever starts
      // discarding credits it should not, this is what catches it.
      expect(parent.countedTotal).toBe(parseFloat(apiSum));
      expect(parent.excessCredits).toBe(0);
    }
  });
});

// ── skills / competence classifications ───────────────────────────────────

describe('extractClassifications — skills categories', () => {
  it('derives skill classifications for a "Skills" category', () => {
    const result = extractClassifications({ description: 'Skills' });
    expect(result.map((v) => v.toLowerCase())).toContain('skills');
  });

  it('derives skill classifications for German competence categories', () => {
    const result = extractClassifications({ description: 'Handlungskompetenzen' });
    expect(result.map((v) => v.toLowerCase())).toContain('kompetenz');
  });

  it('matches a "Skills" classification to the Skills leaf', () => {
    const flatCategories = [
      {
        name: 'Compulsory Subjects',
        path: 'Core Studies/Compulsory Subjects',
        ancestors: [{ id: 'core', name: 'Core Studies' }],
        validClassifications: extractClassifications({ description: 'Compulsory Subjects' }),
      },
      {
        name: 'Skills',
        path: 'Contextual Studies/Skills',
        ancestors: [{ id: 'ctx', name: 'Contextual Studies' }],
        validClassifications: extractClassifications({ description: 'Skills' }),
      },
    ];
    expect(matchClassificationToCategory('Skills', flatCategories)?.path).toBe(
      'Contextual Studies/Skills',
    );
  });
});

// ── matchClassificationToCategory — parent (non-leaf) names ───────────────

describe('matchClassificationToCategory — ancestor resolution', () => {
  const leaf = (name, path, ancestors, validClassifications = []) => ({
    name,
    path,
    ancestors,
    validClassifications,
  });

  it('resolves a parent-name classification to its only leaf', () => {
    const flatCategories = [
      leaf('Compulsory Subjects', 'Core Studies/Compulsory Subjects', [
        { id: 'core', name: 'Core Studies' },
      ]),
      leaf('Skills', 'Contextual Studies/Skills', [
        { id: 'ctx', name: 'Contextual Studies' },
      ]),
    ];

    const result = matchClassificationToCategory('Contextual Studies', flatCategories);
    expect(result?.path).toBe('Contextual Studies/Skills');
  });

  it('picks the best-matching leaf when the parent has several', () => {
    const flatCategories = [
      leaf('Compulsory Subjects', 'Core Studies/Compulsory Subjects', [
        { id: 'core', name: 'Core Studies' },
      ]),
      leaf('Reflection Competences', 'Contextual Studies/Reflection Competences', [
        { id: 'ctx', name: 'Contextual Studies' },
      ]),
      leaf('Skills', 'Contextual Studies/Skills', [{ id: 'ctx', name: 'Contextual Studies' }], [
        'skills',
      ]),
    ];

    const result = matchClassificationToCategory('Contextual Studies skills', flatCategories);
    expect(result?.path).toBe('Contextual Studies/Skills');
  });

  it('falls back to the first leaf under the matched parent', () => {
    const flatCategories = [
      leaf('Compulsory Subjects', 'Core Studies/Compulsory Subjects', [
        { id: 'core', name: 'Core Studies' },
      ]),
      leaf('Reflection Competences', 'Contextual Studies/Reflection Competences', [
        { id: 'ctx', name: 'Contextual Studies' },
      ]),
      leaf('Languages', 'Contextual Studies/Languages', [
        { id: 'ctx', name: 'Contextual Studies' },
      ]),
    ];

    const result = matchClassificationToCategory('Contextual Studies', flatCategories);
    expect(result?.path).toBe('Contextual Studies/Reflection Competences');
  });

  it('still prefers an exact leaf name over an ancestor name', () => {
    const flatCategories = [
      leaf('Contextual Studies', 'Contextual Studies', []),
      leaf('Skills', 'Other/Skills', [{ id: 'other', name: 'Contextual Studies' }]),
    ];

    const result = matchClassificationToCategory('Contextual Studies', flatCategories);
    expect(result?.path).toBe('Contextual Studies');
  });
});

// ── resolveFallbackCategory ───────────────────────────────────────────────

describe('resolveFallbackCategory', () => {
  it('prefers a leaf that accepts electives', () => {
    const flatCategories = [
      { name: 'Compulsory', path: 'Core/Compulsory', ancestors: [], validClassifications: ['compulsory'] },
      { name: 'Electives', path: 'Core/Electives', ancestors: [], validClassifications: ['elective', 'wahl'] },
      { name: 'Thesis', path: 'Thesis', ancestors: [], validClassifications: ['thesis'] },
    ];
    expect(resolveFallbackCategory(flatCategories)?.path).toBe('Core/Electives');
  });

  it('falls back to the last leaf when no elective bucket exists', () => {
    const flatCategories = [
      { name: 'Compulsory', path: 'Core/Compulsory', ancestors: [], validClassifications: ['compulsory'] },
      { name: 'Thesis', path: 'Thesis', ancestors: [], validClassifications: ['thesis'] },
    ];
    expect(resolveFallbackCategory(flatCategories)?.path).toBe('Thesis');
  });

  it('returns undefined for an empty category list', () => {
    expect(resolveFallbackCategory([])).toBeUndefined();
  });
});

// ── enrolled course placement overrides (selector integration) ────────────

describe('curriculumMapSelector — enrolled course category override', () => {
  const SEMESTER = 'HS25';
  const COURSE_ID = '8,123';
  const PROGRAM = 'Master in Quantitative Economics and Finance';

  const scorecard = {
    items: [
      {
        isTitle: true,
        hierarchy: 'program',
        description: PROGRAM,
        maxCredits: '90',
        items: [
          {
            isTitle: true,
            hierarchy: 'core',
            description: 'Core Studies',
            items: [
              {
                isTitle: true,
                hierarchy: 'core-comp',
                description: 'Compulsory Subjects',
                minCredits: '30',
                items: [],
              },
            ],
          },
          {
            isTitle: true,
            hierarchy: 'ctx',
            description: 'Contextual Studies',
            items: [
              {
                isTitle: true,
                hierarchy: 'ctx-skills',
                description: 'Skills',
                items: [],
              },
              {
                isTitle: true,
                hierarchy: 'ctx-refl',
                description: 'Reflection Competences',
                items: [],
              },
            ],
          },
        ],
      },
    ],
  };

  const readMap = ({ classification, plannedItems = {} }) => {
    const snapshot = snapshot_UNSTABLE(({ set }) => {
      set(unifiedAcademicDataState, {
        programs: {
          [PROGRAM]: {
            transcript: { rawScorecard: scorecard },
            metadata: { isMainStudy: true },
          },
        },
        currentProgram: PROGRAM,
        initialization: { isLoading: false, isInitialized: true, error: null },
      });
      set(unifiedCourseDataState, {
        semesters: {
          [SEMESTER]: {
            enrolledIds: [COURSE_ID],
            available: [
              {
                courseNumber: COURSE_ID,
                shortName: 'Skills: Julia - A Fresh Approach',
                credits: 300,
                classification,
              },
            ],
            selectedIds: [],
            filtered: [],
          },
        },
        selectedSemester: SEMESTER,
        latestValidTerm: SEMESTER,
        selectedCourseInfo: null,
      });
      set(curriculumPlanState, { ...getDefaultPlanState(), plannedItems });
    });
    return snapshot.getLoadable(curriculumMapSelector).getValue();
  };

  // extractCategoryHierarchy prefixes every path with the program wrapper.
  const P = (path) => `${PROGRAM}/${path}`;

  const cardsFor = (map, path) => map.coursesBySemesterAndCategory[SEMESTER][path] || [];
  const allCards = (map) =>
    Object.values(map.coursesBySemesterAndCategory[SEMESTER]).flat();

  it('places an enrolled course by its parent-name classification', () => {
    const map = readMap({ classification: 'Contextual Studies' });
    expect(cardsFor(map, P('Core Studies/Compulsory Subjects'))).toHaveLength(0);
    expect(cardsFor(map, P('Contextual Studies/Skills'))).toHaveLength(1);
  });

  it('falls back to the course-name prefix when the classification is unknown', () => {
    const map = readMap({ classification: 'Something Unmapped' });
    expect(cardsFor(map, P('Core Studies/Compulsory Subjects'))).toHaveLength(0);
    expect(cardsFor(map, P('Contextual Studies/Skills'))).toHaveLength(1);
  });

  it('honours a plan placement as the category override, rendering exactly one card', () => {
    const map = readMap({
      classification: 'Skills',
      plannedItems: {
        [SEMESTER]: [
          {
            id: `course-${COURSE_ID}`,
            type: 'course',
            courseId: COURSE_ID,
            categoryPath: P('Contextual Studies/Reflection Competences'),
          },
        ],
      },
    });

    const cards = allCards(map);
    expect(cards).toHaveLength(1);
    expect(cards[0].categoryPath).toBe(P('Contextual Studies/Reflection Competences'));
    expect(cards[0].status).toBe('enrolled');
    expect(cards[0].source).toBe('enrolled');
  });
});

// ── course-name prefix inference ──────────────────────────────────────────

describe('inferClassificationFromCourseName', () => {
  it('extracts the category prefix before the first colon', () => {
    expect(
      inferClassificationFromCourseName('Skills: Julia - A Fresh Approach to Computing'),
    ).toBe('Skills');
  });

  it('accepts a short multi-word prefix', () => {
    expect(inferClassificationFromCourseName('Area of Concentration: Finance')).toBe(
      'Area of Concentration',
    );
  });

  it('ignores long prefixes that are really titles', () => {
    expect(
      inferClassificationFromCourseName(
        'A very long sentence about economics that happens to contain: a colon',
      ),
    ).toBeNull();
  });

  it('returns null when there is no colon', () => {
    expect(inferClassificationFromCourseName('Introduction to Testing')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(inferClassificationFromCourseName('')).toBeNull();
    expect(inferClassificationFromCourseName(undefined)).toBeNull();
  });
});

describe('resolveCategoryForCourse', () => {
  const skillsLeaf = {
    name: 'Skills',
    path: 'Contextual Studies/Skills',
    ancestors: [{ id: 'ctx', name: 'Contextual Studies' }],
    validClassifications: ['skills'],
  };
  const compulsoryLeaf = {
    name: 'Compulsory Subjects',
    path: 'Core Studies/Compulsory Subjects',
    ancestors: [{ id: 'core', name: 'Core Studies' }],
    validClassifications: ['compulsory'],
  };
  const focusLeaf = {
    name: 'Area of Concentration',
    path: 'Core Studies/Area of Concentration',
    ancestors: [{ id: 'core', name: 'Core Studies' }],
    validClassifications: ['focus', 'schwerpunkt', 'Concentration'],
  };

  it('prefers the classification match over the course name', () => {
    const result = resolveCategoryForCourse({
      classification: 'compulsory',
      courseName: 'Skills: Julia',
      flatCategories: [compulsoryLeaf, skillsLeaf],
    });
    expect(result?.path).toBe('Core Studies/Compulsory Subjects');
  });

  it('falls back to the course-name prefix when the classification does not match', () => {
    const result = resolveCategoryForCourse({
      classification: 'unknown classification',
      courseName: 'Skills: Julia - A Fresh Approach',
      flatCategories: [compulsoryLeaf, skillsLeaf],
    });
    expect(result?.path).toBe('Contextual Studies/Skills');
  });

  it('routes a Skills prefix to the focus area when no skills leaf exists', () => {
    const result = resolveCategoryForCourse({
      classification: 'unknown classification',
      courseName: 'Skills: Julia - A Fresh Approach',
      flatCategories: [compulsoryLeaf, focusLeaf],
    });
    expect(result?.path).toBe('Core Studies/Area of Concentration');
  });

  it('uses the course-name prefix to disambiguate an ambiguous ancestor', () => {
    const focusUnderCtx = { ...focusLeaf, path: 'Contextual Studies/Area of Concentration',
      ancestors: [{ id: 'ctx', name: 'Contextual Studies' }] };

    const result = resolveCategoryForCourse({
      classification: 'Contextual Studies',
      courseName: 'Skills: Julia - A Fresh Approach to Computing',
      flatCategories: [compulsoryLeaf, focusUnderCtx, skillsLeaf],
    });
    expect(result?.path).toBe('Contextual Studies/Skills');
  });

  it('stays under the classified ancestor when the name carries no prefix', () => {
    const focusUnderCtx = { ...focusLeaf, path: 'Contextual Studies/Area of Concentration',
      ancestors: [{ id: 'ctx', name: 'Contextual Studies' }] };

    const result = resolveCategoryForCourse({
      classification: 'Contextual Studies',
      courseName: 'Julia for Economists',
      flatCategories: [compulsoryLeaf, focusUnderCtx, skillsLeaf],
    });
    expect(result?.path).toBe('Contextual Studies/Area of Concentration');
  });

  it('never leaves the classified ancestor for a name-prefix match elsewhere', () => {
    const coreElectives = {
      name: 'Core Electives',
      path: 'Core Studies/Core Electives',
      ancestors: [{ id: 'core', name: 'Core Studies' }],
      validClassifications: ['elective'],
    };

    const result = resolveCategoryForCourse({
      classification: 'Core Studies',
      courseName: 'Skills: Julia - A Fresh Approach',
      flatCategories: [compulsoryLeaf, coreElectives, skillsLeaf],
    });
    expect(result?.path).toBe('Core Studies/Compulsory Subjects');
  });

  it('returns undefined when neither classification nor name resolves', () => {
    const result = resolveCategoryForCourse({
      classification: 'unknown classification',
      courseName: 'Mystery Course',
      flatCategories: [compulsoryLeaf],
    });
    expect(result).toBeUndefined();
  });
});
