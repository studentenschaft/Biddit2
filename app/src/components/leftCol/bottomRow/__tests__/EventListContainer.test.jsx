import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../../tests/utils/renderWithProviders.jsx'
import EventListContainer from '../EventListContainer.jsx'
import { unifiedCourseDataState } from '../../../recoil/unifiedCourseDataAtom'
import { selectionOptionsState } from '../../../recoil/selectionOptionsAtom'
import { authTokenState } from '../../../recoil/authAtom'

// Mock AutoSizer to provide fixed dimensions in tests
vi.mock('react-virtualized-auto-sizer', () => ({
  default: ({ children }) => children({ height: 400, width: 600 }),
}))

// Control hook loading state via a shared flag
let mockIsLoading = false
vi.mock('../../../helpers/useEventListDataManager', () => ({
  useEventListDataManager: () => ({
    isLoading: mockIsLoading,
    isEnrolledCoursesLoading: mockIsLoading,
    isCourseDataLoading: mockIsLoading,
    isStudyPlanLoading: mockIsLoading,
    isCourseRatingsLoading: mockIsLoading,
  }),
}))

describe('EventListContainer (UI states)', () => {
  const termListObject = [
    { cisId: 'CIS-FS25', id: 'TID-FS25', shortName: 'FS25', isCurrent: true, isProjected: false, isFuture: false },
  ]

  beforeEach(() => {
    mockIsLoading = false
  })

  it('shows a loading row when loading', () => {
    mockIsLoading = true

    renderWithProviders(
      <EventListContainer termListObject={termListObject} selectedSemesterShortName="FS25" />,
      {
        initializeState: ({ set }) => {
          set(authTokenState, 'TEST')
          set(selectionOptionsState, {})
          set(unifiedCourseDataState, { semesters: { FS25: { filtered: [] } } })
        },
      }
    )

    expect(screen.getByText(/Loading courses/i)).toBeInTheDocument()
  })

  it('shows empty state when no filtered courses', () => {
    mockIsLoading = false

    renderWithProviders(
      <EventListContainer termListObject={termListObject} selectedSemesterShortName="FS25" />,
      {
        initializeState: ({ set }) => {
          set(authTokenState, 'TEST')
          set(selectionOptionsState, {})
          set(unifiedCourseDataState, { semesters: { FS25: { filtered: [] } } })
        },
      }
    )

    expect(screen.getByText(/No matching courses/i)).toBeInTheDocument()
  })

  it('renders rows for filtered courses', () => {
    mockIsLoading = false

    const filtered = [
      { courseNumber: 'C-1', shortName: 'Algorithms', classification: 'CS', credits: 600 },
      { courseNumber: 'C-2', shortName: 'Databases', classification: 'CS', credits: 600 },
    ]

    renderWithProviders(
      <EventListContainer termListObject={termListObject} selectedSemesterShortName="FS25" />,
      {
        initializeState: ({ set }) => {
          set(authTokenState, 'TEST')
          set(selectionOptionsState, {})
          set(unifiedCourseDataState, { semesters: { FS25: { filtered } } })
        },
      }
    )

    expect(screen.getByText('Algorithms')).toBeInTheDocument()
    expect(screen.getByText('Databases')).toBeInTheDocument()
  })
})
