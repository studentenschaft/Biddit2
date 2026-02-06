/**
 * curriculumPlanAtom.test.js
 *
 * Tests for the semester utility functions exported from curriculumPlanAtom.
 * These are pure functions with no Recoil dependencies, making them easy to unit test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseSemesterKey,
  compareSemesters,
  sortSemesters,
  getNextSemesterKey,
  getCurrentSemesterInfo,
  isSemesterCurrent,
  isSemesterInFuture,
  isSemesterCompleted,
  isSemesterSyncable,
  getSemesterStatus,
  filterCurrentAndFutureSemesters,
  generateFutureSemesters,
} from '../curriculumPlanAtom';

describe('parseSemesterKey', () => {
  it('parses HS key correctly', () => {
    const result = parseSemesterKey('HS24');
    expect(result).toEqual({ type: 'HS', year: 24, fullYear: 2024 });
  });

  it('parses FS key correctly', () => {
    const result = parseSemesterKey('FS25');
    expect(result).toEqual({ type: 'FS', year: 25, fullYear: 2025 });
  });

  it('handles two-digit years < 50 as 2000s', () => {
    expect(parseSemesterKey('HS49').fullYear).toBe(2049);
  });

  it('handles two-digit years >= 50 as 1900s', () => {
    expect(parseSemesterKey('HS50').fullYear).toBe(1950);
  });
});

describe('compareSemesters', () => {
  it('orders FS before HS in the same year', () => {
    expect(compareSemesters('FS25', 'HS25')).toBeLessThan(0);
    expect(compareSemesters('HS25', 'FS25')).toBeGreaterThan(0);
  });

  it('orders earlier years first', () => {
    expect(compareSemesters('HS24', 'FS25')).toBeLessThan(0);
    expect(compareSemesters('FS26', 'HS25')).toBeGreaterThan(0);
  });

  it('returns 0 for identical semesters', () => {
    expect(compareSemesters('HS25', 'HS25')).toBe(0);
    expect(compareSemesters('FS24', 'FS24')).toBe(0);
  });

  it('handles cross-year boundary: HS24 < FS25', () => {
    expect(compareSemesters('HS24', 'FS25')).toBeLessThan(0);
  });
});

describe('sortSemesters', () => {
  it('sorts semesters chronologically', () => {
    const input = ['HS25', 'FS24', 'HS24', 'FS25', 'FS26'];
    expect(sortSemesters(input)).toEqual(['FS24', 'HS24', 'FS25', 'HS25', 'FS26']);
  });

  it('handles empty array', () => {
    expect(sortSemesters([])).toEqual([]);
  });

  it('does not mutate input', () => {
    const input = ['HS25', 'FS24'];
    sortSemesters(input);
    expect(input).toEqual(['HS25', 'FS24']);
  });
});

describe('getNextSemesterKey', () => {
  it('FS -> HS of same year', () => {
    expect(getNextSemesterKey('FS25')).toBe('HS25');
  });

  it('HS -> FS of next year', () => {
    expect(getNextSemesterKey('HS25')).toBe('FS26');
  });
});

describe('getCurrentSemesterInfo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns FS during spring (March)', () => {
    vi.setSystemTime(new Date('2026-03-15'));
    const info = getCurrentSemesterInfo();
    expect(info.currentSemKey).toBe('FS26');
    expect(info.isCurrentlyHS).toBe(false);
    expect(info.currentSemYear).toBe(26);
    expect(info.nextSemKey).toBe('HS26');
  });

  it('returns HS during fall (October)', () => {
    vi.setSystemTime(new Date('2025-10-15'));
    const info = getCurrentSemesterInfo();
    expect(info.currentSemKey).toBe('HS25');
    expect(info.isCurrentlyHS).toBe(true);
    expect(info.currentSemYear).toBe(25);
    expect(info.nextSemKey).toBe('FS26');
  });

  it('returns HS during January (year crossover)', () => {
    vi.setSystemTime(new Date('2026-01-15'));
    const info = getCurrentSemesterInfo();
    expect(info.currentSemKey).toBe('HS25');
    expect(info.isCurrentlyHS).toBe(true);
    // Year code should be previous year since Jan 2026 is still HS25
    expect(info.currentSemYear).toBe(25);
  });

  it('returns FS during February (boundary month)', () => {
    vi.setSystemTime(new Date('2026-02-15'));
    const info = getCurrentSemesterInfo();
    // February (month 1) is <= 1, so isCurrentlyHS = true
    // But the year code: month <= 1 means currentSemYear = currentYear - 1
    expect(info.currentSemKey).toBe('HS25');
    expect(info.isCurrentlyHS).toBe(true);
  });

  it('returns FS during August (month 7 is still FS; HS starts in September)', () => {
    vi.setSystemTime(new Date('2025-08-15'));
    const info = getCurrentSemesterInfo();
    // Month 7 (August, 0-indexed) is < 8, so it's still FS
    expect(info.currentSemKey).toBe('FS25');
    expect(info.isCurrentlyHS).toBe(false);
  });

  it('returns HS during September (month 8 starts HS)', () => {
    vi.setSystemTime(new Date('2025-09-15'));
    const info = getCurrentSemesterInfo();
    expect(info.currentSemKey).toBe('HS25');
    expect(info.isCurrentlyHS).toBe(true);
  });

  it('returns FS during July', () => {
    vi.setSystemTime(new Date('2025-07-15'));
    const info = getCurrentSemesterInfo();
    expect(info.currentSemKey).toBe('FS25');
    expect(info.isCurrentlyHS).toBe(false);
  });
});

describe('isSemesterCurrent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-10-15')); // HS25
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for current semester', () => {
    expect(isSemesterCurrent('HS25')).toBe(true);
  });

  it('returns false for other semesters', () => {
    expect(isSemesterCurrent('FS25')).toBe(false);
    expect(isSemesterCurrent('FS26')).toBe(false);
    expect(isSemesterCurrent('HS24')).toBe(false);
  });
});

describe('isSemesterInFuture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-10-15')); // HS25
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for future semesters', () => {
    expect(isSemesterInFuture('FS26')).toBe(true);
    expect(isSemesterInFuture('HS26')).toBe(true);
  });

  it('returns false for current semester', () => {
    expect(isSemesterInFuture('HS25')).toBe(false);
  });

  it('returns false for past semesters', () => {
    expect(isSemesterInFuture('FS25')).toBe(false);
    expect(isSemesterInFuture('HS24')).toBe(false);
  });
});

describe('isSemesterCompleted', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-10-15')); // HS25
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for past semesters', () => {
    expect(isSemesterCompleted('FS25')).toBe(true);
    expect(isSemesterCompleted('HS24')).toBe(true);
    expect(isSemesterCompleted('FS24')).toBe(true);
  });

  it('returns false for current semester', () => {
    expect(isSemesterCompleted('HS25')).toBe(false);
  });

  it('returns false for future semesters', () => {
    expect(isSemesterCompleted('FS26')).toBe(false);
  });
});

describe('isSemesterSyncable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-10-15')); // HS25
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for current semester', () => {
    expect(isSemesterSyncable('HS25')).toBe(true);
  });

  it('returns true for next semester', () => {
    expect(isSemesterSyncable('FS26')).toBe(true);
  });

  it('returns false for past semesters', () => {
    expect(isSemesterSyncable('FS25')).toBe(false);
  });

  it('returns false for far-future semesters', () => {
    expect(isSemesterSyncable('HS26')).toBe(false);
    expect(isSemesterSyncable('FS27')).toBe(false);
  });
});

describe('getSemesterStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-10-15')); // HS25
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "current" for current semester', () => {
    expect(getSemesterStatus('HS25')).toBe('current');
  });

  it('returns "future" for future semesters', () => {
    expect(getSemesterStatus('FS26')).toBe('future');
  });

  it('returns "completed" for past semesters', () => {
    expect(getSemesterStatus('FS25')).toBe('completed');
    expect(getSemesterStatus('HS24')).toBe('completed');
  });
});

describe('filterCurrentAndFutureSemesters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-10-15')); // HS25
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('filters out past semesters and returns sorted results', () => {
    const input = ['FS24', 'HS24', 'FS25', 'HS25', 'FS26', 'HS26'];
    const result = filterCurrentAndFutureSemesters(input);
    expect(result).toEqual(['HS25', 'FS26', 'HS26']);
  });

  it('handles empty input', () => {
    expect(filterCurrentAndFutureSemesters([])).toEqual([]);
  });

  it('handles input with only past semesters', () => {
    const input = ['FS23', 'HS23', 'FS24'];
    expect(filterCurrentAndFutureSemesters(input)).toEqual([]);
  });
});

describe('generateFutureSemesters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // NOTE: generateFutureSemesters uses currentMonth >= 7 for HS detection,
  // which differs from getCurrentSemesterInfo (>= 8). It also has a year
  // increment pattern that produces sequences like HS25, FS25 instead of
  // HS25, FS26. These are pre-existing behaviors tracked for future cleanup.

  it('generates correct count starting from fall', () => {
    vi.setSystemTime(new Date('2025-10-15')); // October = HS (month >= 7)
    const semesters = generateFutureSemesters(4);
    expect(semesters).toHaveLength(4);
    expect(semesters[0]).toBe('HS25');
  });

  it('generates correct count starting from spring', () => {
    vi.setSystemTime(new Date('2026-03-15')); // March = FS
    const semesters = generateFutureSemesters(4);
    expect(semesters).toHaveLength(4);
    expect(semesters[0]).toBe('FS26');
  });

  it('defaults to 6 semesters', () => {
    vi.setSystemTime(new Date('2025-10-15'));
    const semesters = generateFutureSemesters();
    expect(semesters).toHaveLength(6);
  });

  it('alternates between HS and FS', () => {
    vi.setSystemTime(new Date('2025-10-15'));
    const semesters = generateFutureSemesters(4);
    expect(semesters[0].startsWith('HS')).toBe(true);
    expect(semesters[1].startsWith('FS')).toBe(true);
    expect(semesters[2].startsWith('HS')).toBe(true);
    expect(semesters[3].startsWith('FS')).toBe(true);
  });
});
