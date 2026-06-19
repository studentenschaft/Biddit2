/**
 * Tests for OfflineModal rendering and behaviour.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import OfflineModal from "../OfflineModal";

afterEach(cleanup);

describe("OfflineModal", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(<OfflineModal isVisible={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the offline message and dialog role when visible", () => {
    render(<OfflineModal isVisible={true} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/you appear to be offline/i)).toBeInTheDocument();
    expect(
      screen.getByText(/make sure you have a steady connection/i),
    ).toBeInTheDocument();
  });

  it("calls onRefresh when the Try again button is clicked", () => {
    const onRefresh = vi.fn();
    render(<OfflineModal isVisible={true} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
