#!/usr/bin/env node
/**
 * Launcher shim so that the read-only supervisor command
 *   `yarn expo start --port 3000`
 * effectively boots the Vite dev server.
 *
 * Yarn v1 concatenates extra CLI args after the script command, so the process
 * receives argv like: ["start", "--port", "3000"]. We simply ignore them and
 * spawn Vite with the settings from vite.config.ts.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const viteBin = resolve(root, "node_modules", "vite", "bin", "vite.js");

const child = spawn(process.execPath, [viteBin, "--host", "0.0.0.0", "--port", "3000"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));

for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(sig, () => child.kill(sig));
}
