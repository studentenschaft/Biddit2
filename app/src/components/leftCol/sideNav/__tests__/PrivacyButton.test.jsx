import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyButton from "../PrivacyButton";

const SHSG_POLICY_URL = "https://shsg.ch/privacy-policy";

/**
 * Disclosures the dialog must carry — the FADP/TCA information duties plus the
 * factual claims we make about where data goes. Each entry is asserted against
 * the opened dialog's text.
 */
const REQUIRED_DISCLOSURES = [
  ["operator", /Student Union of the University of St\. Gallen \(SHSG\)/i],
  ["contact address", /biddit@shsg\.ch/],
  ["login mechanism", /Microsoft Entra ID/],
  ["login identity reaching SHSG", /include your HSG login identity/i],
  ["storage location", /stored on SHSG servers in Switzerland/i],
  ["hashed key", /keyed by a hashed identifier/i],
  ["analytics provider", /Google Analytics/],
  ["analytics cookie names", /_ga_BMG2V9ZX73/],
  ["transfer basis", /Swiss–U\.S\. Data Privacy Framework/],
  ["opt-out route", /opt out at any time via Analytics settings/i],
  ["FADP rights", /Swiss Federal Act on Data Protection \(FADP\)/],
  [
    "supervisory authority",
    /Federal Data Protection and Information Commissioner \(FDPIC\)/,
  ],
];

/** Renders the trigger, opens the dialog and returns its element. */
const openDialog = () => {
  render(<PrivacyButton />);
  fireEvent.click(screen.getByRole("button", { name: "Privacy" }));
  return screen.getByRole("dialog");
};

describe("PrivacyButton", () => {
  it("opens the privacy dialog from the side-nav trigger", () => {
    render(<PrivacyButton />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Privacy" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it.each(REQUIRED_DISCLOSURES)("discloses the %s", (_label, pattern) => {
    expect(openDialog()).toHaveTextContent(pattern);
  });

  it("does not claim that opting out removes cookies already set", () => {
    const dialog = openDialog();
    expect(dialog.textContent).not.toMatch(/delet\w* .{0,20}cookies/i);
    expect(dialog.textContent).not.toMatch(/remov\w* .{0,20}cookies/i);
  });

  it("does not claim the stored data is pseudonymous", () => {
    // Requests to SHSG carry the HSG login identity, so the data is not
    // pseudonymous towards SHSG — see the wording in the dialog.
    expect(openDialog().textContent).not.toMatch(/pseudonym/i);
  });

  it("links out to the SHSG privacy policy from inside the dialog", () => {
    const dialog = openDialog();
    const link = screen.getByRole("link", {
      name: /shsg\.ch\/privacy-policy/i,
    });
    expect(link).toHaveAttribute("href", SHSG_POLICY_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(dialog).toContainElement(link);
  });

  it("closes again via the dialog's close button", () => {
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
