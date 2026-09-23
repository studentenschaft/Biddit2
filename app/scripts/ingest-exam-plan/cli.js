#!/usr/bin/env node
/**
 * Once-per-semester ingestion of the HSG exam-plan PDF into
 * `public/exams/<semester>.json`. See README.md for the runbook.
 *
 * This is the only file in the pipeline that touches the filesystem, the
 * process or a child process; everything it calls is pure and unit-tested.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { buildExamPlan } from "./buildExamPlan.js";
import { formatReport } from "./formatReport.js";
import { parseExamPlanText } from "./parseExamPlanText.js";
import { validateAgainstCatalog } from "./validateAgainstCatalog.js";
import { validateExamPlan } from "./validateExamPlan.js";

const JSON_INDENT = 2;
const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const USAGE = `Usage: npm run ingest:exams -- (--pdf <file> | --text <file>) [options]

  --pdf <file>          exam-plan PDF; converted with pdftotext -layout
  --text <file>         pre-extracted text, skips pdftotext
  --out <file>          write here instead of public/exams/<SEMESTER>.json
                        (the semester is read from the plan's title)
  --dry-run             validate and report only; write nothing
  --catalog <file>      course-catalog snapshot for the advisory cross-check`;

function extractPdfText(pdfPath) {
  try {
    return execFileSync(
      "pdftotext",
      ["-layout", "-enc", "UTF-8", "-eol", "unix", pdfPath, "-"],
      { encoding: "utf8" },
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "pdftotext was not found. Install poppler (`brew install poppler`) or pass --text.",
      );
    }
    throw error;
  }
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
        catalog: { type: "string" },
      },
    });
    if (Boolean(values.pdf) === Boolean(values.text)) {
      throw new Error("Pass exactly one of --pdf or --text.");
    }
    return values;
  } catch (error) {
    throw new Error(`${error.message}\n\n${USAGE}`);
  }
}

function run(argv) {
  const options = parseCliArgs(argv);
  const rawText = options.pdf
    ? extractPdfText(options.pdf)
    : readFileSync(options.text, "utf8");

  const parsed = parseExamPlanText(rawText);
  const plan = buildExamPlan(parsed);
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
    })}\n`,
  );

  if (errors.length > 0) throw new Error("\nNothing written: validation failed.");
  if (options["dry-run"]) {
    process.stdout.write("\nDry run: nothing written.\n");
    return;
  }

  const out =
    options.out ?? resolve(APP_DIR, "public/exams", `${plan.semester}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(plan, null, JSON_INDENT)}\n`);
  process.stdout.write(`\nWrote ${out}\n`);
}

try {
  run(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
