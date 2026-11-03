// Local check: lists every file or folder CLAUDE.md names that does not exist
// and exits 1 if there is any. Usage (from app/): node scripts/check-doc-paths.mjs
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(appDir, "..");
const srcDir = resolve(appDir, "src");
const roots = [srcDir, resolve(srcDir, "components"), appDir, repoRoot];

const PATH_SUFFIX = /(\.jsx?|\.md|\.json|\/)$/;
const BARE_FILE = /^[\w.-]+\.jsx?$/;

const isCheckable = (token) =>
  (token.includes("/") ? PATH_SUFFIX.test(token) : BARE_FILE.test(token)) &&
  !token.startsWith("http") &&
  !token.includes("<") &&
  !token.includes("*");

// Git does not track empty folders, so an empty local folder is missing in CI.
const exists = (path) => {
  if (!existsSync(path)) return false;
  return !statSync(path).isDirectory() || readdirSync(path).length > 0;
};

// Bare file names (`useCourseInfoData.js`) may live anywhere under src/.
const srcFileNames = new Set(
  readdirSync(srcDir, { recursive: true }).map((path) => basename(path))
);

const resolves = (token) =>
  token.includes("/")
    ? roots.some((root) => exists(resolve(root, token)))
    : srcFileNames.has(token);

const markdown = readFileSync(resolve(repoRoot, "CLAUDE.md"), "utf8");
const tokens = [...markdown.matchAll(/`([^`\n]+)`/g)].map(([, token]) =>
  token.trim()
);

const missing = [...new Set(tokens.filter(isCheckable))].filter(
  (token) => !resolves(token)
);

for (const token of missing) console.log(token);
process.exit(missing.length > 0 ? 1 : 0);
