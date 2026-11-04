/**
 * curriculumPlanAtom.test.js
 *
 * The semester predicates curriculumPlanAtom still exports for the curriculum
 * map. Key arithmetic and the calendar rule are tested in src/domain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isSemesterCompleted,
  isSemesterSyncable,
  filterCurrentAndFutureSemesters,
} from '../curriculumPlanAtom';

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
