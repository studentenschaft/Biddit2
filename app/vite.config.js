import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Large vendors that change rarely get their own long-cacheable chunk.
// vendor-react exists because Rollup otherwise folds react into the first
// manual chunk that imports it (react into vendor-azure, react-dom into
// vendor-dnd-kit), so a dnd-kit upgrade would invalidate react-dom.
const VENDOR_CHUNKS = {
  "vendor-react": ["react", "react-dom", "scheduler"],
  "vendor-fullcalendar": ["@fullcalendar"],
  "vendor-azure": ["@azure"],
  "vendor-dnd-kit": ["@dnd-kit"],
};

const vendorChunkFor = (id) =>
  Object.keys(VENDOR_CHUNKS).find((chunk) =>
    VENDOR_CHUNKS[chunk].some((pkg) => id.includes(`/node_modules/${pkg}/`)),
  );

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Set the server port to 3000
  },
  build: {
    sourcemap: true, // Enable source maps, very important for error tracing / effective error messages in prod
    rollupOptions: {
      output: {
        manualChunks: vendorChunkFor,
      },
    },
  },
});
