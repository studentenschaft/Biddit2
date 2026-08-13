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
});
