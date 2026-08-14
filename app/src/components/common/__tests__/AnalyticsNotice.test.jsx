import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import AnalyticsNotice, {
  ANALYTICS_NOTICE_STORAGE_KEY,
} from "../AnalyticsNotice";
import { ANALYTICS_OPT_OUT_STORAGE_KEY } from "../../helpers/analytics";

const noticeText = /biddit uses cookies for the hsg login/i;

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

  it("names both cookie purposes and where the setting lives afterwards", () => {
    render(<AnalyticsNotice analyticsActive />);
    const notice = screen.getByRole("status");

    // Logged-out visitors have no side bar, so the notice has to stand alone.
    expect(notice).toHaveTextContent(
      /cookies for the HSG login and Google Analytics for anonymous usage statistics/i,
    );
    expect(notice).toHaveTextContent(
      /Analytics settings \(chart icon\) in the side bar after signing in/i,
    );
  });

  it("announces itself to screen readers", () => {
    render(<AnalyticsNotice analyticsActive />);
    expect(screen.getByRole("status")).toContainElement(
      screen.getByText(noticeText),
    );
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

  it("opens the full privacy disclosure from the notice itself", () => {
    render(<AnalyticsNotice analyticsActive />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /privacy details/i }));

    const dialog = screen.getByRole("dialog");
    expect(
      screen.getByRole("heading", { name: "Privacy" }),
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/Swiss–U\.S\. Data Privacy Framework/);
  });

  it("does not show for a visitor who already opted out", () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_STORAGE_KEY, "true");
    render(<AnalyticsNotice analyticsActive />);
    expect(screen.queryByText(noticeText)).not.toBeInTheDocument();
  });

  it("records the disclosure as settled when the opt-out came from elsewhere", () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_STORAGE_KEY, "true");
    render(<AnalyticsNotice analyticsActive />);
    expect(localStorage.getItem(ANALYTICS_NOTICE_STORAGE_KEY)).toBe("true");

    // A later opt-in must not resurrect the first-visit notice.
    localStorage.removeItem(ANALYTICS_OPT_OUT_STORAGE_KEY);
    render(<AnalyticsNotice analyticsActive />);
    expect(screen.queryByText(noticeText)).not.toBeInTheDocument();
  });
});
