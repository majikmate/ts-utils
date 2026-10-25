# ts-utils

Small helpers for the majikmate TypeScript courses:

- [`ts`](#ts), the command that checks a TypeScript file, compiles it and runs it
  with Node.js: `ts main.ts`.
- [`prompt()`](#prompt), which asks a question in the terminal and returns the
  answer.
- [`register` and `debug-terminal`](#f5-in-vs-code), which F5 in VS Code loads.

```typescript
import { prompt } from "@majikmate/ts-utils";

const name = prompt("What is your name?");
console.log(`Hello ${name}!`);
```

```
$ ts main.ts
What is your name? Mia
Hello Mia!
```

## Install

The package is not on the npm registry: npm installs it straight from this
repository, at a release tag. In the `package.json` of a course:

```json
"dependencies": {
  "@majikmate/ts-utils": "github:majikmate/ts-utils#v1.1.0"
}
```

`package-lock.json` then pins the commit of the tag. `npm ci` needs `git` and
access to github.com.

The course also needs TypeScript (a peer dependency) and the scripts of
[`ts`](#ts):

```json
"scripts": {
  "start": "ts",
  "check": "ts --check"
},
"devDependencies": {
  "typescript": "6.0.3"
}
```

To type `ts` in the terminal, its folder must be on the `PATH`:

- In a Devspace, the `devcontainer.json` of the course adds the course's
  `node_modules/.bin`:
  `"remoteEnv": { "PATH": "${containerWorkspaceFolder}/node_modules/.bin:${containerEnv:PATH}" }`.
- On a computer without a Devspace, install `ts` once globally:
  `npm install --global github:majikmate/ts-utils#v1.1.0`. A global `ts` still
  uses the TypeScript and the `tsconfig.json` of the course.

`npm start` and `npm run check` work without the `PATH`.

## ts

```
ts [file] [arguments]   check the file, then run it
ts --check [file]       only check the file
```

`ts main.ts` does three steps:

1. **Check**: `tsc` checks the file and the files it imports, with the options
   of the course `tsconfig.json` (the same check that VS Code runs while you
   type). With an error, the program does not start.
2. **Compile**: the TypeScript of the course compiles each file to JavaScript in
   memory, also enums and parameter properties (Node.js alone only strips
   types). No `.js` files are written.
3. **Run**: Node.js runs the program, with the arguments after the file.

Without a file, `ts` uses `main.ts` in the current folder. The course is the
nearest folder with a `package.json` and a `tsconfig.json`, from the folder of
the file upwards; outside a course, `ts` stops with a message. Through npm,
`ts` works in the folder where `npm start` was typed (`INIT_CWD`).

## F5 in VS Code

The `.vscode/launch.json` of a course loads two modules of this package before
the program:

```json
"runtimeArgs": [
  "--import",
  "@majikmate/ts-utils/debug-terminal",
  "--import",
  "@majikmate/ts-utils/register"
],
"console": "integratedTerminal"
```

- `register` compiles each `.ts` file with the TypeScript of the course (a
  [module customization hook](https://nodejs.org/api/module.html#customization-hooks)
  of Node.js), with source maps, so breakpoints and error messages show the
  lines of the `.ts` file. `ts` runs programs with the same hook.
- `debug-terminal` keeps the terminal clean: it clears the command line that
  VS Code types into the terminal and the message `Debugger attached.`, and at
  the end it closes the connection to the debugger, so Node.js does not print
  `Waiting for the debugger to disconnect...`.

## prompt()

```typescript
function prompt(message?: string, defaultValue?: string): string | null;
```

`prompt()` behaves like `prompt()` in a browser and in Deno, for programs that
run in the terminal with Node.js:

- It writes `message` and a space (`Prompt ` without a message) and waits for
  one line.
- It returns the line without the line break (`\n` or `\r\n`).
- With `defaultValue`, it writes `message [defaultValue] ` and returns
  `defaultValue` for an empty line.
- It returns `null` when the input ends (`Ctrl+D` in the terminal, or the end of
  a file or a pipe).
- Input from a file or a pipe does not appear on the screen by itself, so
  `prompt()` writes it after the question, as a terminal would. A run with
  `printf 'Mia\n' | npm start` therefore shows the same text as a run where you
  type `Mia`.

`prompt()` reads synchronously with `readSync` from `node:fs`. The program waits
until the line is complete; no `await` is needed.

## Development

```
npm ci
npm run build   # src/ → dist/ (JavaScript and type declarations)
npm test        # tests dist/: prompt() with piped input, ts and the hooks in temporary courses
```

`dist/` is committed: npm installs a package from GitHub without a build step.
Build after every change of `src/` and commit both. The CI workflow fails when
`dist/` does not match `src/`.

## Release

1. Raise `version` in `package.json` and merge the pull request.
2. Create the release `vX.Y.Z` on `main`.
3. In each course, change the tag in `package.json`, run `npm install` and
   commit `package.json` and `package-lock.json` together.

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) · [MIT License](LICENSE).
