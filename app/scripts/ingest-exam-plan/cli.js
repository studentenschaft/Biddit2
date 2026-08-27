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
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { buildExamPlan } from "./buildExamPlan.js";
import { formatReport } from "./formatReport.js";
import { parseExamPlanText } from "./parseExamPlanText.js";
import { validateAgainstCatalog } from "./validateAgainstCatalog.js";
import { validateExamPlan } from "./validateExamPlan.js";

const EXIT = { ok: 0, validationFailed: 1, usage: 2 };
const JSON_INDENT = 2;
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const USAGE = `Usage: npm run ingest:exams -- --semester <HS26|FS27> (--pdf <file> | --text <file>) [options]

  --pdf <file>          exam-plan PDF; converted with pdftotext -layout
  --text <file>         pre-extracted text, skips pdftotext
  --semester <key>      required; never inferred (Winter YYYY = HS(YYYY-1), Summer YYYY = FS(YYYY))
  --out <file>          write the artifact here; omit for a dry run
  --catalog <file>      course-catalog snapshot for the advisory cross-check`;

class UsageError extends Error {}

function extractPdfText(pdfPath) {
  try {
    return execFileSync(
      "pdftotext",
      ["-layout", "-enc", "UTF-8", "-eol", "unix", pdfPath, "-"],
      { encoding: "utf8" },
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new UsageError(
        "pdftotext was not found. Install poppler (`brew install poppler`) or pass --text.",
      );
    }
    throw new UsageError(`pdftotext failed for ${pdfPath}: ${error.message}`);
  }
}

function parseCliArgs(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        pdf: { type: "string" },
        text: { type: "string" },
        semester: { type: "string" },
        out: { type: "string" },
        catalog: { type: "string" },
      },
    }));
  } catch (error) {
    throw new UsageError(error.message);
  }
  if (Boolean(values.pdf) === Boolean(values.text)) {
    throw new UsageError("Pass exactly one of --pdf or --text.");
  }
  if (!values.semester) throw new UsageError("--semester is required.");
  return values;
}

function run(argv) {
  const options = parseCliArgs(argv);
  const inputPath = options.pdf ?? options.text;
  const rawText = options.pdf
    ? extractPdfText(options.pdf)
    : readFileSync(options.text, "utf8");

  const parsed = parseExamPlanText(rawText);
  const plan = buildExamPlan(parsed, {
    semester: options.semester,
    sourceFile: relative(REPO_ROOT, resolve(inputPath)),
  });
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

  if (errors.length > 0) {
    process.stdout.write("\nNothing written: validation failed.\n");
    return EXIT.validationFailed;
  }
  if (!options.out) {
    process.stdout.write("\nDry run: nothing written.\n");
    return EXIT.ok;
  }

  mkdirSync(dirname(options.out), { recursive: true });
  writeFileSync(options.out, `${JSON.stringify(plan, null, JSON_INDENT)}\n`);
  process.stdout.write(`\nWrote ${options.out}\n`);
  return EXIT.ok;
}

try {
  process.exitCode = run(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  if (error instanceof UsageError) process.stderr.write(`\n${USAGE}\n`);
  // Node system errors (ENOENT and friends) carry a string `code`; anything
  // else is the pipeline refusing to guess, which is a failed ingestion.
  const isUsageOrIo =
    error instanceof UsageError || typeof error.code === "string";
  process.exitCode = isUsageOrIo ? EXIT.usage : EXIT.validationFailed;
}
