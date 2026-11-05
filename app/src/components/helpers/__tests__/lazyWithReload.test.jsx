// A lazy chunk that fails to load (stale hash after a deploy) reloads the page
// once; a second failure reaches the error boundary instead of looping.

import { Component, Suspense } from "react";
import PropTypes from "prop-types";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lazyWithReload } from "../lazyWithReload";

const RELOAD_FLAG = "chunk-reload";

class TestBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <p>boundary: {this.state.error.message}</p>
    ) : (
      this.props.children
    );
  }
}
TestBoundary.propTypes = { children: PropTypes.node };

const renderLazy = (importer) => {
  const Panel = lazyWithReload(importer);
  return render(
    <TestBoundary>
      <Suspense fallback={<p>loading</p>}>
        <Panel />
      </Suspense>
    </TestBoundary>,
  );
};

const originalLocation = window.location;
let reload;

beforeEach(() => {
  sessionStorage.clear();
  reload = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, reload },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("lazyWithReload", () => {
  it("reloads once and keeps the fallback when the chunk fails to load", async () => {
    renderLazy(() => Promise.reject(new Error("stale chunk")));

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem(RELOAD_FLAG)).toBe("1");
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("shows the error boundary without reloading on a second failure", async () => {
    // React rethrows the render error to window and logs it; both are expected.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const swallow = (event) => event.preventDefault();
    window.addEventListener("error", swallow);
    sessionStorage.setItem(RELOAD_FLAG, "1");

    renderLazy(() => Promise.reject(new Error("stale chunk")));

    expect(await screen.findByText("boundary: stale chunk")).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
    window.removeEventListener("error", swallow);
  });

  it("clears the flag once a chunk loads", async () => {
    sessionStorage.setItem(RELOAD_FLAG, "1");

    renderLazy(() => Promise.resolve({ default: () => <p>panel</p> }));

    expect(await screen.findByText("panel")).toBeInTheDocument();
    expect(sessionStorage.getItem(RELOAD_FLAG)).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });
});
