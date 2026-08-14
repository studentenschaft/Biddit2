import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { RecoilRoot } from "recoil";
import { describe, expect, it } from "vitest";
import CourseInfo from "../CourseInfo";

describe("CourseInfo with no course selected", () => {
  it("renders a helpful empty state instead of a blank pane", async () => {
    render(
      <RecoilRoot>
        <Suspense fallback={null}>
          <CourseInfo />
        </Suspense>
      </RecoilRoot>,
    );
    expect(
      await screen.findByText(/select a course to see its details/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/click on a course to see details/i),
    ).not.toBeInTheDocument();
  });
});
