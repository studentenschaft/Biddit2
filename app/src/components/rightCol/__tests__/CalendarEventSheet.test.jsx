/**
 * The sheet is a Headless UI Dialog, so it portals to document.body: nothing
 * lands in the render container and the queries go through `screen` (which
 * searches the whole document) rather than the returned container.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CalendarEventSheet from "../CalendarEventSheet";

const baseEvent = {
  title: "Corporate Finance",
  // 24-hour, matching the hover tooltip's toLocaleTimeString output — the two
  // surfaces describe the same event and must agree on the clock.
  startTime: "08:15",
  endTime: "10:00",
  room: "01-013",
  conflictsWith: [],
};

describe("CalendarEventSheet", () => {
  it("renders nothing when there is no event", () => {
    render(<CalendarEventSheet event={null} onClose={() => {}} />);
    // Asserted against the document, not the container: an open dialog would
    // portal out of the container and leave it empty either way.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("calendar-event-sheet-panel")).toBeNull();
  });

  it("shows the full title, time range and room", () => {
    render(<CalendarEventSheet event={baseEvent} onClose={() => {}} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Corporate Finance")).toBeInTheDocument();
    expect(screen.getByText(/08:15/)).toBeInTheDocument();
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
    expect(screen.getByText(/01-013/)).toBeInTheDocument();
  });

  it("names the dialog after the event it describes", () => {
    render(<CalendarEventSheet event={baseEvent} onClose={() => {}} />);
    // Dialog.Title wires aria-labelledby, so the accessible name is the course.
    expect(
      screen.getByRole("dialog", { name: "Corporate Finance" }),
    ).toBeInTheDocument();
  });

  it("does not render a conflict warning when there are no conflicts", () => {
    render(<CalendarEventSheet event={baseEvent} onClose={() => {}} />);
    expect(screen.queryByText(/conflicts with/i)).not.toBeInTheDocument();
  });

  it("lists every conflicting course when conflicts exist", () => {
    render(
      <CalendarEventSheet
        event={{
          ...baseEvent,
          conflictsWith: ["Macroeconomics", "Business Law"],
        }}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText(/conflicts with/i)).toBeInTheDocument();
    expect(screen.getByText("Macroeconomics")).toBeInTheDocument();
    expect(screen.getByText("Business Law")).toBeInTheDocument();
  });

  it("falls back to N/A for a missing room", () => {
    render(
      <CalendarEventSheet
        event={{ ...baseEvent, room: undefined }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/N\/A/)).toBeInTheDocument();
  });

  it("calls onClose when the close button is pressed", () => {
    const onClose = vi.fn();
    render(<CalendarEventSheet event={baseEvent} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is tapped", () => {
    const onClose = vi.fn();
    render(<CalendarEventSheet event={baseEvent} onClose={onClose} />);

    // Headless UI closes on any click outside the panel, so the backdrop needs
    // no handler of its own — this pins that the wiring is actually in place.
    fireEvent.mouseDown(screen.getByTestId("calendar-event-sheet-backdrop"));
    fireEvent.click(screen.getByTestId("calendar-event-sheet-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<CalendarEventSheet event={baseEvent} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  /**
   * The stacking rung the sheet occupies: above the app's in-page z-50 layer
   * (StudyondBanner, the mobile info button), below the z-[60] side-nav
   * dialogs. It portals to the body, so these numbers compete in the root
   * stacking context — see the note in the component.
   */
  it("declares a layer between the in-page overlays and the side-nav dialogs", () => {
    render(<CalendarEventSheet event={baseEvent} onClose={() => {}} />);

    expect(screen.getByTestId("calendar-event-sheet").className).toContain(
      "z-[55]",
    );
    expect(
      screen.getByTestId("calendar-event-sheet-panel").className,
    ).toContain("z-[56]");
  });

  /**
   * Exams have no room in the plan and are our own PDF extraction, so the sheet
   * swaps the room line for the exam facts and always says so (ADR 0009/0010).
   */
  describe("exam blocks", () => {
    const examEvent = {
      title: "Advanced Cybersecurity",
      startTime: "15:15",
      endTime: "17:15",
      entryType: "exam",
      durationMin: 120,
      byod: true,
      conflictsWith: [],
    };

    it("shows the duration and the BYOD badge instead of a room", () => {
      render(<CalendarEventSheet event={examEvent} onClose={() => {}} />);

      expect(
        screen.getByText("Exam · 120 min · digital (BYOD)"),
      ).toBeInTheDocument();
      expect(screen.queryByText(/^Room:/)).not.toBeInTheDocument();
    });

    it("stays silent about BYOD when the plan does not mark it", () => {
      render(
        <CalendarEventSheet
          event={{ ...examEvent, byod: false }}
          onClose={() => {}}
        />,
      );

      expect(screen.getByText("Exam · 120 min")).toBeInTheDocument();
    });

    it("carries the indicative-only disclaimer", () => {
      render(<CalendarEventSheet event={examEvent} onClose={() => {}} />);

      expect(
        screen.getByText("Indicative — verify officially."),
      ).toBeInTheDocument();
    });

    it("does not disclaim a lecture", () => {
      render(<CalendarEventSheet event={baseEvent} onClose={() => {}} />);

      expect(screen.queryByText(/Indicative/)).not.toBeInTheDocument();
    });

    it("names the clashing courses", () => {
      render(
        <CalendarEventSheet
          event={{ ...examEvent, conflictsWith: ["Causal Inference"] }}
          onClose={() => {}}
        />,
      );

      expect(screen.getByText(/conflicts with/i)).toBeInTheDocument();
      expect(screen.getByText("Causal Inference")).toBeInTheDocument();
    });
  });

  it("keeps the bottom-sheet shape", () => {
    render(<CalendarEventSheet event={baseEvent} onClose={() => {}} />);

    const className = screen.getByTestId(
      "calendar-event-sheet-panel",
    ).className;
    expect(className).toContain("fixed");
    expect(className).toContain("inset-x-0");
    expect(className).toContain("bottom-0");
    expect(className).toContain("rounded-t-xl");
    expect(className).toContain("overflow-y-auto");
  });
});
