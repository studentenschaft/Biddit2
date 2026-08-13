/**
 * Pins the landing tab. The default lives in the atom rather than in a
 * component, so a change here silently changes what every user sees first.
 */

import { render } from "@testing-library/react";
import { RecoilRoot, useRecoilValue } from "recoil";
import { describe, expect, it } from "vitest";
import { TAB } from "../../../constants/tabs";
import { selectedTabAtom } from "../selectedTabAtom";

describe("selectedTabAtom", () => {
  it("defaults to the Semester Summary tab", () => {
    let observed;
    const Probe = () => {
      observed = useRecoilValue(selectedTabAtom);
      return null;
    };

    render(
      <RecoilRoot>
        <Probe />
      </RecoilRoot>,
    );

    expect(observed).toBe(TAB.SUMMARY);
  });
});
