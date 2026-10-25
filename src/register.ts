// Runs TypeScript files with Node.js and full TypeScript (also enums and
// parameter properties, which Node.js alone does not run):
//   node --import @majikmate/ts-utils/register main.ts
// Before Node.js runs a .ts file, this hook compiles it to JavaScript with the
// TypeScript of the course – the same compiler that checks the code (ts,
// VS Code). It only translates and never checks: ts checks before it runs.
import { createRequire, registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import type * as TypeScript from "typescript";

const ts = typescript();

/**
 * The TypeScript of the course of the program (process.argv[1]), so a global
 * ts uses the same version as the check; else the one next to this package.
 */
function typescript(): typeof TypeScript {
  for (const from of [process.argv[1], fileURLToPath(import.meta.url)]) {
    try {
      if (from !== undefined) {
        return createRequire(from)("typescript");
      }
    } catch {
      // not found from there
    }
  }
  console.error("TypeScript is missing. Run npm ci in the course folder.");
  process.exit(1);
}

// Error messages show the lines of the .ts file, not of the compiled
// JavaScript (each file gets an inline source map, which the debugger reads too).
process.setSourceMapsEnabled(true);

registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    // Node.js reads .ts, .mts and .cts files with these formats.
    const esm = loaded.format === "module-typescript";
    if ((!esm && loaded.format !== "commonjs-typescript") || !loaded.source) {
      return loaded;
    }
    const source =
      typeof loaded.source === "string"
        ? loaded.source
        : new TextDecoder().decode(loaded.source);
    const output = ts.transpileModule(source, {
      fileName: fileURLToPath(url),
      compilerOptions: {
        module: esm ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ESNext,
        // Imports stay as written, as the course tsconfig.json requires.
        verbatimModuleSyntax: esm,
        inlineSourceMap: true,
        inlineSources: true,
      },
    });
    return {
      format: esm ? "module" : "commonjs",
      source: output.outputText,
      shortCircuit: true,
    };
  },
});
