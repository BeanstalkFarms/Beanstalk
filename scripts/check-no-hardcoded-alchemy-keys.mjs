#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

const SKIPPED_DIRECTORIES = new Set([".git", ".yarn", "node_modules"]);
const PATTERNS = [
  /(?:https?:\/\/)?(?:[a-z0-9-]+\.)?alchemy(?:api)?\.(?:com|io)\/v2\/[A-Za-z0-9_-]{20,}/gi,
  /^[ \t]*[A-Z0-9_]*ALCHEMY[A-Z0-9_]*KEY[ \t]*=[ \t]*["']?[A-Za-z0-9_-]{20,}/gim
];

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8"
}).trim();

function collectFiles(path) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return [];
  if (stat.isFile()) return [path];
  if (!stat.isDirectory() || SKIPPED_DIRECTORIES.has(basename(path))) return [];

  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    collectFiles(join(path, entry.name))
  );
}

function isRegularFile(path) {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

function trackedFiles() {
  return execFileSync("git", ["-C", repoRoot, "ls-files", "-z"], {
    encoding: "utf8"
  })
    .split("\0")
    .filter(Boolean)
    .map((path) => join(repoRoot, path))
    .filter(isRegularFile);
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split("\n").length;
}

function scan(path) {
  const content = readFileSync(path, "utf8");
  if (content.includes("\0")) return [];

  const lines = new Set();
  for (const pattern of PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      lines.add(lineNumberAt(content, match.index));
    }
  }

  return [...lines].sort((a, b) => a - b);
}

const requestedPaths = process.argv.slice(2);
const files = requestedPaths.length
  ? requestedPaths.flatMap((path) => collectFiles(isAbsolute(path) ? path : resolve(path)))
  : trackedFiles();

const findings = files.flatMap((path) =>
  scan(path).map((line) => ({
    line,
    path: relative(requestedPaths.length ? process.cwd() : repoRoot, path)
  }))
);

if (findings.length) {
  for (const finding of findings) {
    console.error(`${finding.path}:${finding.line}: hardcoded Alchemy credential`);
  }
  process.exitCode = 1;
}
