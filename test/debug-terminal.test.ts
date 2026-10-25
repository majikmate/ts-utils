// Tests debug-terminal of dist/ (the code that courses install): it clears the
// terminal only when the output is a terminal, and Node.js ends without
// waiting for a debugger that is still connected.
import { strict as assert } from "node:assert";
import { spawn, spawnSync } from "node:child_process";
import { test } from "node:test";

const preload = new URL("../dist/debug-terminal.js", import.meta.url).href;
const program = 'console.log("hi")';
const clear = "\x1b[H\x1b[2J\x1b[3J";

test("writes nothing when the output is not a terminal", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", preload, "-e", program],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "hi\n");
});

test(
  "clears the terminal before the program",
  { skip: process.platform !== "linux" && "needs script of util-linux" },
  () => {
    // script runs the command in a pseudo terminal.
    const result = spawnSync(
      "script",
      [
        "--quiet",
        "--return",
        "--command",
        `"${process.execPath}" --import "${preload}" -e '${program}'`,
        "/dev/null",
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.ok(
      result.stdout.startsWith(`${clear}hi`),
      JSON.stringify(result.stdout),
    );
  },
);

/**
 * Runs the program with an inspector that waits for a debugger, connects a
 * debugger and keeps it connected for up to 2 seconds. Returns the error
 * output and whether Node.js ended while the debugger was connected.
 */
async function runWithDebugger(
  args: string[],
): Promise<{ stderr: string; endedByItself: boolean }> {
  const child = spawn(
    process.execPath,
    ["--inspect-wait=127.0.0.1:0", ...args, "-e", program],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const closed = new Promise<void>((resolve) => child.on("close", resolve));
  let stderr = "";
  child.stderr.setEncoding("utf8");
  const url = await new Promise<string>((resolve) => {
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      const match = /ws:\/\/\S+/.exec(stderr);
      if (match !== null) {
        resolve(match[0]);
      }
    });
  });

  const socket = new WebSocket(url);
  await new Promise((resolve) => socket.addEventListener("open", resolve));
  socket.send(
    JSON.stringify({ id: 1, method: "Runtime.runIfWaitingForDebugger" }),
  );
  const endedByItself = await Promise.race([
    closed.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(resolve, 2000, false)),
  ]);
  socket.close();
  await closed;
  return { stderr, endedByItself };
}

test("without debug-terminal, Node.js waits for the debugger", async () => {
  const { stderr, endedByItself } = await runWithDebugger([]);
  assert.match(stderr, /Waiting for the debugger to disconnect/);
  assert.equal(endedByItself, false);
});

test("ends without waiting for the debugger", async () => {
  const { stderr, endedByItself } = await runWithDebugger([
    "--import",
    preload,
  ]);
  assert.doesNotMatch(stderr, /Waiting for the debugger to disconnect/);
  assert.equal(endedByItself, true);
});
