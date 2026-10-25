#!/usr/bin/env node
// The command ts of the courses: checks the types, then runs the program with
// Node.js.
//   ts [file] [arguments]   checks the file and the files it imports with tsc,
//                           then runs it with Node.js (with the arguments)
//   ts --check [file]       only checks
// Without a file, ts uses main.ts in the current folder. The check uses the
// options of the course tsconfig.json – the same check that VS Code runs while
// you type. The course is the nearest folder with a package.json and a
// tsconfig.json, from the folder of the file upwards. npm scripts can call ts
// too: "start": "ts", "check": "ts --check".
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const usage = `Usage: ts [file] [arguments]   check the file, then run it
       ts --check [file]       only check the file
Without a file, ts uses main.ts in the current folder.`;

/** The nearest folder with a package.json and a tsconfig.json, from `start` upwards. */
function course(start: string): string | undefined {
  for (let current = start; ; current = dirname(current)) {
    if (
      existsSync(join(current, "package.json")) &&
      existsSync(join(current, "tsconfig.json"))
    ) {
      return current;
    }
    if (dirname(current) === current) {
      return undefined;
    }
  }
}

const args = process.argv.slice(2);
const checkOnly = args[0] === "--check";
if (checkOnly) {
  args.shift();
}
if (args[0] === "--help" || args[0] === "-h") {
  console.log(usage);
  process.exit(0);
}
if (args[0]?.startsWith("-")) {
  console.error(`ts: unknown option ${args[0]}\n${usage}`);
  process.exit(2);
}

// npm runs scripts in the course folder and sets INIT_CWD to the folder where
// npm start was typed.
const folder = process.env.INIT_CWD ?? process.cwd();
const file = resolve(folder, args[0] ?? "main.ts");
const root = course(dirname(file));
if (root === undefined) {
  console.error(
    `ts: ${file} is not in a course folder (package.json and tsconfig.json).`,
  );
  process.exit(1);
}

// TypeScript is a devDependency of the course: missing until npm ci has run
// once in the course folder.
const tsc = join(root, "node_modules", ".bin", "tsc");
if (!existsSync(tsc)) {
  console.error("TypeScript is missing. Run npm ci in the course folder.");
  process.exit(1);
}

// A tsconfig.json for this one file: it takes every option of the course
// tsconfig.json and only replaces the list of files.
const config = join(
  root,
  "node_modules",
  ".cache",
  "ts",
  `tsconfig.${process.pid}.json`,
);
mkdirSync(dirname(config), { recursive: true });
writeFileSync(
  config,
  JSON.stringify({
    extends: join(root, "tsconfig.json"),
    files: [file],
    include: [],
  }),
);

const check = spawnSync(tsc, ["--project", config], {
  cwd: folder,
  stdio: "inherit",
});
rmSync(config);
if (check.status !== 0 || checkOnly) {
  process.exit(check.status ?? 1);
}

const register = new URL("register.js", import.meta.url).href;
const run = spawnSync(
  process.execPath,
  ["--import", register, file, ...args.slice(1)],
  { cwd: folder, stdio: "inherit" },
);
process.exit(run.status ?? 1);
