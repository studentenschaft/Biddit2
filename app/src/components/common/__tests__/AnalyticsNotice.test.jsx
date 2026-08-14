import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import AnalyticsNotice, {
  ANALYTICS_NOTICE_STORAGE_KEY,
} from "../AnalyticsNotice";
import { ANALYTICS_OPT_OUT_STORAGE_KEY } from "../../helpers/analytics";

const noticeText = /biddit uses google analytics/i;

describe("AnalyticsNotice", () => {
  beforeEach(() => localStorage.clear());

  it("renders nothing where analytics never runs", () => {
    render(<AnalyticsNotice analyticsActive={false} />);
    expect(screen.queryByText(noticeText)).not.toBeInTheDocument();
  });

  it("renders where analytics is active", () => {
    render(<AnalyticsNotice analyticsActive />);
    expect(screen.getByText(noticeText)).toBeInTheDocument();
  });

  it("stays hidden after dismissal across re-renders", () => {
    const { unmount } = render(<AnalyticsNotice analyticsActive />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(noticeText)).not.toBeInTheDocument();
    expect(localStorage.getItem(ANALYTICS_NOTICE_STORAGE_KEY)).toBe("true");

    unmount();
    render(<AnalyticsNotice analyticsActive />);
    expect(screen.queryByText(noticeText)).not.toBeInTheDocument();
  });

  it("opting out records consent and hides the notice", () => {
    render(<AnalyticsNotice analyticsActive />);
    fireEvent.click(
      screen.getByRole("button", { name: /opt out of analytics/i }),
    );
    expect(localStorage.getItem(ANALYTICS_OPT_OUT_STORAGE_KEY)).toBe("true");
    expect(screen.queryByText(noticeText)).not.toBeInTheDocument();
  });

  it("does not show for a visitor who already opted out", () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_STORAGE_KEY, "true");
    render(<AnalyticsNotice analyticsActive />);
    expect(screen.queryByText(noticeText)).not.toBeInTheDocument();
  });
});
