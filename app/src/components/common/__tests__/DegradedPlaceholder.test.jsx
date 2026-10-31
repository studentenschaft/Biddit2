/**
 * Tests for DegradedPlaceholder rendering (default + compact variants).
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import DegradedPlaceholder from "../DegradedPlaceholder";

afterEach(cleanup);

describe("DegradedPlaceholder", () => {
  it("renders the default 'Temporarily unavailable' title when no feature is given", () => {
    render(<DegradedPlaceholder />);

    expect(screen.getByText("Temporarily unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(/paused during the semester-start usage spike/i),
    ).toBeInTheDocument();
  });

  it("shows the feature name in the title when provided", () => {
    render(<DegradedPlaceholder feature="Course ratings" />);

    expect(
      screen.getByText("Course ratings is taking a short break"),
    ).toBeInTheDocument();
  });

  it("renders a compact single-line variant without card chrome", () => {
    const { container } = render(
      <DegradedPlaceholder feature="Similar courses" compact />,
    );

    expect(
      screen.getByText(/Similar courses is taking a short break/i),
    ).toBeInTheDocument();
    // Compact variant should not render the card wrapper.
    expect(container.querySelector(".rounded-lg")).not.toBeInTheDocument();
  });

  it("applies a custom className", () => {
    const { container } = render(
      <DegradedPlaceholder className="my-extra-class" />,
    );

    expect(container.querySelector(".my-extra-class")).toBeInTheDocument();
  });
});
