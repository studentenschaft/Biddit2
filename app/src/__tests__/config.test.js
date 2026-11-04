import { describe, it, expect, vi, afterEach } from "vitest";

const ENV_NAMES = [
  "VITE_ENTRA_CLIENT_ID",
  "VITE_ENTRA_TENANT_ID",
  "VITE_UNISG_APPLICATION_ID",
  "VITE_UNISG_API_BASE",
  "VITE_SHSG_API_BASE",
];

const importFresh = async (path) => {
  vi.resetModules();
  return import(path);
};

describe("config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("falls back to the production identifiers and hosts", async () => {
    ENV_NAMES.forEach((name) => vi.stubEnv(name, undefined));
    const { config } = await importFresh("../config");

    expect(config).toEqual({
      entraClientId: "67a86d1c-e99b-4b9b-968f-5ac10a21bc5e",
      entraTenantId: "a7262e59-1b56-4f5a-a412-6f07181f48ee",
      unisgApplicationId: "820e077d-4c13-45b8-b092-4599d78d45ec",
      unisgApiBase: "https://integration.unisg.ch",
      shsgApiBase: "https://api.shsg.ch",
    });
  });

  it("lets VITE_SHSG_API_BASE move the SHSG host that isShsgHost matches", async () => {
    vi.stubEnv("VITE_SHSG_API_BASE", "https://staging.example");
    const { isShsgHost } = await importFresh(
      "../components/helpers/axiosClient",
    );

    expect(isShsgHost("https://staging.example/x")).toBe(true);
    expect(isShsgHost("https://api.shsg.ch/x")).toBe(false);
  });

  it("derives the API base constants from config", async () => {
    vi.stubEnv("VITE_UNISG_API_BASE", "https://unisg.staging.example");
    vi.stubEnv("VITE_SHSG_API_BASE", "https://shsg.staging.example");
    const { UNISG_API, SHSG_API, termsUrl } = await importFresh(
      "../components/helpers/apiEndpoints",
    );

    expect(UNISG_API).toBe("https://unisg.staging.example");
    expect(SHSG_API).toBe("https://shsg.staging.example");
    expect(termsUrl()).toBe(
      "https://unisg.staging.example/EventApi/CisTermAndPhaseInformations",
    );
  });
});

describe("msalConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("redirects back to the current origin and uses the configured tenant", async () => {
    vi.stubEnv("VITE_ENTRA_TENANT_ID", "tenant-under-test");
    vi.stubEnv("VITE_ENTRA_CLIENT_ID", "client-under-test");
    const { msalConfig } = await importFresh("../components/auth/authConfig");

    expect(msalConfig.auth.redirectUri).toBe(window.location.origin + "/");
    expect(msalConfig.auth.authority).toBe(
      "https://login.microsoftonline.com/tenant-under-test",
    );
    expect(msalConfig.auth.clientId).toBe("client-under-test");
  });
});
