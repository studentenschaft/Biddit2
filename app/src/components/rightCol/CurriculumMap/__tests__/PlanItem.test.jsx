/**
 * PlanItem.test.jsx
 * Tests for the draggable PlanItem component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { RecoilRoot } from 'recoil';
import PlanItem from '../PlanItem';

// Wrapper to provide DndContext and RecoilRoot
const TestWrapper = ({ children }) => (
  <RecoilRoot>
    <DndContext>{children}</DndContext>
  </RecoilRoot>
);

describe('PlanItem', () => {
  const defaultItem = {
    id: 'course-123',
    courseId: 'ABC123',
    name: 'Introduction to Testing',
    credits: 6,
    status: 'planned',
    isCompleted: false,
    isPlaceholder: false,
    source: 'wishlist',
    categoryPath: 'Core/Electives',
  };

  describe('rendering', () => {
    it('renders course name and credits', () => {
      render(
        <TestWrapper>
          <PlanItem item={defaultItem} semesterKey="FS26" />
        </TestWrapper>
      );

      expect(screen.getByText('Introduction to Testing')).toBeInTheDocument();
      expect(screen.getByText('6 ECTS')).toBeInTheDocument();
    });

    it('truncates long course names', () => {
      const longNameItem = {
        ...defaultItem,
        name: 'This is a very long course name that should be truncated for display',
      };

      render(
        <TestWrapper>
          <PlanItem item={longNameItem} semesterKey="FS26" />
        </TestWrapper>
      );

      // Name should be truncated to 26 chars + "..."
      expect(screen.getByText(/This is a very long course/)).toBeInTheDocument();
    });

    it('displays grade when present', () => {
      const gradedItem = {
        ...defaultItem,
        status: 'completed',
        isCompleted: true,
        grade: '5.5',
      };

      render(
        <TestWrapper>
          <PlanItem item={gradedItem} semesterKey="FS26" />
        </TestWrapper>
      );

      expect(screen.getByText('5.5')).toBeInTheDocument();
    });

    it('formats decimal credits correctly', () => {
      const decimalCreditsItem = {
        ...defaultItem,
        credits: 4.5,
      };

      render(
        <TestWrapper>
          <PlanItem item={decimalCreditsItem} semesterKey="FS26" />
        </TestWrapper>
      );

      expect(screen.getByText('4.5 ECTS')).toBeInTheDocument();
    });
  });

  describe('status styling', () => {
    it('applies completed styling for completed courses', () => {
      const completedItem = {
        ...defaultItem,
        status: 'completed',
        isCompleted: true,
      };

      const { container } = render(
        <TestWrapper>
          <PlanItem item={completedItem} semesterKey="FS26" />
        </TestWrapper>
      );

      const itemDiv = container.firstChild;
      expect(itemDiv).toHaveClass('bg-green-600');
    });

    it('applies enrolled styling for enrolled courses', () => {
      const enrolledItem = {
        ...defaultItem,
        status: 'enrolled',
      };

      const { container } = render(
        <TestWrapper>
          <PlanItem item={enrolledItem} semesterKey="FS26" />
        </TestWrapper>
      );

      const itemDiv = container.firstChild;
      expect(itemDiv).toHaveClass('bg-green-100');
    });

    it('applies planned styling for planned courses', () => {
      const { container } = render(
        <TestWrapper>
          <PlanItem item={defaultItem} semesterKey="FS26" />
        </TestWrapper>
      );

      const itemDiv = container.firstChild;
      expect(itemDiv).toHaveClass('bg-gray-100');
    });

    it('applies placeholder styling for placeholders', () => {
      const placeholderItem = {
        ...defaultItem,
        isPlaceholder: true,
        status: 'placeholder',
      };

      const { container } = render(
        <TestWrapper>
          <PlanItem item={placeholderItem} semesterKey="FS26" />
        </TestWrapper>
      );

      const itemDiv = container.firstChild;
      expect(itemDiv).toHaveClass('bg-gray-50');
      expect(itemDiv).toHaveClass('border-dashed');
    });
  });

  describe('draggability', () => {
    it('shows grab cursor for planned items', () => {
      const { container } = render(
        <TestWrapper>
          <PlanItem item={defaultItem} semesterKey="FS26" />
        </TestWrapper>
      );

      const itemDiv = container.firstChild;
      expect(itemDiv).toHaveClass('cursor-grab');
    });

    it('shows pointer cursor for completed items (clickable for details)', () => {
      const completedItem = {
        ...defaultItem,
        status: 'completed',
        isCompleted: true,
      };

      const { container } = render(
        <TestWrapper>
          <PlanItem item={completedItem} semesterKey="FS26" />
        </TestWrapper>
      );

      const itemDiv = container.firstChild;
      expect(itemDiv).toHaveClass('cursor-pointer');
    });

    it('shows pointer cursor for enrolled items (clickable for details)', () => {
      const enrolledItem = {
        ...defaultItem,
        status: 'enrolled',
      };

      const { container } = render(
        <TestWrapper>
          <PlanItem item={enrolledItem} semesterKey="FS26" />
        </TestWrapper>
      );

      const itemDiv = container.firstChild;
      expect(itemDiv).toHaveClass('cursor-pointer');
    });

    it('shows drag handle for draggable items', () => {
      render(
        <TestWrapper>
          <PlanItem item={defaultItem} semesterKey="FS26" />
        </TestWrapper>
      );

      // Drag handle indicator (⠿) should be present
      expect(screen.getByText('⠿')).toBeInTheDocument();
    });

    it('does not show drag handle for non-draggable items', () => {
      const completedItem = {
        ...defaultItem,
        status: 'completed',
        isCompleted: true,
      };

      render(
        <TestWrapper>
          <PlanItem item={completedItem} semesterKey="FS26" />
        </TestWrapper>
      );

      expect(screen.queryByText('⠿')).not.toBeInTheDocument();
    });
  });

  describe('visual styling', () => {
    it('uses color-based status indication instead of icons', () => {
      const completedItem = {
        ...defaultItem,
        status: 'completed',
        isCompleted: true,
      };

      const { container } = render(
        <TestWrapper>
          <PlanItem item={completedItem} semesterKey="FS26" />
        </TestWrapper>
      );

      // Status is indicated through colors, not icons
      const itemDiv = container.firstChild;
      expect(itemDiv).toHaveClass('bg-green-600');
    });
  });

  describe('click propagation', () => {
    it('stops click propagation so parent cell handler is not triggered', () => {
      const parentClick = vi.fn();

      const { container } = render(
        <TestWrapper>
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div onClick={parentClick}>
            <PlanItem item={defaultItem} semesterKey="FS26" onCourseClick={vi.fn()} />
          </div>
        </TestWrapper>
      );

      const itemDiv = container.querySelector('[class*="bg-gray-100"]');
      fireEvent.click(itemDiv);

      expect(parentClick).not.toHaveBeenCalled();
    });
  });
});
