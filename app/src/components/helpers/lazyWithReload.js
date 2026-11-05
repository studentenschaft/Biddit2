import { lazy } from "react";

const RELOAD_FLAG = "chunk-reload";

// After a deploy an open tab asks for chunk hashes that no longer exist:
// reload once to fetch the new index.html; a second failure goes to the
// ErrorBoundary. Offline failures are left to the OfflineModal.
export const lazyWithReload = (importer) =>
  lazy(() =>
    importer().then(
      (module) => {
        sessionStorage.removeItem(RELOAD_FLAG);
        return module;
      },
      (error) => {
        if (navigator.onLine === false || sessionStorage.getItem(RELOAD_FLAG)) {
          throw error;
        }
        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
        return new Promise(() => {}); // keep the Suspense fallback until the reload
      },
    ),
  );
