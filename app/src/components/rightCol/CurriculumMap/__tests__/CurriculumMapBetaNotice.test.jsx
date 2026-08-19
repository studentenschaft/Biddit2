/**
 * CurriculumMapBetaNotice.test.jsx
 * Tests for the one-time Beta welcome callout and its localStorage dismissal.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CurriculumMapBetaNotice from "../CurriculumMapBetaNotice";

const STORAGE_KEY = "curriculumMapBetaNoticeDismissed";

describe("CurriculumMapBetaNotice", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the welcome callout when not previously dismissed", () => {
    render(<CurriculumMapBetaNotice />);
    expect(
      screen.getByText(/Welcome to the new Curriculum Map \(Beta\)/i)
    ).toBeInTheDocument();
  });

  it("links feedback to the Biddit contact address", () => {
    render(<CurriculumMapBetaNotice />);
    const link = screen.getByRole("link", { name: /tell us what you think/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("mailto:biddit@shsg.ch"));
  });

  it("hides and persists dismissal when the close button is clicked", () => {
    render(<CurriculumMapBetaNotice />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss beta notice/i }));

    expect(
      screen.queryByText(/Welcome to the new Curriculum Map \(Beta\)/i)
    ).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("stays hidden when already dismissed in localStorage", () => {
    localStorage.setItem(STORAGE_KEY, "true");
    render(<CurriculumMapBetaNotice />);
    expect(
      screen.queryByText(/Welcome to the new Curriculum Map \(Beta\)/i)
    ).not.toBeInTheDocument();
  });
});
