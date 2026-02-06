/**
 * PlanCell.test.jsx
 * Tests for the droppable PlanCell component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { RecoilRoot } from 'recoil';
import PropTypes from 'prop-types';
import PlanCell from '../PlanCell';

// Wrapper to provide DndContext and RecoilRoot (needed for PlanItem inside PlanCell)
const TestWrapper = ({ children }) => (
  <RecoilRoot>
    <DndContext>{children}</DndContext>
  </RecoilRoot>
);

TestWrapper.propTypes = {
  children: PropTypes.node.isRequired,
};

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
    it('renders empty future cells without a "+" button (cell click opens form instead)', () => {
      render(
        <TestWrapper>
          <PlanCell {...defaultProps} />
        </TestWrapper>
      );

      // Empty cells don't need the "+" button — clicking the cell area opens the form
      expect(screen.queryByText('+')).not.toBeInTheDocument();
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
      expect(cell).toHaveClass('bg-green-50');
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

    it('does not show + indicator for empty collapsed future cells', () => {
      render(
        <TestWrapper>
          <PlanCell {...defaultProps} isCollapsed={true} semesterStatus="future" />
        </TestWrapper>
      );

      expect(screen.queryByText('+')).not.toBeInTheDocument();
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

  describe('click-to-add placeholder', () => {
    it('opens placeholder form when clicking empty area of a future cell', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} semesterStatus="future" />
        </TestWrapper>
      );

      fireEvent.click(container.firstChild);
      expect(screen.getByText('Credits (ECTS)')).toBeInTheDocument();
    });

    it('opens placeholder form when clicking empty area of a current cell', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} semesterStatus="current" />
        </TestWrapper>
      );

      fireEvent.click(container.firstChild);
      expect(screen.getByText('Credits (ECTS)')).toBeInTheDocument();
    });

    it('does NOT open placeholder form for completed cells', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} semesterStatus="completed" />
        </TestWrapper>
      );

      fireEvent.click(container.firstChild);
      expect(screen.queryByText('Credits (ECTS)')).not.toBeInTheDocument();
    });

    it('does NOT open placeholder form for collapsed cells', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} isCollapsed={true} />
        </TestWrapper>
      );

      fireEvent.click(container.firstChild);
      expect(screen.queryByText('Credits (ECTS)')).not.toBeInTheDocument();
    });

    it('applies cursor-pointer on clickable cells', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} semesterStatus="future" />
        </TestWrapper>
      );

      expect(container.firstChild).toHaveClass('cursor-pointer');
    });

    it('does not apply cursor-pointer on completed cells', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} semesterStatus="completed" />
        </TestWrapper>
      );

      expect(container.firstChild).not.toHaveClass('cursor-pointer');
    });
  });

  describe('placement mode', () => {
    const placementMode = { label: 'Elective', credits: 6 };

    it('applies placement highlight on future cells when placement mode is active', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} placementMode={placementMode} />
        </TestWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('ring-blue-400');
      expect(cell).toHaveClass('cursor-pointer');
    });

    it('does not apply placement highlight on completed cells', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell {...defaultProps} semesterStatus="completed" placementMode={placementMode} />
        </TestWrapper>
      );

      const cell = container.firstChild;
      expect(cell).not.toHaveClass('ring-blue-400');
      expect(cell).not.toHaveClass('cursor-pointer');
    });

    it('calls onCellPlacement when clicked in placement mode', () => {
      const onCellPlacement = vi.fn();
      const { container } = render(
        <TestWrapper>
          <PlanCell
            {...defaultProps}
            placementMode={placementMode}
            onCellPlacement={onCellPlacement}
          />
        </TestWrapper>
      );

      fireEvent.click(container.firstChild);
      expect(onCellPlacement).toHaveBeenCalledWith('FS26', 'Core/Electives');
    });

    it('does not call onCellPlacement on completed cells', () => {
      const onCellPlacement = vi.fn();
      const { container } = render(
        <TestWrapper>
          <PlanCell
            {...defaultProps}
            semesterStatus="completed"
            placementMode={placementMode}
            onCellPlacement={onCellPlacement}
          />
        </TestWrapper>
      );

      fireEvent.click(container.firstChild);
      expect(onCellPlacement).not.toHaveBeenCalled();
    });

    it('does not call onCellPlacement when placement mode is null', () => {
      const onCellPlacement = vi.fn();
      const { container } = render(
        <TestWrapper>
          <PlanCell
            {...defaultProps}
            placementMode={null}
            onCellPlacement={onCellPlacement}
          />
        </TestWrapper>
      );

      fireEvent.click(container.firstChild);
      expect(onCellPlacement).not.toHaveBeenCalled();
    });

    it('applies placement highlight on collapsed cells in placement mode', () => {
      const { container } = render(
        <TestWrapper>
          <PlanCell
            {...defaultProps}
            isCollapsed={true}
            placementMode={placementMode}
          />
        </TestWrapper>
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass('ring-blue-400');
      expect(cell).toHaveClass('cursor-pointer');
    });
  });
});
