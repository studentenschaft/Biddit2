/**
 * PlaceholderCreator.test.jsx
 * Tests for the PlaceholderCreator input row component
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import PropTypes from 'prop-types';
import PlaceholderCreator from '../PlaceholderCreator';

const TestWrapper = ({ children }) => (
  <DndContext>{children}</DndContext>
);

TestWrapper.propTypes = {
  children: PropTypes.node.isRequired,
};

describe('PlaceholderCreator', () => {
  describe('default state', () => {
    it('renders descriptive label and inputs', () => {
      render(
        <TestWrapper>
          <PlaceholderCreator />
        </TestWrapper>
      );

      expect(screen.getByText('Add a Placeholder Course:')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Label (e.g. Elective)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('3')).toBeInTheDocument();
      expect(screen.getByText('ECTS')).toBeInTheDocument();
    });

    it('renders draggable chip with default label "TBD"', () => {
      render(
        <TestWrapper>
          <PlaceholderCreator />
        </TestWrapper>
      );

      expect(screen.getByText('TBD')).toBeInTheDocument();
    });

    it('defaults credits to 3', () => {
      render(
        <TestWrapper>
          <PlaceholderCreator />
        </TestWrapper>
      );

      const creditsInput = screen.getByDisplayValue('3');
      expect(creditsInput).toBeInTheDocument();
    });
  });

  describe('draggable chip', () => {
    it('shows chip with entered label', () => {
      render(
        <TestWrapper>
          <PlaceholderCreator />
        </TestWrapper>
      );

      fireEvent.change(screen.getByPlaceholderText('Label (e.g. Elective)'), {
        target: { value: 'My Course' },
      });

      expect(screen.getByText('My Course')).toBeInTheDocument();
    });

    it('shows "Drag into grid →" hint before the chip', () => {
      render(
        <TestWrapper>
          <PlaceholderCreator />
        </TestWrapper>
      );

      expect(screen.getByText('Drag into grid →')).toBeInTheDocument();
      const chip = screen.getByTitle('Drag onto a cell to place');
      expect(chip).toBeInTheDocument();
    });

    it('does not render chip when credits are invalid', () => {
      render(
        <TestWrapper>
          <PlaceholderCreator />
        </TestWrapper>
      );

      fireEvent.change(screen.getByDisplayValue('3'), {
        target: { value: '0' },
      });

      expect(screen.queryByText('Drag into grid →')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Drag onto a cell to place')).not.toBeInTheDocument();
    });

    it('does not render chip when credits exceed maximum', () => {
      render(
        <TestWrapper>
          <PlaceholderCreator />
        </TestWrapper>
      );

      fireEvent.change(screen.getByDisplayValue('3'), {
        target: { value: '31' },
      });

      expect(screen.queryByText('Drag into grid →')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Drag onto a cell to place')).not.toBeInTheDocument();
    });
  });
});
