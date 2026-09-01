import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { after, before, test } from "node:test";

const scriptPath = new URL("./check-no-hardcoded-alchemy-keys.mjs", import.meta.url);
let fixtureRoot;
let trackedDirectoryRepo;

before(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), "beanstalk-alchemy-scan-"));
  mkdirSync(join(fixtureRoot, "clean"));
  mkdirSync(join(fixtureRoot, "leaked"));
  const leakedUrl = [
    "https://eth-mainnet.g.alchemy.com/v2/",
    "abcdefghijklmnopqrstuvwxyz123456"
  ].join("");
  writeFileSync(
    join(fixtureRoot, "clean", "config.ts"),
    "const url = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;\n"
  );
  writeFileSync(
    join(fixtureRoot, "clean", ".env.production"),
    "VITE_ALCHEMY_API_KEY=\nVITE_THEGRAPH_API_KEY=abcdefghijklmnopqrstuvwxyz123456\n"
  );
  writeFileSync(join(fixtureRoot, "leaked", "config.ts"), `const url = '${leakedUrl}';\n`);
  writeFileSync(
    join(fixtureRoot, "leaked", ".env.production"),
    "VITE_ALCHEMY_API_KEY=zyxwvutsrqponmlkjihgfedcba654321\n"
  );

  trackedDirectoryRepo = join(fixtureRoot, "tracked-directory-repo");
  mkdirSync(trackedDirectoryRepo);
  spawnSync("git", ["init", "--quiet"], { cwd: trackedDirectoryRepo });
  const trackedPath = join(trackedDirectoryRepo, "external");
  writeFileSync(trackedPath, "tracked as a file\n");
  spawnSync("git", ["add", "external"], { cwd: trackedDirectoryRepo });
  rmSync(trackedPath);
  mkdirSync(trackedPath);
});

after(() => {
  rmSync(fixtureRoot, { force: true, recursive: true });
});

test("accepts runtime-provided Alchemy credentials", () => {
  const result = spawnSync(process.execPath, [scriptPath.pathname, join(fixtureRoot, "clean")], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
});

test("reports a hardcoded credential without printing its value", () => {
  const result = spawnSync(process.execPath, [scriptPath.pathname, join(fixtureRoot, "leaked")], {
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /config\.ts:1: hardcoded Alchemy credential/);
  assert.match(result.stderr, /\.env\.production:1: hardcoded Alchemy credential/);
  assert.doesNotMatch(result.stderr, /abcdefghijklmnopqrstuvwxyz123456/);
  assert.doesNotMatch(result.stderr, /zyxwvutsrqponmlkjihgfedcba654321/);
});

test("skips indexed paths that are directories in the working tree", () => {
  const result = spawnSync(process.execPath, [scriptPath.pathname], {
    cwd: trackedDirectoryRepo,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
});
