// Bundle budget: lists every JS chunk in dist/assets with its size and exits 1
// when the main chunk (the largest index-*.js) exceeds BUDGET_BYTES.
// Usage (from app/, after `npm run build`): npm run check-bundle
import { readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BUDGET_BYTES = 700_000;

const assetsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist", "assets");

const chunks = readdirSync(assetsDir)
  .filter((name) => name.endsWith(".js"))
  .map((name) => ({ name, bytes: statSync(resolve(assetsDir, name)).size }))
  .sort((a, b) => b.bytes - a.bytes);

const main = chunks.find(({ name }) => /^index-.*\.js$/.test(name));
if (!main) {
  console.error(`No index-*.js chunk in ${assetsDir}.`);
  process.exit(1);
}

const width = Math.max(...chunks.map(({ name }) => name.length));
for (const { name, bytes } of chunks) {
  console.log(`${name.padEnd(width)}  ${bytes.toLocaleString("en-US").padStart(11)} B`);
}

const summary = `Main chunk ${main.name}: ${main.bytes.toLocaleString("en-US")} B (budget ${BUDGET_BYTES.toLocaleString("en-US")} B)`;
if (main.bytes > BUDGET_BYTES) {
  console.error(`${summary}: over budget.`);
  process.exit(1);
}
console.log(`${summary}: OK.`);
