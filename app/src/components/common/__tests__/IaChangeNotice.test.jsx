import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import IaChangeNotice, { IA_NOTICE_STORAGE_KEY } from "../IaChangeNotice";

describe("IaChangeNotice", () => {
  beforeEach(() => localStorage.clear());

  it("shows until dismissed, then stays hidden", () => {
    const { unmount } = render(<IaChangeNotice />);
    expect(screen.getByText(/smart search now lives/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(/smart search now lives/i)).not.toBeInTheDocument();
    unmount();
    render(<IaChangeNotice />);
    expect(screen.queryByText(/smart search now lives/i)).not.toBeInTheDocument();
    expect(localStorage.getItem(IA_NOTICE_STORAGE_KEY)).toBe("true");
  });

  // Study Overview is retained (ADR 0002), so the banner must not announce it
  // as retired — the claim was true only while the tab was deleted.
  it("does not claim Study Overview was retired", () => {
    render(<IaChangeNotice />);
    expect(screen.queryByText(/retired/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/study overview/i)).not.toBeInTheDocument();
    expect(screen.getByText(/grouped by scope/i)).toBeInTheDocument();
  });
});
