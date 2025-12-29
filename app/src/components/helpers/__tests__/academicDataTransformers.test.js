/**
 * academicDataTransformers.test.js
 * Unit tests for academic data transformation utilities
 */

import { describe, it, expect, vi } from 'vitest';
import {
  findMainProgram,
  extractCompletedCourses,
  buildTranscriptView,
  calculateProgramStats,
  enrichCourseFromAvailable,
  getAvailableCoursesWithFallback,
  buildSemesterStudyOverview
} from '../academicDataTransformers';

describe('findMainProgram', () => {
  it('returns null for empty programs', () => {
    expect(findMainProgram({})).toBeNull();
    expect(findMainProgram(null)).toBeNull();
    expect(findMainProgram(undefined)).toBeNull();
  });

  it('returns explicitly marked main program', () => {
    const programs = {
      'Bachelor in Law': { isMainStudy: false },
      'Bachelor in Business': { isMainStudy: true },
      'Minor in Economics': { isMainStudy: false }
    };
    expect(findMainProgram(programs)).toBe('Bachelor in Business');
  });

  it('prefers Master over Bachelor when no explicit main', () => {
    const programs = {
      'Bachelor in Law': {},
      'Master in Finance': {},
      'Minor in Economics': {}
    };
    expect(findMainProgram(programs)).toBe('Master in Finance');
  });

  it('falls back to Bachelor when no Master', () => {
    const programs = {
      'Minor in Economics': {},
      'Bachelor in Law': {},
      'Certificate in Data Science': {}
    };
    expect(findMainProgram(programs)).toBe('Bachelor in Law');
  });

  it('falls back to first program when no Master/Bachelor', () => {
    const programs = {
      'Minor in Economics': {},
      'Certificate in Data Science': {}
    };
    expect(findMainProgram(programs)).toBe('Minor in Economics');
  });
});

describe('extractCompletedCourses', () => {
  it('returns empty array for null/undefined input', () => {
    expect(extractCompletedCourses(null)).toEqual([]);
    expect(extractCompletedCourses(undefined)).toEqual([]);
    expect(extractCompletedCourses([])).toEqual([]);
  });

  it('extracts courses with grades from flat structure', () => {
    const items = [
      { id: '1', gradeText: '5.5', isTitle: false },
      { id: '2', gradeText: '', isTitle: false },
      { id: '3', gradeText: '4.0', isTitle: false }
    ];
    const result = extractCompletedCourses(items);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });

  it('skips title items', () => {
    const items = [
      { id: '1', gradeText: '5.5', isTitle: true },
      { id: '2', gradeText: '4.0', isTitle: false }
    ];
    const result = extractCompletedCourses(items);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('extracts from nested structure', () => {
    const items = [
      {
        isTitle: true,
        items: [
          { id: '1', gradeText: '5.5', isTitle: false },
          {
            isTitle: true,
            items: [
              { id: '2', gradeText: '4.0', isTitle: false }
            ]
          }
        ]
      }
    ];
    const result = extractCompletedCourses(items);
    expect(result).toHaveLength(2);
    expect(result[0].level).toBe(1);
    expect(result[1].level).toBe(2);
  });

  it('adds source and isCompleted flags', () => {
    const items = [{ id: '1', gradeText: '5.5', isTitle: false }];
    const result = extractCompletedCourses(items);
    expect(result[0].source).toBe('completed');
    expect(result[0].isCompleted).toBe(true);
  });
});

describe('buildTranscriptView', () => {
  it('returns empty structure for null input', () => {
    const result = buildTranscriptView(null);
    expect(result.programInfo).toEqual({});
    expect(result.hierarchicalStructure).toEqual([]);
    expect(result.completedCourses).toEqual([]);
    expect(result.plannedCourses).toEqual([]);
  });

  it('extracts program info correctly', () => {
    const rawScorecard = {
      creditsDe: 90,
      creditsEn: 90,
      creditsFulfilledDe: true,
      creditsFulfilledEn: false,
      isProcessing: false,
      minCreditsDe: 60,
      minCreditsEn: 30
    };
    const result = buildTranscriptView(rawScorecard);
    expect(result.programInfo.creditsDE).toBe(90);
    expect(result.programInfo.creditsEN).toBe(90);
    expect(result.programInfo.creditsFulfilledDE).toBe(true);
    expect(result.programInfo.creditsFulfilledEN).toBe(false);
  });

  it('preserves hierarchical structure', () => {
    const rawScorecard = {
      items: [
        { id: '1', isTitle: true },
        { id: '2', gradeText: '5.0', isTitle: false }
      ]
    };
    const result = buildTranscriptView(rawScorecard);
    expect(result.hierarchicalStructure).toHaveLength(2);
  });
});

describe('calculateProgramStats', () => {
  it('calculates credits earned correctly', () => {
    const enrolled = [
      { credits: 6 },
      { credits: 3 },
      { ects: 4 }
    ];
    const result = calculateProgramStats(enrolled, []);
    expect(result.creditsEarned).toBe(13);
  });

  it('handles missing credit values', () => {
    const enrolled = [
      { credits: 6 },
      { name: 'No credits' },
      { credits: 'invalid' }
    ];
    const result = calculateProgramStats(enrolled, []);
    expect(result.creditsEarned).toBe(6);
  });

  it('calculates completion percentage', () => {
    const enrolled = [{ credits: 60 }];
    const rawScorecard = { creditsDe: 90, creditsEn: 90 };
    const result = calculateProgramStats(enrolled, [], rawScorecard);
    expect(result.completionPercentage).toBe(33); // 60/180 = 33%
  });

  it('counts courses correctly', () => {
    const enrolled = [{}, {}, {}];
    const selected = [{}, {}];
    const result = calculateProgramStats(enrolled, selected);
    expect(result.coursesCompleted).toBe(3);
    expect(result.coursesPlanned).toBe(2);
  });
});

describe('enrichCourseFromAvailable', () => {
  const availableCourses = [
    {
      courseNumber: 'ABC123',
      shortName: 'Intro to ABC',
      credits: 600,
      classification: 'core',
      avgRating: 4.5
    },
    {
      id: 'DEF456',
      name: 'Advanced DEF',
      credits: 300,
      classification: 'elective'
    }
  ];

  it('enriches course by courseNumber match', () => {
    const result = enrichCourseFromAvailable('ABC123', availableCourses);
    expect(result.name).toBe('Intro to ABC');
    expect(result.credits).toBe(6);
    expect(result.classification).toBe('core');
    expect(result.isEnriched).toBe(true);
  });

  it('enriches course by id match', () => {
    const result = enrichCourseFromAvailable('DEF456', availableCourses);
    expect(result.name).toBe('Advanced DEF');
    expect(result.credits).toBe(3);
    expect(result.isEnriched).toBe(true);
  });

  it('returns fallback for unknown course', () => {
    const result = enrichCourseFromAvailable('UNKNOWN', availableCourses);
    expect(result.name).toBe('UNKNOWN');
    expect(result.credits).toBe(3);
    expect(result.isEnriched).toBe(false);
  });

  it('marks assigned courses correctly', () => {
    const result = enrichCourseFromAvailable('ABC123', availableCourses, {
      enrolledIds: ['ABC123', 'OTHER']
    });
    expect(result.isAssigned).toBe(true);
  });

  it('preserves 0 credits when specified', () => {
    const coursesWithZero = [
      { courseNumber: 'ZERO', shortName: 'Zero Credit Course', credits: 0 }
    ];
    const result = enrichCourseFromAvailable('ZERO', coursesWithZero);
    expect(result.credits).toBe(0);
  });
});

describe('getAvailableCoursesWithFallback', () => {
  it('returns courses from target semester when available', () => {
    const semesters = {
      'HS24': { available: [{ id: '1' }, { id: '2' }] }
    };
    const result = getAvailableCoursesWithFallback('HS24', semesters);
    expect(result).toHaveLength(2);
  });

  it('falls back to reference semester for projected semesters', () => {
    const semesters = {
      'HS25': { available: [], isProjected: true, referenceSemester: 'HS24' },
      'HS24': { available: [{ id: '1' }] }
    };
    const result = getAvailableCoursesWithFallback('HS25', semesters);
    expect(result).toHaveLength(1);
  });

  it('falls back to current semester when no reference', () => {
    const semesters = {
      'HS25': { available: [] },
      'HS24': { available: [{ id: '1' }], isCurrent: true }
    };
    const result = getAvailableCoursesWithFallback('HS25', semesters);
    expect(result).toHaveLength(1);
  });

  it('returns empty array when no fallback available', () => {
    const semesters = {
      'HS25': { available: [] }
    };
    const result = getAvailableCoursesWithFallback('HS25', semesters);
    expect(result).toEqual([]);
  });
});

describe('buildSemesterStudyOverview', () => {
  it('builds correct structure with enrolled and selected courses', () => {
    const enrolled = [{ id: '1', name: 'Course 1', credits: 3 }];
    const selectedIds = ['2'];
    const available = [{ courseNumber: '2', shortName: 'Course 2', credits: 300 }];

    const result = buildSemesterStudyOverview('HS24', enrolled, selectedIds, available);

    expect(result.enrolledCourses).toHaveLength(1);
    expect(result.enrolledCourses[0].isCompleted).toBe(true);
    expect(result.selectedCourses).toHaveLength(1);
    expect(result.selectedCourses[0].isPlanned).toBe(true);
  });

  it('filters out selected courses that are already enrolled', () => {
    const enrolled = [{ id: '1', courseId: '1' }];
    const selectedIds = ['1', '2'];
    const available = [
      { courseNumber: '1', shortName: 'Course 1' },
      { courseNumber: '2', shortName: 'Course 2' }
    ];

    const result = buildSemesterStudyOverview('HS24', enrolled, selectedIds, available);

    expect(result.selectedCourses).toHaveLength(1);
    expect(result.selectedCourses[0].courseId).toBe('2');
  });

  it('calculates semester stats correctly', () => {
    const enrolled = [
      { id: '1', credits: 6 },
      { id: '2', credits: 3 }
    ];
    const selectedIds = ['3'];
    const available = [{ courseNumber: '3', credits: 300 }];

    const result = buildSemesterStudyOverview('HS24', enrolled, selectedIds, available);

    expect(result.semesterStats.creditsEarned).toBe(9);
    expect(result.semesterStats.coursesCompleted).toBe(2);
    expect(result.semesterStats.coursesPlanned).toBe(1);
    expect(result.semesterStats.hasActivity).toBe(true);
  });

  it('returns hasActivity false when no courses', () => {
    const result = buildSemesterStudyOverview('HS24', [], [], []);
    expect(result.semesterStats.hasActivity).toBe(false);
  });
});
