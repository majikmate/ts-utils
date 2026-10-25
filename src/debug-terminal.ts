// Keeps the terminal clean when a course program runs with F5. The
// .vscode/launch.json of a course loads this file before tsx and the program:
//   "runtimeArgs": ["--import", "@majikmate/ts-utils/debug-terminal", "--import", "tsx"]
// It clears the command line that VS Code types into the terminal and the
// message "Debugger attached.". When the program ends, it closes the connection
// to the debugger, so Node.js does not print "Waiting for the debugger to
// disconnect...". npm start does not load this file.
import inspector from "node:inspector";

if (process.stdout.isTTY) {
  // The same as the command clear: cursor home, clear the screen and the
  // scrollback.
  process.stdout.write("\x1b[H\x1b[2J\x1b[3J");
}

process.on("exit", () => {
  if (inspector.url() !== undefined) {
    inspector.close();
  }
});
