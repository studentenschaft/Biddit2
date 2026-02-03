/**
 * PlanCell.test.jsx
 * Tests for the droppable PlanCell component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import PlanCell from '../PlanCell';

// Wrapper to provide DndContext
const DndWrapper = ({ children }) => (
  <DndContext>{children}</DndContext>
);

describe('PlanCell', () => {
  const defaultProps = {
    semesterKey: 'FS26',
    categoryPath: 'Core/Electives',
    courses: [],
    semesterStatus: 'future',
    validations: null,
    isLastRow: false,
    isLastCol: false,
  };

  describe('rendering', () => {
    it('renders empty state for future semesters', () => {
      render(
        <DndWrapper>
          <PlanCell {...defaultProps} />
        </DndWrapper>
      );

      // Empty future cells show a "+" indicator
      expect(screen.getByText('+')).toBeInTheDocument();
    });

    it('does not show empty indicator for completed semesters', () => {
      render(
        <DndWrapper>
          <PlanCell {...defaultProps} semesterStatus="completed" />
        </DndWrapper>
      );

      expect(screen.queryByText('+')).not.toBeInTheDocument();
    });

    it('renders course items', () => {
      const courses = [
        { id: '1', name: 'Course 1', credits: 6, status: 'planned' },
        { id: '2', name: 'Course 2', credits: 3, status: 'planned' },
      ];

      render(
        <DndWrapper>
          <PlanCell {...defaultProps} courses={courses} />
        </DndWrapper>
      );

      expect(screen.getByText('Course 1')).toBeInTheDocument();
      expect(screen.getByText('Course 2')).toBeInTheDocument();
    });

    it('sets data attributes for cell identification', () => {
      const { container } = render(
        <DndWrapper>
          <PlanCell {...defaultProps} />
        </DndWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveAttribute('data-semester', 'FS26');
      expect(cell).toHaveAttribute('data-category', 'Core/Electives');
    });
  });

  describe('semester status styling', () => {
    it('applies completed background for completed semesters', () => {
      const { container } = render(
        <DndWrapper>
          <PlanCell {...defaultProps} semesterStatus="completed" />
        </DndWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('bg-hsg-50/50');
    });

    it('applies current background for current semester', () => {
      const { container } = render(
        <DndWrapper>
          <PlanCell {...defaultProps} semesterStatus="current" />
        </DndWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('bg-amber-50/50');
    });

    it('applies white background for future semesters', () => {
      const { container } = render(
        <DndWrapper>
          <PlanCell {...defaultProps} semesterStatus="future" />
        </DndWrapper>
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
        <DndWrapper>
          <PlanCell {...defaultProps} validations={validations} />
        </DndWrapper>
      );

      expect(screen.getByText('Conflict')).toBeInTheDocument();
    });

    it('shows warning badge when warnings exist', () => {
      const validations = {
        conflicts: [],
        warnings: [{ warning: 'Credit limit exceeded' }],
      };

      render(
        <DndWrapper>
          <PlanCell {...defaultProps} validations={validations} />
        </DndWrapper>
      );

      expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('applies red border for conflicts', () => {
      const validations = {
        conflicts: [{ details: 'Time conflict' }],
        warnings: [],
      };

      const { container } = render(
        <DndWrapper>
          <PlanCell {...defaultProps} validations={validations} />
        </DndWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('border-red-400');
      expect(cell).toHaveClass('border-2');
    });

    it('applies amber border for warnings', () => {
      const validations = {
        conflicts: [],
        warnings: [{ warning: 'Credit limit exceeded' }],
      };

      const { container } = render(
        <DndWrapper>
          <PlanCell {...defaultProps} validations={validations} />
        </DndWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('border-amber-400');
      expect(cell).toHaveClass('border-2');
    });

    it('does not show badges when no validations', () => {
      render(
        <DndWrapper>
          <PlanCell {...defaultProps} validations={null} />
        </DndWrapper>
      );

      expect(screen.queryByText('Conflict')).not.toBeInTheDocument();
      expect(screen.queryByText('Warning')).not.toBeInTheDocument();
    });
  });

  describe('corner styling', () => {
    it('applies rounded corner for last row and column', () => {
      const { container } = render(
        <DndWrapper>
          <PlanCell {...defaultProps} isLastRow={true} isLastCol={true} />
        </DndWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('rounded-br-lg');
    });

    it('does not apply rounded corner for non-corner cells', () => {
      const { container } = render(
        <DndWrapper>
          <PlanCell {...defaultProps} isLastRow={false} isLastCol={false} />
        </DndWrapper>
      );

      const cell = container.firstChild;
      expect(cell).not.toHaveClass('rounded-br-lg');
    });
  });

  describe('droppable behavior', () => {
    it('has minimum height for dropping', () => {
      const { container } = render(
        <DndWrapper>
          <PlanCell {...defaultProps} />
        </DndWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('min-h-[75px]');
    });

    it('has transition for visual feedback', () => {
      const { container } = render(
        <DndWrapper>
          <PlanCell {...defaultProps} />
        </DndWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('transition-colors');
    });
  });
});
