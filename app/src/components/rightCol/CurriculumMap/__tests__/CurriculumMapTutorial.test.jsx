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
    it("displays all five tutorial items", () => {
      render(<CurriculumMapTutorial {...defaultProps} />);

      expect(screen.getByText("Read the map")).toBeInTheDocument();
      expect(screen.getByText("Add your courses")).toBeInTheDocument();
      expect(
        screen.getByText("Plan ahead with placeholders")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Rearrange & make it yours")
      ).toBeInTheDocument();
      expect(screen.getByText("Color legend")).toBeInTheDocument();
    });

    it("opens with a plain-language overview of what the page is for", () => {
      render(<CurriculumMapTutorial {...defaultProps} />);

      expect(
        screen.getByText(/bird's-eye view of your whole degree/)
      ).toBeInTheDocument();
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
        screen.getByText("Here's how it works:")
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
