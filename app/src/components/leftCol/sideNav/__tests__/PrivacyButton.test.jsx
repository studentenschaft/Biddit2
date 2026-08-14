import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyButton from "../PrivacyButton";

const SHSG_POLICY_URL = "https://shsg.ch/privacy-policy";

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

  it("discloses who operates Biddit and where to reach them", () => {
    const dialog = openDialog();
    expect(dialog).toHaveTextContent(
      /Student Union of the University of St\. Gallen \(SHSG\)/i,
    );
    expect(dialog).toHaveTextContent(/biddit@shsg\.ch/);
  });

  it("explains login and where course and plan data live", () => {
    const dialog = openDialog();
    expect(dialog).toHaveTextContent(/Microsoft Entra ID/);
    expect(dialog).toHaveTextContent(/pseudonymously/i);
    expect(dialog).toHaveTextContent(/Switzerland/);
  });

  it("names the analytics cookies, the transfer basis and the opt-out", () => {
    const dialog = openDialog();
    expect(dialog).toHaveTextContent(/Google Analytics/);
    expect(dialog).toHaveTextContent(/_ga_BMG2V9ZX73/);
    expect(dialog).toHaveTextContent(/Swiss–U\.S\. Data Privacy Framework/);
    expect(dialog).toHaveTextContent(
      /opt out at any time via Analytics settings/i,
    );
  });

  it("does not claim that opting out removes cookies already set", () => {
    const dialog = openDialog();
    expect(dialog.textContent).not.toMatch(/delet\w* .{0,20}cookies/i);
    expect(dialog.textContent).not.toMatch(/remov\w* .{0,20}cookies/i);
  });

  it("states the FADP rights and the supervisory authority", () => {
    const dialog = openDialog();
    expect(dialog).toHaveTextContent(
      /Swiss Federal Act on Data Protection \(FADP\)/,
    );
    expect(dialog).toHaveTextContent(
      /Federal Data Protection and Information Commissioner \(FDPIC\)/,
    );
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
