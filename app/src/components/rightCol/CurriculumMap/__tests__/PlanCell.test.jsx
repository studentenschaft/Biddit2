/**
 * PlanCell.test.jsx
 * Tests for the droppable PlanCell component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { RecoilRoot } from 'recoil';
import PlanCell from '../PlanCell';

// Wrapper to provide DndContext and RecoilRoot (needed for PlanItem inside PlanCell)
const TestWrapper = ({ children }) => (
  <RecoilRoot>
    <DndContext>{children}</DndContext>
  </RecoilRoot>
);

describe('PlanCell', () => {
  const defaultProps = {
    semesterKey: 'FS26',
    categoryPath: 'Core/Electives',
    courses: [],
    semesterStatus: 'future',
    validations: null,
    isLastCol: false,
    isCollapsed: false,
    isCategoryComplete: false,
  };

  describe('rendering', () => {
    it('renders empty state for future semesters', () => {
      render(
        <TestWrapper>
          <PlanCell {...defaultProps} />
        </TestWrapper>
      );

      // Empty future cells show a "+" indicator
      expect(screen.getByText('+')).toBeInTheDocument();
    });

    it('does not show empty indicator for completed semesters', () => {
      render(
        <TestWrapper>
          <PlanCell {...defaultProps} semesterStatus="completed" />
        </TestWrapper>
      );

      expect(screen.queryByText('+')).not.toBeInTheDocument();
    });

    it('renders course items', () => {
      const courses = [
        { id: '1', name: 'Course 1', credits: 6, status: 'planned' },
        { id: '2', name: 'Course 2', credits: 3, status: 'planned' },
      ];

      render(
        <TestWrapper>
          <PlanCell {...defaultProps} courses={courses} />
        </TestWrapper>
      );

      expect(screen.getByText('Course 1')).toBeInTheDocument();
      expect(screen.getByText('Course 2')).toBeInTheDocument();
    });

    it('sets data attributes for cell identification', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} />
        </TestWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveAttribute('data-semester', 'FS26');
      expect(cell).toHaveAttribute('data-category', 'Core/Electives');
    });
  });

  describe('semester status styling', () => {
    it('applies completed background for completed semesters', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} semesterStatus="completed" />
        </TestWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('bg-green-50');
    });

    it('applies current background for current semester', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} semesterStatus="current" />
        </TestWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('bg-amber-50');
    });

    it('applies white background for future semesters', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} semesterStatus="future" />
        </TestWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('bg-white');
    });
  });

  describe('validation display', () => {
    it('shows conflict badge when conflicts exist', () => {
      const validations = {
        conflicts: [{ details: 'Time conflict' }],
        warnings: [],
      };

      render(
        <TestWrapper>
          <PlanCell {...defaultProps} validations={validations} />
        </TestWrapper>
      );

      expect(screen.getByText('Conflict')).toBeInTheDocument();
    });

    it('shows warning badge when warnings exist', () => {
      const validations = {
        conflicts: [],
        warnings: [{ warning: 'Credit limit exceeded' }],
      };

      render(
        <TestWrapper>
          <PlanCell {...defaultProps} validations={validations} />
        </TestWrapper>
      );

      expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('applies red ring for conflicts', () => {
      const validations = {
        conflicts: [{ details: 'Time conflict' }],
        warnings: [],
      };

      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} validations={validations} />
        </TestWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('ring-red-400');
      expect(cell).toHaveClass('ring-2');
    });

    it('applies amber ring for warnings', () => {
      const validations = {
        conflicts: [],
        warnings: [{ warning: 'Credit limit exceeded' }],
      };

      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} validations={validations} />
        </TestWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('ring-amber-400');
      expect(cell).toHaveClass('ring-2');
    });

    it('does not show badges when no validations', () => {
      render(
        <TestWrapper>
          <PlanCell {...defaultProps} validations={null} />
        </TestWrapper>
      );

      expect(screen.queryByText('Conflict')).not.toBeInTheDocument();
      expect(screen.queryByText('Warning')).not.toBeInTheDocument();
    });
  });

  describe('corner styling', () => {
    it('applies rounded corner for last row and column', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} isLastRow={true} isLastCol={true} />
        </TestWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('rounded-br-lg');
    });

    it('does not apply rounded corner for non-corner cells', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} isLastRow={false} isLastCol={false} />
        </TestWrapper>
      );

      const cell = container.firstChild;
      expect(cell).not.toHaveClass('rounded-br-lg');
    });
  });

  describe('droppable behavior', () => {
    it('has minimum height for dropping', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} />
        </TestWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('min-h-[75px]');
    });

    it('has transition for visual feedback', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} />
        </TestWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('transition-colors');
    });
  });

  describe('collapsed state', () => {
    it('renders count badge when collapsed with courses', () => {
      const courses = [
        { id: '1', name: 'Course 1', credits: 6, status: 'planned' },
        { id: '2', name: 'Course 2', credits: 3, status: 'planned' },
      ];

      render(
        <TestWrapper>
          <PlanCell {...defaultProps} courses={courses} isCollapsed={true} />
        </TestWrapper>
      );

      // Should show course count
      expect(screen.getByText('2')).toBeInTheDocument();
      // Should show total credits
      expect(screen.getByText('9')).toBeInTheDocument();
    });

    it('shows + indicator for empty collapsed future cells', () => {
      render(
        <TestWrapper>
          <PlanCell {...defaultProps} isCollapsed={true} semesterStatus="future" />
        </TestWrapper>
      );

      expect(screen.getByText('+')).toBeInTheDocument();
    });

    it('does not show + indicator for empty collapsed completed cells', () => {
      render(
        <TestWrapper>
          <PlanCell {...defaultProps} isCollapsed={true} semesterStatus="completed" />
        </TestWrapper>
      );

      expect(screen.queryByText('+')).not.toBeInTheDocument();
    });

    it('does not render individual course items when collapsed', () => {
      const courses = [
        { id: '1', name: 'Course 1', credits: 6, status: 'planned' },
      ];

      render(
        <TestWrapper>
          <PlanCell {...defaultProps} courses={courses} isCollapsed={true} />
        </TestWrapper>
      );

      // Course name should NOT be visible in collapsed view
      expect(screen.queryByText('Course 1')).not.toBeInTheDocument();
    });
  });
});
