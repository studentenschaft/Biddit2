/**
 * CoursePicker.test.jsx
 * Tests for the CoursePicker sidebar component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { DndContext } from '@dnd-kit/core';
import CoursePicker from '../CoursePicker';
import { unifiedCourseDataState } from '../../../recoil/unifiedCourseDataAtom';
import { localSelectedCoursesSemKeyState } from '../../../recoil/localSelectedCoursesSemKeyAtom';
import { curriculumPlanState } from '../../../recoil/curriculumPlanAtom';

// Test wrapper with all required providers
const TestWrapper = ({ children, initialState = {} }) => {
  const initializeState = ({ set }) => {
    // Set up unified course data
    set(unifiedCourseDataState, {
      semesters: {
        'FS26': {
          available: [
            { courseNumber: 'ABC123', shortName: 'Test Course 1', credits: 600, classification: 'core' },
            { courseNumber: 'DEF456', shortName: 'Test Course 2', credits: 300, classification: 'elective' },
            { courseNumber: 'GHI789', shortName: 'Machine Learning', credits: 600, classification: 'core' },
          ],
        },
        'HS26': {
          available: [
            { courseNumber: 'JKL012', shortName: 'Advanced Topics', credits: 600, classification: 'elective' },
          ],
        },
      },
      ...initialState.unifiedCourseData,
    });

    // Set up local selected courses (wishlist)
    set(localSelectedCoursesSemKeyState, {
      'FS26': initialState.selectedCourses || [],
    });

    // Set up curriculum plan
    set(curriculumPlanState, {
      plannedItems: initialState.plannedItems || {},
      validations: { conflicts: [], categoryWarnings: [], availabilityWarnings: [] },
    });
  };

  return (
    <RecoilRoot initializeState={initializeState}>
      <DndContext>{children}</DndContext>
    </RecoilRoot>
  );
};

describe('CoursePicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15')); // During FS26
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders the header', () => {
      render(
        <TestWrapper>
          <CoursePicker futureSemesters={['FS26', 'HS26']} />
        </TestWrapper>
      );

      expect(screen.getByText('Add Courses')).toBeInTheDocument();
    });

    it('renders semester selector', () => {
      render(
        <TestWrapper>
          <CoursePicker futureSemesters={['FS26', 'HS26']} />
        </TestWrapper>
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('renders search input', () => {
      render(
        <TestWrapper>
          <CoursePicker futureSemesters={['FS26', 'HS26']} />
        </TestWrapper>
      );

      expect(screen.getByPlaceholderText('Search courses...')).toBeInTheDocument();
    });

    it('renders available courses', () => {
      render(
        <TestWrapper>
          <CoursePicker futureSemesters={['FS26', 'HS26']} />
        </TestWrapper>
      );

      expect(screen.getByText('Test Course 1')).toBeInTheDocument();
      expect(screen.getByText('Test Course 2')).toBeInTheDocument();
      expect(screen.getByText('Machine Learning')).toBeInTheDocument();
    });

    it('displays credits in ECTS format', () => {
      render(
        <TestWrapper>
          <CoursePicker futureSemesters={['FS26', 'HS26']} />
        </TestWrapper>
      );

      // 600 credits = 6 ECTS (two courses), 300 credits = 3 ECTS (one course)
      const sixEctsElements = screen.getAllByText('6 ECTS');
      expect(sixEctsElements.length).toBe(2); // Two courses with 6 ECTS
      expect(screen.getByText('3 ECTS')).toBeInTheDocument();
    });
  });

  describe('semester selection', () => {
    it('changes courses when semester is selected', () => {
      render(
        <TestWrapper>
          <CoursePicker futureSemesters={['FS26', 'HS26']} />
        </TestWrapper>
      );

      // Initially FS26 courses are shown
      expect(screen.getByText('Test Course 1')).toBeInTheDocument();

      // Change to HS26
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'HS26' } });

      // Now HS26 courses should be shown
      expect(screen.getByText('Advanced Topics')).toBeInTheDocument();
      expect(screen.queryByText('Test Course 1')).not.toBeInTheDocument();
    });
  });

  describe('search filtering', () => {
    it('filters courses by name', () => {
      render(
        <TestWrapper>
          <CoursePicker futureSemesters={['FS26', 'HS26']} />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText('Search courses...');
      fireEvent.change(searchInput, { target: { value: 'Machine' } });

      expect(screen.getByText('Machine Learning')).toBeInTheDocument();
      expect(screen.queryByText('Test Course 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Test Course 2')).not.toBeInTheDocument();
    });

    it('shows no results message when search has no matches', () => {
      render(
        <TestWrapper>
          <CoursePicker futureSemesters={['FS26', 'HS26']} />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText('Search courses...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText(/No courses match/)).toBeInTheDocument();
    });

    it('filters by classification', () => {
      render(
        <TestWrapper>
          <CoursePicker futureSemesters={['FS26', 'HS26']} />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText('Search courses...');
      fireEvent.change(searchInput, { target: { value: 'elective' } });

      expect(screen.getByText('Test Course 2')).toBeInTheDocument();
      expect(screen.queryByText('Test Course 1')).not.toBeInTheDocument();
    });
  });

  describe('already added courses', () => {
    it('excludes courses already in wishlist', () => {
      const selectedCourses = [
        { id: 'ABC123', courseNumber: 'ABC123' },
      ];

      render(
        <TestWrapper initialState={{ selectedCourses }}>
          <CoursePicker futureSemesters={['FS26', 'HS26']} />
        </TestWrapper>
      );

      // ABC123 should not be shown as it's already in wishlist
      expect(screen.queryByText('Test Course 1')).not.toBeInTheDocument();
      // Other courses should still be shown
      expect(screen.getByText('Test Course 2')).toBeInTheDocument();
    });

    it('excludes courses already in curriculum plan', () => {
      const plannedItems = {
        'FS26': [{ type: 'course', courseId: 'DEF456' }],
      };

      render(
        <TestWrapper initialState={{ plannedItems }}>
          <CoursePicker futureSemesters={['FS26', 'HS26']} />
        </TestWrapper>
      );

      // DEF456 should not be shown as it's already planned
      expect(screen.queryByText('Test Course 2')).not.toBeInTheDocument();
      // Other courses should still be shown
      expect(screen.getByText('Test Course 1')).toBeInTheDocument();
    });

    it('shows message when all courses are added', () => {
      const selectedCourses = [
        { id: 'ABC123', courseNumber: 'ABC123' },
        { id: 'DEF456', courseNumber: 'DEF456' },
        { id: 'GHI789', courseNumber: 'GHI789' },
      ];

      render(
        <TestWrapper initialState={{ selectedCourses }}>
          <CoursePicker futureSemesters={['FS26', 'HS26']} />
        </TestWrapper>
      );

      expect(screen.getByText(/All courses already added/)).toBeInTheDocument();
    });
  });

  describe('course count display', () => {
    it('shows count of available courses', () => {
      render(
        <TestWrapper>
          <CoursePicker futureSemesters={['FS26', 'HS26']} />
        </TestWrapper>
      );

      expect(screen.getByText('3 courses available')).toBeInTheDocument();
    });

    it('shows filtered count when searching', () => {
      render(
        <TestWrapper>
          <CoursePicker futureSemesters={['FS26', 'HS26']} />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText('Search courses...');
      fireEvent.change(searchInput, { target: { value: 'Machine' } });

      expect(screen.getByText('Showing 1 of 3')).toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    it('shows message when no course data available', () => {
      render(
        <TestWrapper initialState={{ unifiedCourseData: { semesters: {} } }}>
          <CoursePicker futureSemesters={[]} />
        </TestWrapper>
      );

      expect(screen.getByText('No course data available.')).toBeInTheDocument();
    });
  });

  describe('course card', () => {
    it('shows grab cursor for course cards', () => {
      const { container } = render(
        <TestWrapper>
          <CoursePicker futureSemesters={['FS26', 'HS26']} />
        </TestWrapper>
      );

      // Find course cards (they have the cursor-grab class)
      const courseCards = container.querySelectorAll('.cursor-grab');
      expect(courseCards.length).toBeGreaterThan(0);
    });

    it('displays classification when available', () => {
      render(
        <TestWrapper>
          <CoursePicker futureSemesters={['FS26', 'HS26']} />
        </TestWrapper>
      );

      // Two courses have 'core' classification, one has 'elective'
      const coreElements = screen.getAllByText('core');
      expect(coreElements.length).toBe(2);
      expect(screen.getByText('elective')).toBeInTheDocument();
    });
  });
});
