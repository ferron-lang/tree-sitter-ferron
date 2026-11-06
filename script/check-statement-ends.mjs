#!/usr/bin/env node
// Checks the grammar against the compiler's statement-end corpus,
// `ferron/crates/ferron-compiler/tests/fixtures/statement_ends/*.fer`
// (the compiler test `tooling_statement_boundaries` checks the same files).
// Each case lists, in `// stmt: ` and `// arm: ` lines, every statement
// directly inside a block and every match arm in source order, as its source
// text with lines trimmed and joined by one space.
//
// Usage: node script/check-statement-ends.mjs [cases-dir]
// (default: the sibling checkout `../ferron`).

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = resolve(
  process.argv[2] ?? join(root, "../ferron/crates/ferron-compiler/tests/fixtures/statement_ends"),
);
const files = readdirSync(dir)
  .filter((name) => name.endsWith(".fer"))
  .sort()
  .map((name) => join(dir, name));
if (files.length === 0) {
  console.error(`no .fer cases in ${dir}`);
  process.exit(1);
}

const queryPath = join(mkdtempSync(join(tmpdir(), "ferron-ts-")), "splits.scm");
writeFileSync(queryPath, "(block (_) @stmt)\n(match_arm) @arm\n(ERROR) @error\n(MISSING) @error\n");
// The pinned CLI from package.json, not whichever `tree-sitter` is on PATH.
const tsBin = join(root, "node_modules/.bin/tree-sitter");
const tsArgs = ["--config-path", join(root, ".tree-sitter-config.json")];
const env = { ...process.env, XDG_CACHE_HOME: process.env.XDG_CACHE_HOME ?? join(tmpdir(), "tree-sitter-cache") };

let failures = 0;
for (const file of files) {
  const source = readFileSync(file);
  const lines = source.toString("utf8").split("\n");
  const expected = lines
    .filter((line) => line.startsWith("// stmt: ") || line.startsWith("// arm: "))
    .map((line) => line.slice("// ".length));
  const output = execFileSync(tsBin, ["query", ...tsArgs, "--captures", queryPath, file], {
    cwd: root,
    env,
    encoding: "utf8",
  });
  // Positions are (row, byte column); slice the source so captured text stays exact.
  const rowStarts = [0];
  for (let at = source.indexOf(10); at !== -1; at = source.indexOf(10, at + 1)) rowStarts.push(at + 1);
  const capture = /capture: \d+ - (\w+), start: \((\d+), (\d+)\), end: \((\d+), (\d+)\)/g;
  const nodes = [];
  for (const [, label, sr, sc, er, ec] of output.matchAll(capture)) {
    const start = rowStarts[+sr] + +sc;
    const end = rowStarts[+er] + +ec;
    const text = source.subarray(start, end).toString("utf8");
    if (label !== "error" && (text.startsWith("//") || text.startsWith("/*"))) continue;
    nodes.push({ start, end, label, text });
  }
  nodes.sort((a, b) => a.start - b.start || b.end - a.end);
  const actual = nodes.map(
    ({ label, text }) => `${label}: ${text.split(/\r?\n/).map((line) => line.trim()).join(" ")}`,
  );
  if (actual.join("\n") !== expected.join("\n")) {
    failures += 1;
    console.error(`FAIL ${file}\n  expected:\n    ${expected.join("\n    ")}\n  actual:\n    ${actual.join("\n    ")}`);
  }
}
console.log(`${files.length - failures}/${files.length} statement-end cases match`);
process.exit(failures === 0 ? 0 : 1);
