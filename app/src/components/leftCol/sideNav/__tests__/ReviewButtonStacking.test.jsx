/**
 * Stacking guard for the ratings dialog.
 *
 * The dialog portals to document.body, so the z-index on its root competes
 * with the page's own layers in the *root* stacking context — nothing between
 * #root and the Curriculum Map grid establishes one. At z-10 it lost to the
 * grid's sticky header cells (z-20) and its popovers/dropdowns (z-50), which
 * painted over the open dialog. jsdom computes no layout, so what is pinned
 * here is the invariant that broke: the dialog's layer must outrank every
 * layer the Curriculum Map declares.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecoilRoot } from "recoil";
import { reviewMenuModalState } from "../../../recoil/reviewMenuModal";
import { coursesTakenForRatingState } from "../../../recoil/coursesTakenForRatings";
import { ReviewButton } from "../ReviewButton";

const DIALOG_Z_INDEX = 60;

/** Every Curriculum Map component, as source, to read its z-index ceiling. */
const CURRICULUM_MAP_SOURCES = import.meta.glob(
  "../../../rightCol/CurriculumMap/*.jsx",
  { query: "?raw", import: "default", eager: true },
);

const renderOpen = () =>
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

const dialogRoot = () =>
  document.querySelector('[id^="headlessui-dialog-"]');

describe("ReviewButton dialog stacking", () => {
  it("portals out of the side nav so its layer is compared at the page root", () => {
    const { container } = renderOpen();
    const dialog = dialogRoot();
    expect(dialog).not.toBeNull();
    expect(document.getElementById("headlessui-portal-root")).toContainElement(
      dialog,
    );
    // The star button stays where the side nav renders it; the dialog leaves.
    expect(container.querySelector("button")).not.toBeNull();
    expect(container).not.toContainElement(dialog);
  });

  it("declares a layer above everything the Curriculum Map draws", () => {
    renderOpen();
    expect(dialogRoot().className).toContain(`z-[${DIALOG_Z_INDEX}]`);

    const declared = Object.values(CURRICULUM_MAP_SOURCES).flatMap((source) =>
      [
        ...source.matchAll(/\bz-(?:\[)?(\d+)\]?\b/g),
        ...source.matchAll(/zIndex:\s*(\d+)/g),
      ].map((match) => Number(match[1])),
    );

    expect(declared.length).toBeGreaterThan(0);
    expect(Math.max(...declared)).toBeLessThan(DIALOG_Z_INDEX);
  });

  it("dims the page behind it instead of only blurring it", () => {
    renderOpen();
    // A blur-only backdrop left the green course chips fully legible behind
    // the dialog, which is what the stacking bug looked like on screen.
    const backdrop = dialogRoot().querySelector(".fixed.inset-0");
    expect(backdrop.className).toMatch(/bg-\w+-\d+\/\d+/);
  });
});
