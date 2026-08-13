import { fireEvent, render, screen } from "@testing-library/react";
import { RecoilRoot, useRecoilValue } from "recoil";
import { describe, expect, it } from "vitest";
import { selectedTabAtom } from "../../../../recoil/selectedTabAtom";
import { TAB } from "../../../../../constants/tabs";
import StudyOverviewMigrationNotice from "../StudyOverviewMigrationNotice";

const SelectedTabValue = () => {
  const selectedTab = useRecoilValue(selectedTabAtom);
  return <output aria-label="Selected tab">{selectedTab}</output>;
};

const renderNotice = () =>
  render(
    <RecoilRoot
      initializeState={({ set }) => set(selectedTabAtom, TAB.STUDY_OVERVIEW)}
    >
      <StudyOverviewMigrationNotice />
      <SelectedTabValue />
    </RecoilRoot>,
  );

describe("StudyOverviewMigrationNotice", () => {
  it("explains that Curriculum Map will replace Study Overview", () => {
    renderNotice();

    expect(
      screen.getByText(/Study Overview will soon be replaced by the new Curriculum Map/i),
    ).toBeInTheDocument();
  });

  it("opens the Curriculum Map tab", () => {
    renderNotice();

    fireEvent.click(
      screen.getByRole("button", { name: /open curriculum map/i }),
    );

    expect(screen.getByLabelText(/selected tab/i)).toHaveTextContent(
      TAB.CURRICULUM_MAP,
    );
  });

  it("has no dismiss control and remains visible after remounting", () => {
    const { unmount } = renderNotice();

    expect(
      screen.queryByRole("button", { name: /dismiss|close/i }),
    ).not.toBeInTheDocument();

    unmount();
    renderNotice();

    expect(
      screen.getByRole("button", { name: /open curriculum map/i }),
    ).toBeInTheDocument();
  });
});
