import { fireEvent, render, screen } from "@testing-library/react";
import { RecoilRoot, useRecoilValue } from "recoil";
import { describe, expect, it } from "vitest";
import { smartSearchState } from "../../../recoil/smartSearchAtom";
import SearchModeToggle from "../SearchModeToggle";

const ModeValue = () => {
  const search = useRecoilValue(smartSearchState);
  return <output aria-label="mode">{search.mode}</output>;
};

describe("SearchModeToggle", () => {
  it("switches between keyword and smart mode", () => {
    render(
      <RecoilRoot>
        <SearchModeToggle />
        <ModeValue />
      </RecoilRoot>
    );
    expect(screen.getByLabelText("mode")).toHaveTextContent("keyword");
    fireEvent.click(screen.getByRole("button", { name: /smart/i }));
    expect(screen.getByLabelText("mode")).toHaveTextContent("smart");
    fireEvent.click(screen.getByRole("button", { name: /keyword/i }));
    expect(screen.getByLabelText("mode")).toHaveTextContent("keyword");
  });

  it("clears stale results when the mode changes", () => {
    const Seed = () => {
      const search = useRecoilValue(smartSearchState);
      return <output aria-label="results">{search.resultIds.length}</output>;
    };

    render(
      <RecoilRoot
        initializeState={({ set }) =>
          set(smartSearchState, {
            mode: "smart",
            query: "programming",
            resultIds: ["a", "b"],
            distances: [0.1, 0.2],
            isLoading: false,
            hasSearched: true,
          })
        }
      >
        <SearchModeToggle />
        <Seed />
      </RecoilRoot>
    );

    expect(screen.getByLabelText("results")).toHaveTextContent("2");
    fireEvent.click(screen.getByRole("button", { name: /keyword/i }));
    expect(screen.getByLabelText("results")).toHaveTextContent("0");
  });

  // The retired Smart Search tab explained itself with a green intro panel;
  // the advice only applies to smart mode, so it follows the mode.
  it("explains smart search only while smart mode is on", () => {
    render(
      <RecoilRoot>
        <SearchModeToggle />
      </RecoilRoot>
    );
    const hint = /find courses based on what they're really about/i;
    expect(screen.queryByText(hint)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /smart/i }));
    expect(screen.getByText(hint)).toBeInTheDocument();
    expect(screen.getByText(/try descriptive phrases like/i)).toBeInTheDocument();
    expect(
      screen.getByText(/"Programming basics" · "History and Asia"/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /keyword/i }));
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
  });
});
