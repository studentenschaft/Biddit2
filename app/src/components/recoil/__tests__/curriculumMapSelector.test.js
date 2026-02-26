/**
 * curriculumMapSelector.test.js
 *
 * Tests for the pure helper functions used by the curriculum map selector.
 * These test business logic without Recoil dependency.
 */

import { describe, it, expect } from 'vitest';
import { _testHelpers } from '../curriculumMapSelector';

const {
  normalizeSemesterKey,
  extractClassifications,
  extractCategoryHierarchy,
  extractCoursesFromHierarchy,
  flattenCategoriesForGrid,
  matchClassificationToCategory,
  estimateCompletion,
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
  const flatCategories = [
    { name: 'Compulsory', path: 'Core/Compulsory', validClassifications: ['compulsory', 'pflicht'] },
    { name: 'Elective', path: 'Core/Elective', validClassifications: ['elective', 'wahl'] },
    { name: 'Contextual Studies', path: 'Context', validClassifications: ['context', 'kontext', 'Kontextstudium'] },
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
    expect(estimateCompletion(180, 180, 0, [])).toBe('Completed');
    expect(estimateCompletion(180, 200, 0, [])).toBe('Completed');
  });

  it('projects from future semesters when available', () => {
    const semesters = [
      { key: 'FS25', status: 'completed', totalCredits: 30 },
      { key: 'HS25', status: 'current', totalCredits: 30 },
      { key: 'FS26', status: 'future', totalCredits: 30 },
      { key: 'HS26', status: 'future', totalCredits: 30 },
    ];
    const result = estimateCompletion(180, 120, 60, semesters);
    // Needs 60 more credits, avg 30/semester = 2 more semesters
    // First future semester is FS26, second is HS26
    expect(result).toBe('HS26');
  });

  it('returns "TBD" when no semesters available', () => {
    expect(estimateCompletion(180, 0, 0, [])).toBe('TBD');
  });
});
