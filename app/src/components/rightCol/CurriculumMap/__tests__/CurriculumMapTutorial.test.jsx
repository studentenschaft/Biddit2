/**
 * CurriculumMapTutorial.test.jsx
 * Tests for the first-time tutorial overlay on the Curriculum Map.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CurriculumMapTutorial from "../CurriculumMapTutorial";

describe("CurriculumMapTutorial", () => {
  const defaultProps = {
    isOpen: true,
    onDismiss: vi.fn(),
  };

  describe("visibility", () => {
    it("renders the modal when isOpen is true", () => {
      render(<CurriculumMapTutorial {...defaultProps} />);

      expect(
        screen.getByText("Welcome to the Curriculum Map")
      ).toBeInTheDocument();
    });

    it("does not render the modal when isOpen is false", () => {
      render(<CurriculumMapTutorial isOpen={false} onDismiss={vi.fn()} />);

      expect(
        screen.queryByText("Welcome to the Curriculum Map")
      ).not.toBeInTheDocument();
    });
  });

  describe("tutorial content", () => {
    it("displays all four tutorial items", () => {
      render(<CurriculumMapTutorial {...defaultProps} />);

      expect(
        screen.getByText("Drag courses from the list")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Click a cell to add a placeholder")
      ).toBeInTheDocument();
      expect(screen.getByText("Drag to rearrange")).toBeInTheDocument();
      expect(screen.getByText("Color legend")).toBeInTheDocument();
    });

    it("displays the color legend with all statuses", () => {
      render(<CurriculumMapTutorial {...defaultProps} />);

      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(screen.getByText("Enrolled")).toBeInTheDocument();
      expect(screen.getByText("Planned")).toBeInTheDocument();
    });

    it("has an accessible Dialog structure with title and description", () => {
      render(<CurriculumMapTutorial {...defaultProps} />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();

      expect(
        screen.getByText("Welcome to the Curriculum Map")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Here's how to plan your studies:")
      ).toBeInTheDocument();
    });
  });

  describe("dismissal", () => {
    it('calls onDismiss when "Got it" is clicked', () => {
      const onDismiss = vi.fn();
      render(<CurriculumMapTutorial isOpen={true} onDismiss={onDismiss} />);

      fireEvent.click(screen.getByText("Got it"));

      expect(onDismiss).toHaveBeenCalledOnce();
    });
  });
});
