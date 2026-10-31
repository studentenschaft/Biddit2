/**
 * The current semester is marked the way today's column is in the Calendar,
 * so students see at once which semester they are in.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SemesterRow from "../SemesterRow";

const semester = (status) => ({
  key: "HS26",
  status,
  totalCredits: 30,
  plannedCredits: 0,
});

describe.each(["row", "column"])("SemesterRow (%s orientation)", (orientation) => {
  it("puts the current semester's key in a pill and says it is current", () => {
    const { container } = render(
      <SemesterRow semester={semester("current")} orientation={orientation} />
    );

    expect(screen.getByText("HS26")).toHaveClass("rounded-full", "bg-hsg-700");
    expect(screen.getByText("(current semester)")).toHaveClass("sr-only");
    expect(container.firstChild).toHaveClass("bg-hsg-50", "ring-hsg-200");
  });

  it.each(["completed", "future"])("leaves a %s semester unmarked", (status) => {
    const { container } = render(
      <SemesterRow semester={semester(status)} orientation={orientation} />
    );

    expect(screen.getByText("HS26")).not.toHaveClass("rounded-full");
    expect(screen.queryByText("(current semester)")).toBeNull();
    expect(container.firstChild).not.toHaveClass("ring-hsg-200");
  });
});
