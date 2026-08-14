import { fireEvent, render, screen } from "@testing-library/react";
import { RecoilRoot, useRecoilValue } from "recoil";
import { describe, expect, it, vi } from "vitest";
import { trackCourseDetailsOpened } from "../analytics";
import { selectedTabAtom } from "../../recoil/selectedTabAtom";
import { selectedCourseInfoSelector } from "../../recoil/unifiedCourseDataSelectors";
import { TAB } from "../../../constants/tabs";
import { useOpenCourseDetails } from "../useOpenCourseDetails";

vi.mock("../analytics", () => ({
  trackCourseDetailsOpened: vi.fn(),
  trackTabSelect: vi.fn(),
}));

const COURSE = { shortName: "Advanced Cybersecurity", courseNumber: "1234" };

const Harness = () => {
  const openCourseDetails = useOpenCourseDetails();
  const tab = useRecoilValue(selectedTabAtom);
  const selected = useRecoilValue(selectedCourseInfoSelector);
  return (
    <>
      <button onClick={() => openCourseDetails(COURSE, { source: "course-list" })}>
        open
      </button>
      <button onClick={() => openCourseDetails(null, { source: "course-list" })}>
        open-null
      </button>
      <output aria-label="tab">{tab}</output>
      <output aria-label="course">{selected?.shortName ?? "none"}</output>
    </>
  );
};

const renderHarness = () =>
  render(
    <RecoilRoot initializeState={({ set }) => set(selectedTabAtom, TAB.SUMMARY)}>
      <Harness />
    </RecoilRoot>,
  );

describe("useOpenCourseDetails", () => {
  it("sets the selected course and switches to the details tab", () => {
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "open" }));
    expect(screen.getByLabelText("tab")).toHaveTextContent(TAB.COURSE_DETAILS);
    expect(screen.getByLabelText("course")).toHaveTextContent("Advanced Cybersecurity");
    expect(trackCourseDetailsOpened).toHaveBeenCalledWith("course-list");
  });

  it("ignores falsy courses", () => {
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "open-null" }));
    expect(screen.getByLabelText("tab")).toHaveTextContent(TAB.SUMMARY);
  });
});
