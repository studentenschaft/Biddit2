import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '../../../../tests/utils/renderWithProviders.jsx'
import { useTermSelection } from '../useTermSelection'
import { useUnifiedCourseData } from '../useUnifiedCourseData'
import { authTokenState } from '../../recoil/authAtom'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../tests/msw/server.js'

describe('useTermSelection (integration with MSW)', () => {
  it('builds term list, sets latest valid term, and updates enrolledIds', async () => {
    // MSW: terms list
    server.use(
      http.get('https://integration.unisg.ch/EventApi/CisTermAndPhaseInformations', () =>
        HttpResponse.json([
          { shortName: 'FS24', timeSegmentId: 'TID-FS24', id: 'CIS-FS24', isCurrent: false },
          { shortName: 'HS24', timeSegmentId: 'TID-HS24', id: 'CIS-HS24', isCurrent: true },
          { shortName: 'FS25', timeSegmentId: 'TID-FS25', id: 'CIS-FS25', isCurrent: false },
        ])
      ),
      // MyCourses for current term (HS24)
      http.get('https://integration.unisg.ch/EventApi/MyCourses/byTerm/TID-HS24', () =>
        HttpResponse.json([{ courseNumber: 'X-101' }])
      ),
    )

    const wrapper = createWrapper({
      initializeState: ({ set }) => {
        set(authTokenState, 'TEST_TOKEN')
      },
    })

    const { result } = renderHook(() => {
      const termSel = useTermSelection()
      const unified = useUnifiedCourseData()
      return { termSel, unified }
    }, { wrapper })

    await waitFor(() => {
      expect(result.current.termSel.termListObject.length).toBeGreaterThan(0)
    })

    // Expect latestValidTerm set to current (HS24) and enrolledIds updated
    const hasHS24 = result.current.unified.courseData.semesters['HS24']
    expect(result.current.unified.courseData.latestValidTerm).toBe('HS24')
    expect(Array.isArray(hasHS24?.enrolledIds)).toBe(true)
    expect(hasHS24.enrolledIds).toContain('X-101')
  })
})
