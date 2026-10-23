import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const vite = resolve(root, "node_modules/vite/bin/vite.js");
const children = [
  spawn(npm, ["run", "dev:api"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" }),
  spawn(process.execPath, [vite, "--host", "0.0.0.0"], { cwd: root, stdio: "inherit" }),
];

let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
for (const child of children) {
  child.on("error", (error) => {
    console.error("[dev] failed to start a development service:", error);
    stop();
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      stop();
    }
  });
}
