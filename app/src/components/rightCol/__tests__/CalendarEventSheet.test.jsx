/**
 * The sheet is a Headless UI Dialog, so it portals to document.body: nothing
 * lands in the render container and the queries go through `screen` (which
 * searches the whole document) rather than the returned container.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CalendarEventSheet from "../CalendarEventSheet";

/**
 * Headless UI settles an opening Dialog's transition a tick after it mounts;
 * letting that tick run inside act() keeps the update from landing unwrapped.
 */
const renderSheet = async (event, onClose = () => {}) => {
  render(<CalendarEventSheet event={event} onClose={onClose} />);
  await act(async () => {});
};

const baseEvent = {
  title: "Corporate Finance",
  // 24-hour, as the calendar formats it for the tooltip and the sheet alike.
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

  it("shows the full title, time range and room", async () => {
    await renderSheet(baseEvent);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Corporate Finance")).toBeInTheDocument();
    expect(screen.getByText(/08:15/)).toBeInTheDocument();
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
    expect(screen.getByText(/01-013/)).toBeInTheDocument();
  });

  it("names the dialog after the event it describes", async () => {
    await renderSheet(baseEvent);
    // Dialog.Title wires aria-labelledby, so the accessible name is the course.
    expect(
      screen.getByRole("dialog", { name: "Corporate Finance" }),
    ).toBeInTheDocument();
  });

  it("does not render a conflict warning when there are no conflicts", async () => {
    await renderSheet(baseEvent);
    expect(screen.queryByText(/conflicts with/i)).not.toBeInTheDocument();
  });

  it("lists every conflicting course when conflicts exist", async () => {
    await renderSheet({
      ...baseEvent,
      conflictsWith: ["Macroeconomics", "Business Law"],
    });

    expect(screen.getByText(/conflicts with/i)).toBeInTheDocument();
    expect(screen.getByText("Macroeconomics")).toBeInTheDocument();
    expect(screen.getByText("Business Law")).toBeInTheDocument();
  });

  it("falls back to N/A for a missing room", async () => {
    await renderSheet({ ...baseEvent, room: undefined });
    expect(screen.getByText(/N\/A/)).toBeInTheDocument();
  });

  it("calls onClose when the close button is pressed", async () => {
    const onClose = vi.fn();
    await renderSheet(baseEvent, onClose);

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is tapped", async () => {
    const onClose = vi.fn();
    await renderSheet(baseEvent, onClose);

    // Headless UI closes on any click outside the panel, so the backdrop needs
    // no handler of its own — this pins that the wiring is actually in place.
    fireEvent.mouseDown(screen.getByTestId("calendar-event-sheet-backdrop"));
    fireEvent.click(screen.getByTestId("calendar-event-sheet-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    await renderSheet(baseEvent, onClose);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  /**
   * The stacking rung the sheet occupies: above the app's in-page z-50 layer
   * (StudyondBanner, the mobile info button), below the z-[60] side-nav
   * dialogs. It portals to the body, so these numbers compete in the root
   * stacking context — see the note in the component.
   */
  it("declares a layer between the in-page overlays and the side-nav dialogs", async () => {
    await renderSheet(baseEvent);

    expect(screen.getByTestId("calendar-event-sheet").className).toContain(
      "z-[55]",
    );
    expect(
      screen.getByTestId("calendar-event-sheet-panel").className,
    ).toContain("z-[56]");
  });

  /**
   * Exams have no room in the plan and are our own PDF extraction, so the sheet
   * swaps the room line for the exam facts, puts the date first and always
   * says the dates are indicative (ADR 0012). The facts arrive prebuilt from
   * examCalendarEventsSelector, which also owns the BYOD wording.
   */
  describe("exam blocks", () => {
    const examEvent = {
      title: "Advanced Cybersecurity",
      startTime: "15:15",
      endTime: "17:15",
      entryType: "exam",
      examDate: "Tue 19.01.2027",
      examMeta: "Exam · 120 min · digital (BYOD)",
      conflictsWith: [],
    };

    it("leads with the exam's date and shows its facts instead of a room", async () => {
      await renderSheet(examEvent);

      expect(
        screen.getByText("Tue 19.01.2027, 15:15 - 17:15"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Exam · 120 min · digital (BYOD)"),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Room:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/N\/A/)).not.toBeInTheDocument();
    });

    it("carries the indicative-only disclaimer", async () => {
      await renderSheet(examEvent);

      expect(
        screen.getByText("Indicative — verify officially."),
      ).toBeInTheDocument();
    });

    it("does not disclaim a lecture", async () => {
      await renderSheet(baseEvent);

      expect(screen.queryByText(/Indicative/)).not.toBeInTheDocument();
    });

    // An exam clash is not a lecture overlap and says so, in the words every
    // exam surface uses.
    it("heads the clashing courses as an exam clash", async () => {
      await renderSheet({
        ...examEvent,
        conflictsWith: ["Data Analytics, Causal Inference"],
      });

      expect(screen.getByText("⚠ Exam clash with:")).toBeInTheDocument();
      expect(screen.queryByText(/conflicts with/i)).not.toBeInTheDocument();
      expect(
        screen.getByText("Data Analytics, Causal Inference"),
      ).toBeInTheDocument();
    });
  });

  it("keeps the bottom-sheet shape", async () => {
    await renderSheet(baseEvent);

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
