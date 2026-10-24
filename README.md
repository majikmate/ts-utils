# ts-utils

Small helpers for the majikmate TypeScript courses. Today the package has one
function: `prompt()`, which asks a question in the terminal and returns the
answer.

```typescript
import { prompt } from "@majikmate/ts-utils";

const name = prompt("What is your name?");
console.log(`Hello ${name}!`);
```

```
What is your name? Mia
Hello Mia!
```

## Install

The package is not on the npm registry: npm installs it straight from this
repository, at a release tag. In the `package.json` of a course:

```json
"dependencies": {
  "@majikmate/ts-utils": "github:majikmate/ts-utils#v1.0.0"
}
```

`package-lock.json` then pins the commit of the tag. `npm ci` needs `git` and
access to github.com.

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
npm test        # tests dist/ with piped input
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
