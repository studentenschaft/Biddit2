import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { createWrapper } from '../../../../tests/utils/renderWithProviders.jsx'
import { useUnifiedCourseData } from '../useUnifiedCourseData'

describe('useUnifiedCourseData (integration)', () => {
  it('initializes semester with metadata and preserves defaults', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useUnifiedCourseData(), { wrapper })

    act(() => {
      result.current.initializeSemester('HS25', { cisId: 'CIS-HS25', isCurrent: true })
    })

    const hs25 = result.current.courseData.semesters['HS25']
    expect(hs25).toBeTruthy()
    expect(hs25.cisId).toBe('CIS-HS25')
    expect(hs25.isCurrent).toBe(true)
    // Defaults
    expect(Array.isArray(hs25.enrolledIds)).toBe(true)
    expect(Array.isArray(hs25.available)).toBe(true)
    expect(Array.isArray(hs25.selectedIds)).toBe(true)
    expect(Array.isArray(hs25.filtered)).toBe(true)
    expect(typeof hs25.ratings).toBe('object')
  })

  it('flattens nested available courses and zeros ECTS for exercise groups', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useUnifiedCourseData(), { wrapper })

    const parent = {
      courseNumber: 'C-100',
      shortName: 'Algorithms',
      credits: 6,
      calendarEntry: [
        { courseNumber: 'C-100A', some: 'eventA' },
        { courseNumber: 'C-100B', some: 'eventB' },
      ],
      courses: [
        { courseNumber: 'C-100A', shortName: 'Algorithms', credits: 6 },
        { courseNumber: 'C-100B', shortName: 'Algorithms Exercises 01', credits: 2 },
      ],
    }

    act(() => {
      result.current.initializeSemester('HS25', { cisId: 'CIS-HS25' })
      result.current.updateAvailableCourses('HS25', [parent])
    })

    const hs25 = result.current.courseData.semesters['HS25']
    expect(hs25.available).toHaveLength(2)
    const main = hs25.available.find(c => c.courseNumber === 'C-100A')
    const ex = hs25.available.find(c => c.courseNumber === 'C-100B')
    expect(main).toBeTruthy()
    expect(ex).toBeTruthy()
    // Exercise group credits zeroed
    expect(ex.credits).toBe(0)
    // Calendar entries filtered per nested course number
    expect(main.calendarEntry?.every(e => e.courseNumber === 'C-100A')).toBe(true)
    expect(ex.calendarEntry?.every(e => e.courseNumber === 'C-100B')).toBe(true)
  })

  it('marks enrolled and selected flags and sorts filtered accordingly', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useUnifiedCourseData(), { wrapper })

    const payload = [
      { courseNumber: 'X-1', shortName: 'Course X1', credits: 3 },
      { courseNumber: 'X-2', shortName: 'Course X2', credits: 3 },
      { courseNumber: 'X-3', shortName: 'Course X3', credits: 3 },
    ]

    act(() => {
      result.current.initializeSemester('FS25', {})
      result.current.updateAvailableCourses('FS25', payload)
      result.current.updateEnrolledCourses('FS25', [{ courseNumber: 'X-2' }])
      result.current.updateSelectedCourses('FS25', ['X-3'])
    })

    await waitFor(() => {
      const fs25pre = result.current.courseData.semesters['FS25']
      expect(fs25pre.available).toHaveLength(3)
      expect(fs25pre.enrolledIds).toEqual(['X-2'])
      expect(fs25pre.selectedIds).toEqual(['X-3'])
    })

    act(() => {
      result.current.updateFilteredCourses('FS25', {})
    })

    await waitFor(() => {
      const fs25 = result.current.courseData.semesters['FS25']
      expect(fs25.filtered).toHaveLength(3)
    })
    const fs25 = result.current.courseData.semesters['FS25']
    const order = fs25.filtered.map(c => ({ id: c.courseNumber, enrolled: !!c.enrolled, selected: !!c.selected }))
    // Enrolled (X-2) should come first, then selected-only (X-3), then others (X-1)
    expect(order[0]).toEqual({ id: 'X-2', enrolled: true, selected: false })
    expect(order[1]).toEqual({ id: 'X-3', enrolled: false, selected: true })
    expect(order[2]).toEqual({ id: 'X-1', enrolled: false, selected: false })
  })
})
