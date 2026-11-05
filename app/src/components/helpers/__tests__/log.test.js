import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "../log";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("log", () => {
  it("debug is silent outside DEV", () => {
    vi.stubEnv("DEV", false);
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.debug("x");
    expect(spy).not.toHaveBeenCalled();
  });

  it("info is silent outside DEV", () => {
    vi.stubEnv("DEV", false);
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    log.info("x");
    expect(spy).not.toHaveBeenCalled();
  });

  it("debug and info forward in DEV", () => {
    vi.stubEnv("DEV", true);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    log.debug("d", 1);
    log.info("i", 2);
    expect(logSpy).toHaveBeenCalledWith("d", 1);
    expect(infoSpy).toHaveBeenCalledWith("i", 2);
  });

  it("error always forwards", () => {
    vi.stubEnv("DEV", false);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.error("boom", 1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("boom", 1);
  });

  it("warn always forwards", () => {
    vi.stubEnv("DEV", false);
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    log.warn("careful");
    expect(spy).toHaveBeenCalledWith("careful");
  });
});
