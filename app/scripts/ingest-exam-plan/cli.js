#!/usr/bin/env node
/**
 * Once-per-semester ingestion of the HSG exam-plan PDF into
 * `public/exams/<semester>.json`. See README.md for the runbook.
 *
 * This is the only file in the pipeline that touches the filesystem, the
 * process or a child process; everything it calls is pure and unit-tested.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { buildExamPlan } from "./buildExamPlan.js";
import { formatReport } from "./formatReport.js";
import { parseByodShading } from "./parseByodShading.js";
import { parseExamPlanText } from "./parseExamPlanText.js";
import { validateAgainstCatalog } from "./validateAgainstCatalog.js";
import { validateExamPlan } from "./validateExamPlan.js";

const JSON_INDENT = 2;
const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const USAGE = `Usage: npm run ingest:exams -- (--pdf <file> | --text <file>) [options]

  --pdf <file>          exam-plan PDF; read with pdftotext and pdftocairo
  --text <file>         pre-extracted pdftotext -layout text, skips poppler;
                        only titles that say "(BYOD)" are then marked BYOD
  --out <file>          write here instead of public/exams/<SEMESTER>.json
                        (the semester is read from the plan's title)
  --dry-run             validate and report only; write nothing
  --allow-removals      write even if the existing file has exams this plan lacks
  --catalog <file>      course-catalog snapshot for the advisory cross-check
  --save-fixtures <prefix>
                        with --pdf: also write <prefix>.txt and
                        <prefix>.byod.json for the golden test`;

function poppler(tool, args) {
  try {
    // The SVG of a four-page plan runs to megabytes, past the 1 MB default.
    return execFileSync(tool, args, { encoding: "utf8", maxBuffer: Infinity });
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        `${tool} was not found. Install poppler (\`brew install poppler\`), or pass --text: it marks BYOD only where a title says "(BYOD)", so the exams the plan shades are lost.`,
      );
    }
    throw error;
  }
}

function readPdf(pdfPath) {
  return {
    rawText: poppler(
      "pdftotext",
      ["-layout", "-enc", "UTF-8", "-eol", "unix", pdfPath, "-"],
    ),
    shadedRoots: parseByodShading(
      poppler("pdftocairo", ["-svg", pdfPath, "-"]),
      poppler("pdftotext", ["-bbox-layout", "-enc", "UTF-8", pdfPath, "-"]),
    ),
  };
}

function parseCliArgs(argv) {
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        pdf: { type: "string" },
        text: { type: "string" },
        out: { type: "string" },
        "dry-run": { type: "boolean" },
        "allow-removals": { type: "boolean" },
        catalog: { type: "string" },
        "save-fixtures": { type: "string" },
      },
    });
    if (Boolean(values.pdf) === Boolean(values.text)) {
      throw new Error("Pass exactly one of --pdf or --text.");
    }
    if (values["save-fixtures"] && !values.pdf) {
      throw new Error("--save-fixtures needs --pdf.");
    }
    return values;
  } catch (error) {
    throw Object.assign(error, { showUsage: true });
  }
}

const examIds = (plan) => [...plan.written, ...plan.oral].map((exam) => exam.id);

/**
 * A re-ingest must not lose an exam unnoticed: a partial or re-laid-out PDF
 * can validate cleanly and still list fewer exams than the published file.
 */
function refuseRemovals(out, plan) {
  if (!existsSync(out)) return;
  const kept = new Set(examIds(plan));
  const removed = examIds(JSON.parse(readFileSync(out, "utf8"))).filter(
    (id) => !kept.has(id),
  );
  if (removed.length > 0) {
    throw Object.assign(
      new Error(
        `Nothing written: ${removed.length} exams in ${out} are missing from this plan. Check each against the PDF; if HSG really dropped them, re-run with --allow-removals.`,
      ),
      { missingIds: removed },
    );
  }
}

function run(argv) {
  const options = parseCliArgs(argv);
  // The BYOD shading exists only in the PDF.
  const { rawText, shadedRoots } = options.pdf
    ? readPdf(options.pdf)
    : { rawText: readFileSync(options.text, "utf8"), shadedRoots: {} };

  const parsed = parseExamPlanText(rawText);
  const plan = buildExamPlan(parsed, shadedRoots);
  const { errors, warnings, stats } = validateExamPlan(plan, rawText);

  const catalogDiff = options.catalog
    ? validateAgainstCatalog(
        plan,
        JSON.parse(readFileSync(options.catalog, "utf8")),
      )
    : null;

  process.stdout.write(
    `${formatReport({
      plan,
      errors,
      warnings: [...parsed.warnings, ...warnings],
      stats,
      catalogDiff,
    })}\n\n`,
  );

  if (errors.length > 0) throw new Error("Nothing written: validation failed.");
  if (options["dry-run"]) {
    process.stdout.write("Dry run: nothing written.\n");
    return;
  }

  const out =
    options.out ?? resolve(APP_DIR, "public/exams", `${plan.semester}.json`);
  if (!options["allow-removals"]) refuseRemovals(out, plan);
  // Renaming into place means a reader (the dev server, a build) sees the old
  // artifact or the new one, never a half-written file.
  const temp = `${out}.tmp`;
  mkdirSync(dirname(out), { recursive: true });
  try {
    writeFileSync(temp, `${JSON.stringify(plan, null, JSON_INDENT)}\n`);
    renameSync(temp, out);
  } finally {
    // Only a failed write leaves it behind, where the dev server would serve
    // it and git would offer to commit it.
    rmSync(temp, { force: true });
  }
  process.stdout.write(`Wrote ${out}\n`);

  // Saved only with the artifact they must rebuild byte for byte.
  const prefix = options["save-fixtures"];
  if (prefix) {
    writeFileSync(`${prefix}.txt`, rawText);
    writeFileSync(
      `${prefix}.byod.json`,
      `${JSON.stringify(shadedRoots, null, JSON_INDENT)}\n`,
    );
    process.stdout.write(`Wrote ${prefix}.txt and ${prefix}.byod.json\n`);
  }
}

try {
  run(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  for (const id of error.missingIds ?? []) process.stderr.write(`  ${id}\n`);
  if (error.showUsage) process.stderr.write(`\n${USAGE}\n`);
  process.exitCode = 1;
}
