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
});
