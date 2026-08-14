/**
 * Stacking guard for the side-nav dialogs (ratings, about, analytics and privacy).
 *
 * They all portal to document.body, so the z-index on their root competes with the
 * page's own layers in the *root* stacking context — nothing between #root and
 * the Curriculum Map grid establishes one. At z-10 they lost to the grid's
 * sticky header cells (z-20) and its popovers/dropdowns (z-50), which painted
 * over the open dialog. The blur-only backdrop compounded it: the grid stayed
 * fully legible behind the dialog even where the stacking was correct.
 *
 * jsdom computes no layout, so what is pinned here is the invariant that broke:
 * the dialog's layer must outrank every layer the Curriculum Map declares, and
 * its backdrop must dim rather than only blur.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecoilRoot } from "recoil";
import { reviewMenuModalState } from "../../../recoil/reviewMenuModal";
import { coursesTakenForRatingState } from "../../../recoil/coursesTakenForRatings";
import { ReviewButton } from "../ReviewButton";
import AboutButton from "../AboutButton";
import AnalyticsButton from "../AnalyticsButton";
import PrivacyButton from "../PrivacyButton";

const DIALOG_Z_INDEX = 60;

/** Every Curriculum Map component, as source, to read its z-index ceiling. */
const CURRICULUM_MAP_SOURCES = import.meta.glob(
  "../../../rightCol/CurriculumMap/*.jsx",
  { query: "?raw", import: "default", eager: true },
);

const renderRatings = () =>
  render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(reviewMenuModalState, true);
        set(coursesTakenForRatingState, [
          { courseId: "1234", courseName: "Test Course", semesterName: "HS25" },
        ]);
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

const renderAnalytics = () => {
  const result = render(<AnalyticsButton />);
  fireEvent.click(screen.getByRole("button", { name: "Analytics settings" }));
  return result;
};

const renderPrivacy = () => {
  const result = render(<PrivacyButton />);
  fireEvent.click(screen.getByRole("button", { name: "Privacy" }));
  return result;
};

const dialogRoot = () => document.querySelector('[id^="headlessui-dialog-"]');

/** The highest layer the Curriculum Map draws on, read from its own source. */
const curriculumMapCeiling = () => {
  const declared = Object.values(CURRICULUM_MAP_SOURCES).flatMap((source) =>
    [
      ...source.matchAll(/\bz-(?:\[)?(\d+)\]?\b/g),
      ...source.matchAll(/zIndex:\s*(\d+)/g),
    ].map((match) => Number(match[1])),
  );
  expect(declared.length).toBeGreaterThan(0);
  return Math.max(...declared);
};

describe.each([
  ["ratings", renderRatings],
  ["about", renderAbout],
  ["analytics", renderAnalytics],
  ["privacy", renderPrivacy],
])("%s dialog stacking", (_name, renderOpen) => {
  it("portals out of the side nav so its layer is compared at the page root", () => {
    const { container } = renderOpen();
    const dialog = dialogRoot();
    expect(dialog).not.toBeNull();
    expect(document.getElementById("headlessui-portal-root")).toContainElement(
      dialog,
    );
    // The trigger button stays where the side nav renders it; the dialog leaves.
    expect(container.querySelector("button")).not.toBeNull();
    expect(container).not.toContainElement(dialog);
  });

  it("declares a layer above everything the Curriculum Map draws", () => {
    renderOpen();
    expect(dialogRoot().className).toContain(`z-[${DIALOG_Z_INDEX}]`);
    expect(curriculumMapCeiling()).toBeLessThan(DIALOG_Z_INDEX);
  });

  it("dims the page behind it instead of only blurring it", () => {
    renderOpen();
    // A blur-only backdrop left the green course chips fully legible behind
    // the dialog, which is what the stacking bug looked like on screen.
    const backdrop = dialogRoot().querySelector(".fixed.inset-0");
    expect(backdrop.className).toMatch(/bg-\w+-\d+\/\d+/);
    expect(backdrop.className).not.toMatch(/\bbackdrop-filter\b/);
  });
});
