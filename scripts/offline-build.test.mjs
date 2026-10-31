import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const yarn = path.join(root, ".yarn/releases/yarn-4.1.0.cjs");
const blocker = path.join(root, "scripts/test-support/block-network.cjs");

for (const workspace of ["@beanstalk/sdk", "ui"]) {
  test(`${workspace} generates GraphQL types with network disabled`, () => {
    // Codegen also writes a tracked introspection file. Preserve the caller's
    // version so this regression test cannot introduce unrelated schema changes.
    const introspection = path.join(
      root,
      "projects/ui/src/graph/graphql.schema.json",
    );
    const previous = readFileSync(introspection);
    let result;
    try {
      result = spawnSync(
        process.execPath,
        [yarn, "workspace", workspace, "generate:graphql"],
        {
          cwd: root,
          env: {
            ...process.env,
            NODE_OPTIONS: `--require=${JSON.stringify(blocker)}`,
          },
          encoding: "utf8",
          timeout: 120000,
        },
      );
    } finally {
      writeFileSync(introspection, previous);
    }
    const output = `${result.stdout}\n${result.stderr}`;
    assert.doesNotMatch(output, /OFFLINE_TEST_NETWORK_ATTEMPT/, output);
    assert.equal(result.status, 0, output);
  });
}

for (const host of ["netlify", "fleek"]) {
  test(`${host} stops before UI build when SDK build fails`, () => {
    const bin = mkdtempSync(path.join(os.tmpdir(), "bean-build-test-"));
    try {
      writeFileSync(
        path.join(bin, "yarn"),
        '#!/bin/sh\nif [ "$1" = "all:build" ]; then exit 23; fi\necho UI_BUILD_STARTED\n',
        { mode: 0o755 },
      );
      const result = spawnSync(
        "/bin/sh",
        [path.join(root, `projects/ui/utils/build-${host}.sh`)],
        {
          cwd: root,
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            PROJECT_CWD: root,
          },
          encoding: "utf8",
        },
      );
      assert.equal(result.status, 23, `${result.stdout}\n${result.stderr}`);
      assert.doesNotMatch(result.stdout, /UI_BUILD_STARTED/);
    } finally {
      rmSync(bin, { recursive: true, force: true });
    }
  });
}
