/**
 * Mobile layout guard for the side-nav dialogs (ratings and about).
 *
 * On a 390px phone the ratings panel was `w-1/2` — 195px — and everything
 * inside it was laid out in two rigid columns, so the rating criteria and the
 * course-picker buttons overflowed past the panel edge. Its only close control
 * was `hidden sm:block`, leaving no visible way out below 640px. The about
 * panel had the opposite problem: no width class at all below sm (so it
 * shrink-wrapped) and `overflow-hidden`, which clipped its long text on a short
 * viewport rather than scrolling it.
 *
 * jsdom computes no layout and resolves no Tailwind breakpoints, so what is
 * pinned here are the class-level invariants: a panel is width-constrained
 * rather than viewport-fraction sized, it scrolls instead of clipping, the
 * multi-column content stacks below sm, and the close button is unconditional
 * and sticky rather than absolutely positioned inside the scroll container.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecoilRoot } from "recoil";
import { reviewMenuModalState } from "../../../recoil/reviewMenuModal";
import { coursesTakenForRatingState } from "../../../recoil/coursesTakenForRatings";
import { ReviewButton } from "../ReviewButton";
import AboutButton from "../AboutButton";

const COURSE = {
  courseId: "1234",
  courseName: "A Rather Long Course Title That Needs The Full Panel Width",
  semesterName: "HS25",
};

const renderRatings = () =>
  render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(reviewMenuModalState, true);
        set(coursesTakenForRatingState, [COURSE]);
      }}
    >
      <ReviewButton />
    </RecoilRoot>,
  );

const renderAbout = () => {
  const result = render(<AboutButton />);
  fireEvent.click(screen.getByRole("button", { name: "About" }));
  return result;
};

/** The Dialog.Panel — the only rounded, shadowed box inside the dialog. */
const panel = () =>
  document.querySelector('[id^="headlessui-dialog-panel-"]') ??
  document.querySelector(".rounded-lg.shadow-xl");

describe.each([
  ["ratings", renderRatings],
  ["about", renderAbout],
])("%s dialog panel sizing", (_name, renderOpen) => {
  it("fills the available width up to a cap instead of a viewport fraction", () => {
    renderOpen();
    const className = panel().className;
    expect(className).toContain("w-full");
    expect(className).toMatch(/\bmax-w-(?:lg|xl|2xl)\b/);
    // w-1/2 is what made the phone panel 195px wide.
    expect(className).not.toMatch(/\bw-1\/2\b/);
    // A width that only applies from sm up leaves the phone shrink-wrapping.
    expect(className).not.toMatch(/\bsm:w-full\b/);
  });

  it("scrolls its own overflow rather than clipping it", () => {
    renderOpen();
    const className = panel().className;
    expect(className).toMatch(/\bmax-h-\[\d+vh\]/);
    expect(className).toContain("overflow-y-auto");
    expect(className).not.toContain("overflow-hidden");
  });
});

describe("ratings dialog on a narrow viewport", () => {
  it("keeps the close button visible below sm", () => {
    renderRatings();
    const close = screen.getByRole("button", { name: "Close" });
    // `hidden sm:block` on the wrapper is what removed the only exit on a phone.
    expect(close.parentElement.className).not.toMatch(/\bhidden\b/);
    expect(close.parentElement.className).not.toMatch(/\bsm:block\b/);
  });

  it("pins the close button to the top of the scrolling panel", () => {
    renderRatings();
    const wrapper = screen.getByRole("button", { name: "Close" }).parentElement;
    // The panel is the scroll container (max-h-[85vh] overflow-y-auto), so an
    // absolutely positioned corner wrapper scrolls away with the ratings form
    // — the X was gone by the time a phone user reached the submit button.
    expect(wrapper.className.split(/\s+/)).toContain("sticky");
    expect(wrapper.className.split(/\s+/)).toContain("top-0");
    expect(wrapper.className.split(/\s+/)).not.toContain("absolute");
    // Opaque, or the content scrolling underneath it shows through.
    expect(wrapper.className).toContain("bg-white");
  });

  it("stacks the course picker into one column below sm", () => {
    renderRatings();
    const picker = screen
      .getByRole("button", { name: COURSE.courseName })
      .closest(".grid");
    expect(picker.className).toContain("grid-cols-1");
    expect(picker.className).toContain("sm:grid-cols-2");
  });

  it("stacks the rating criteria into one column below sm", () => {
    renderRatings();
    fireEvent.click(screen.getByRole("button", { name: COURSE.courseName }));
    const criteria = screen.getByText("Topic*").closest(".grid");
    expect(criteria.className).toContain("grid-cols-1");
    expect(criteria.className).toContain("sm:grid-cols-2");
  });

  it("lets each criterion's stars wrap below its label when they do not fit", () => {
    renderRatings();
    fireEvent.click(screen.getByRole("button", { name: COURSE.courseName }));
    // A rigid grid-cols-2 gave the five stars a fixed half-cell to overflow;
    // a wrapping flex row lets them drop onto their own line instead.
    const criterion = screen.getByText("Topic*").parentElement;
    expect(criterion.className).toContain("flex-wrap");
    expect(criterion.className).not.toMatch(/\bgrid-cols-2\b/);
  });
});
