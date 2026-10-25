// Tests the command ts and the hook register of dist/ (the code that courses
// install) in small courses in a temporary folder: ts typed in the terminal
// (installed in the course or globally), called by npm start and npm run
// check, and the hook loaded by F5.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { after, test } from "node:test";

const dist = new URL("../dist", import.meta.url).pathname;
const modules = new URL("../node_modules", import.meta.url).pathname;
const folders: string[] = [];

after(() => {
  for (const folder of folders) {
    rmSync(folder, { recursive: true, force: true });
  }
});

function temporary(name: string): string {
  const folder = mkdtempSync(join(tmpdir(), `ts-utils-${name}-`));
  folders.push(folder);
  return folder;
}

/** Copies this package (package.json and dist/) to `modules`/@majikmate/ts-utils and links ts into `bin`. */
function install(modules: string, bin: string): void {
  const target = join(modules, "@majikmate", "ts-utils");
  mkdirSync(join(target, "dist"), { recursive: true });
  copyFileSync(join(dist, "..", "package.json"), join(target, "package.json"));
  for (const name of readdirSync(dist)) {
    copyFileSync(join(dist, name), join(target, "dist", name));
  }
  chmodSync(join(target, "dist", "ts.js"), 0o755);
  mkdirSync(bin, { recursive: true });
  symlinkSync(join(target, "dist", "ts.js"), join(bin, "ts"));
}

interface Course {
  /** TypeScript in node_modules (false: npm ci has not run). */
  typescript?: boolean;
  /** This package in node_modules (false: only installed globally). */
  utils?: boolean;
}

/** Creates a course with the settings of the majikmate courses and `files`. */
function course(
  files: Record<string, string>,
  { typescript = true, utils = true }: Course = {},
): string {
  const root = temporary("course");
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "course",
      private: true,
      type: "module",
      scripts: { start: "ts", check: "ts --check" },
    }),
  );
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        module: "nodenext",
        lib: ["es2024"],
        types: ["node"],
        noEmit: true,
        allowImportingTsExtensions: true,
        verbatimModuleSyntax: true,
      },
    }),
  );
  const nodeModules = join(root, "node_modules");
  mkdirSync(join(nodeModules, ".bin"), { recursive: true });
  if (utils) {
    install(nodeModules, join(nodeModules, ".bin"));
  }
  if (typescript) {
    for (const name of ["@types", "typescript"]) {
      symlinkSync(join(modules, name), join(nodeModules, name));
    }
    symlinkSync(join(modules, ".bin", "tsc"), join(nodeModules, ".bin", "tsc"));
  }
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

/** Runs `command <args>` in a terminal in `folder` with `bin` first on the PATH (no npm variables). */
function type(
  folder: string,
  bin: string,
  command: string,
  args: string[] = [],
  input = "",
) {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name === "INIT_CWD" || name.startsWith("npm_")) {
      delete env[name];
    }
  }
  env.PATH = [bin, dirname(process.execPath), process.env.PATH].join(delimiter);
  return spawnSync(command, args, {
    cwd: folder,
    env,
    input,
    encoding: "utf8",
  });
}

/** Types `ts <args>` in `folder` of the course, with node_modules/.bin on the PATH (remoteEnv of the Devspace). */
function ts(root: string, folder: string, ...args: string[]) {
  return type(
    join(root, folder),
    join(root, "node_modules", ".bin"),
    "ts",
    args,
  );
}

const correct = 'const lives: number = 3;\nconsole.log("lives", lives);\n';
const wrong = 'const lives: number = "three";\nconsole.log("lives", lives);\n';
const fullTypeScript = `enum Direction {
  Up,
  Down,
}

class Player {
  constructor(private readonly name: string) {}

  getName(): string {
    return this.name;
  }
}

console.log(new Player("Mia").getName(), Direction[1]);
`;

test("ts checks main.ts and then runs it with Node.js", () => {
  const root = course({ "a/b/main.ts": correct });
  const result = ts(root, "a/b");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, "lives 3\n");
  assert.deepEqual(readdirSync(join(root, "node_modules/.cache/ts")), []);
});

test("ts runs full TypeScript: enums and parameter properties", () => {
  const root = course({ "a/main.ts": fullTypeScript });
  const result = ts(root, "a");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, "Mia Down\n");
});

test("ts checks and runs the given file and the files it imports, with the arguments", () => {
  const root = course({
    "a/hello.ts":
      'import { greet } from "./greet.ts";\nconsole.log(greet(process.argv[2] ?? "you"));\n',
    "a/greet.ts":
      "export function greet(name: string): string {\n  return `Hello ${name}!`;\n}\n",
  });
  const result = ts(root, "a", "hello.ts", "Mia");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, "Hello Mia!\n");
});

test("prompt() reads the input of a program that ts runs", () => {
  const root = course({
    "a/main.ts":
      'import { prompt } from "@majikmate/ts-utils";\nconst name = prompt("Name?");\nconsole.log(`Hello ${name}!`);\n',
  });
  const result = type(
    join(root, "a"),
    join(root, "node_modules", ".bin"),
    "ts",
    [],
    "Mia\n",
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, "Name? Mia\nHello Mia!\n");
});

test("an error shows the line of the .ts file", () => {
  const root = course({
    "a/main.ts": `${fullTypeScript}\nfunction fail(): never {\n  throw new Error("boom");\n}\nfail();\n`,
  });
  const result = ts(root, "a");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /main\.ts:17:9\)/);
});

test("ts --check checks main.ts and does not run it", () => {
  const root = course({ "a/main.ts": correct });
  const result = ts(root, "a", "--check");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, "");
});

test("ts reports a type error with the options of tsconfig.json and does not run the file", () => {
  const root = course({ "a/main.ts": wrong });
  const result = ts(root, "a");
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /main\.ts\(1,7\): error TS2322/);
  assert.doesNotMatch(result.stdout, /lives three/);
});

test("npm start and npm run check call ts in the folder where npm runs", () => {
  const root = course({ "a/main.ts": correct, "a/hello.ts": wrong });
  const bin = join(root, "node_modules", ".bin");
  const start = type(join(root, "a"), bin, "npm", ["run", "--silent", "start"]);
  assert.equal(start.status, 0, start.stdout + start.stderr);
  assert.equal(start.stdout, "lives 3\n");
  const check = type(join(root, "a"), bin, "npm", [
    "run",
    "--silent",
    "check",
    "hello.ts",
  ]);
  assert.notEqual(check.status, 0);
  assert.match(check.stdout, /hello\.ts\(1,7\): error TS2322/);
});

test("a global ts uses the course and the TypeScript of the course", () => {
  const prefix = temporary("global");
  install(join(prefix, "lib", "node_modules"), join(prefix, "bin"));
  const root = course({ "a/main.ts": fullTypeScript }, { utils: false });
  const result = type(join(root, "a"), join(prefix, "bin"), "ts");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, "Mia Down\n");
});

test("F5: node with the hooks register and debug-terminal runs full TypeScript", () => {
  const root = course({ "a/main.ts": fullTypeScript });
  const result = type(
    join(root, "a"),
    join(root, "node_modules", ".bin"),
    "node",
    [
      "--import",
      "@majikmate/ts-utils/debug-terminal",
      "--import",
      "@majikmate/ts-utils/register",
      "main.ts",
    ],
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, "Mia Down\n");
});

test("ts asks for npm ci when TypeScript is missing", () => {
  const root = course({ "a/main.ts": correct }, { typescript: false });
  const result = ts(root, "a");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Run npm ci in the course folder\./);
});

test("ts needs a course folder", () => {
  const prefix = temporary("global");
  install(join(prefix, "lib", "node_modules"), join(prefix, "bin"));
  const folder = temporary("folder");
  writeFileSync(join(folder, "main.ts"), correct);
  const result = type(folder, join(prefix, "bin"), "ts");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /is not in a course folder/);
});

test("ts --help shows the usage, an unknown option fails", () => {
  const root = course({ "a/main.ts": correct });
  const help = ts(root, "a", "--help");
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: ts \[file\]/);
  const unknown = ts(root, "a", "--run");
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /unknown option --run/);
});
