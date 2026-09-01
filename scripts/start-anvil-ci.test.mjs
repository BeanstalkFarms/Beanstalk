import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

const helper = path.join(import.meta.dirname, "start-anvil-ci.sh");

function runHelper(args, env) {
  return new Promise((resolve) => {
    const child = spawn("/bin/bash", [helper, ...args], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("surfaces the launch process error when Anvil exits before becoming ready", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "anvil-ci-failure-"));
  const command = path.join(directory, "fail.sh");
  await writeFile(command, "#!/bin/bash\necho 'synthetic launch failure' >&2\nexit 23\n", {
    mode: 0o755
  });

  try {
    const result = await runHelper([command], {
      ANVIL_HEALTHCHECK_URL: "http://127.0.0.1:1",
      ANVIL_STARTUP_ATTEMPTS: "3",
      ANVIL_STARTUP_INTERVAL: "0.01",
      RUNNER_TEMP: directory
    });

    assert.equal(result.code, 23, JSON.stringify(result));
    assert.match(result.stderr, /synthetic launch failure/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("returns success only after the JSON-RPC endpoint responds", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "anvil-ci-success-"));
  const command = path.join(directory, "stay-alive.sh");
  const curl = path.join(directory, "curl");
  const pidFile = path.join(directory, "pid");
  await writeFile(
    command,
    "#!/bin/bash\necho $$ > \"$ANVIL_TEST_PID_FILE\"\ntrap 'exit 0' TERM INT\nwhile true; do sleep 1; done\n",
    { mode: 0o755 }
  );
  await writeFile(curl, "#!/bin/bash\nexit 0\n", { mode: 0o755 });

  try {
    const result = await runHelper([command], {
      ANVIL_HEALTHCHECK_URL: "http://127.0.0.1:8545",
      ANVIL_STARTUP_ATTEMPTS: "3",
      ANVIL_STARTUP_INTERVAL: "0.01",
      ANVIL_TEST_PID_FILE: pidFile,
      PATH: `${directory}:${process.env.PATH}`,
      RUNNER_TEMP: directory
    });

    assert.equal(result.code, 0, result.stderr);
  } finally {
    try {
      const pid = Number((await readFile(pidFile, "utf8")).trim());
      process.kill(pid, "SIGTERM");
    } catch {
      // The assertion output is more useful than a cleanup failure.
    }
    await rm(directory, { recursive: true, force: true });
  }
});
