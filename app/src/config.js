// Deployment configuration. Every value can be overridden with a VITE_* build
// variable (see app/.env.example); the defaults are the production values.
// These are public client identifiers and hosts, not secrets.
export const config = {
  entraClientId: import.meta.env.VITE_ENTRA_CLIENT_ID ?? "67a86d1c-e99b-4b9b-968f-5ac10a21bc5e",
  entraTenantId: import.meta.env.VITE_ENTRA_TENANT_ID ?? "a7262e59-1b56-4f5a-a412-6f07181f48ee",
  unisgApplicationId: import.meta.env.VITE_UNISG_APPLICATION_ID ?? "820e077d-4c13-45b8-b092-4599d78d45ec",
  unisgApiBase: import.meta.env.VITE_UNISG_API_BASE ?? "https://integration.unisg.ch",
  shsgApiBase: import.meta.env.VITE_SHSG_API_BASE ?? "https://api.shsg.ch",
};
