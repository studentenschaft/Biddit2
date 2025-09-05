import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '../../../../tests/utils/renderWithProviders.jsx'
import { useUnifiedCourseLoader } from '../useUnifiedCourseLoader'
import { useUnifiedCourseData } from '../useUnifiedCourseData'
import { authTokenState } from '../../recoil/authAtom'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../tests/msw/server.js'

describe('useUnifiedCourseLoader (integration with MSW)', () => {
  it('loads available courses for target and reference semesters and reports enrichment ready', async () => {
    // Terms list to support useTermSelection inside loader
    server.use(
      http.get('https://integration.unisg.ch/EventApi/CisTermAndPhaseInformations', () =>
        HttpResponse.json([
          { shortName: 'FS25', timeSegmentId: 'TID-FS25', id: 'CIS-FS25', isCurrent: true },
          { shortName: 'HS25', timeSegmentId: 'TID-HS25', id: 'CIS-HS25', isCurrent: false },
        ])
      ),
      // MyCourses for FS25 (minimal)
      http.get('https://integration.unisg.ch/EventApi/MyCourses/byTerm/TID-FS25', () =>
        HttpResponse.json([])
      ),
      // CourseInformationSheets for FS25
      http.get('https://integration.unisg.ch/EventApi/CourseInformationSheets/myLatestPublishedPossiblebyTerm/CIS-FS25', () =>
        HttpResponse.json([
          { courseNumber: 'C-1', shortName: 'Algorithms', credits: 6 },
        ])
      ),
    )

    const wrapper = createWrapper({
      initializeState: ({ set, get }) => {
        set(authTokenState, 'TOKEN')
        // Pre-populate unified state with a projected semester FS26 referencing FS25 with selectedIds
        const base = {
          semesters: {
            FS26: {
              enrolledIds: [],
              available: [],
              selectedIds: ['C-1'],
              filtered: [],
              studyPlan: [],
              ratings: {},
              lastFetched: null,
              isFutureSemester: true,
              referenceSemester: 'FS25',
              cisId: null,
              isCurrent: false,
              isProjected: true,
            },
            FS25: {
              enrolledIds: [],
              available: [],
              selectedIds: [],
              filtered: [],
              studyPlan: [],
              ratings: {},
              lastFetched: null,
              isFutureSemester: false,
              referenceSemester: null,
              cisId: 'CIS-FS25',
              isCurrent: true,
              isProjected: false,
            },
          },
          selectedSemester: 'FS25',
          latestValidTerm: 'FS25',
          selectedCourseInfo: null,
        }
        const { unifiedCourseDataState } = require('../../recoil/unifiedCourseDataAtom')
        set(unifiedCourseDataState, base)
      },
    })

    const { result } = renderHook(() => {
      const unified = useUnifiedCourseData()
      const loader = useUnifiedCourseLoader('TOKEN', unified.courseData)
      return { loader, unified }
    }, { wrapper })

    // FS25 should have available data loaded from MSW
    await waitFor(() => {
      expect(result.current.unified.courseData.semesters['FS25'].available.length).toBeGreaterThan(0)
    })
    // Projected FS26 reports enrichment available via reference FS25
    expect(result.current.loader.hasEnrichmentDataForSemester('FS26')).toBe(true)
  })
})
