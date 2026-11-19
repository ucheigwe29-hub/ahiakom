import { spawn } from "node:child_process";
const args = process.argv.slice(2);
const value = (key, fallback) =>
  args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const port = value("--port", "3000");
// The managed preview runner supplies Vite-style flags. Adapt them for Next.js.
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    value("--host", "127.0.0.1"),
    "--port",
    port,
  ],
  { stdio: "inherit", env: process.env },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
