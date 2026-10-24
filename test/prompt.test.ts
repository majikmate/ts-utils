// Tests prompt() of dist/ (the code that courses install) with piped input.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const fixture = new URL("./fixtures/ask.ts", import.meta.url).pathname;

/** Runs the fixture with `input` on the standard input and returns its output. */
function ask(input: string, ...questions: string[]): string {
  const result = spawnSync(process.execPath, [fixture, ...questions], {
    input,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test("returns the line without the line break and shows it", () => {
  assert.equal(ask("Mia\n", "Name?"), 'Name? Mia\n"Mia"\n');
});

test("reads one line per call", () => {
  assert.equal(
    ask("Mia\n15\n", "Name?", "Age?"),
    'Name? Mia\n"Mia"\nAge? 15\n"15"\n',
  );
});

test("returns null at the end of the input", () => {
  assert.equal(ask("Mia\n", "Name?", "Age?"), 'Name? Mia\n"Mia"\nAge? null\n');
});

test("returns the last line without a line break", () => {
  assert.equal(ask("Mia", "Name?", "Age?"), 'Name? Mia\n"Mia"\nAge? null\n');
});

test("returns the default value for an empty line", () => {
  assert.equal(ask("\n", "Name?=Guest"), 'Name? [Guest] \n"Guest"\n');
});

test("returns an empty string for an empty line without a default value", () => {
  assert.equal(ask("\n", "Name?"), 'Name? \n""\n');
});

test("shows Prompt when there is no message", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      'import { prompt } from "./dist/index.js"; prompt();',
    ],
    { input: "x\n", encoding: "utf8", cwd: new URL("..", import.meta.url) },
  );
  assert.equal(result.stdout, "Prompt x\n");
});

test("removes the carriage return of Windows line ends", () => {
  assert.equal(ask("Mia\r\n", "Name?"), 'Name? Mia\n"Mia"\n');
});

test("decodes UTF-8 characters", () => {
  assert.equal(ask("Jürgen 🎲\n", "Name?"), 'Name? Jürgen 🎲\n"Jürgen 🎲"\n');
});
