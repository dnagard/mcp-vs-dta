import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const scriptsDir = resolve(repoRoot, "scripts");

async function ensureExecutable(path: string) {
  try {
    await access(path, constants.X_OK);
  } catch {
    throw new Error(`Required script not found or not executable: ${path}`);
  }
}

async function runScript(scriptName: string, args: string[] = []) {
  const scriptPath = resolve(scriptsDir, scriptName);
  await ensureExecutable(scriptPath);

  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn("bash", [scriptPath, ...args], { stdio: "inherit" });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${scriptName} exited with code ${code}`));
        return;
      }
      resolvePromise();
    });
  });
}

export interface BenchProfile {
  name: string;
  description: string;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export const PROFILES: Record<string, BenchProfile> = {
  default: {
    name: "default",
    description: "No network shaping applied",
  },

  // latency only
  delay40: {
    name: "delay40",
    description: "40ms ±10ms, no loss",
    setup: () => runScript("setup-netem.sh", ["lo", "40ms", "10ms", "0%"]),
    teardown: () => runScript("clear-netem.sh", ["lo"]),
  },

  // loss only
  loss1: {
    name: "loss1",
    description: "1% loss, no added delay",
    setup: () => runScript("setup-netem.sh", ["lo", "0ms", "0ms", "1%"]),
    teardown: () => runScript("clear-netem.sh", ["lo"]),
  },

  // mixed (your existing netem40)
  netem40: {
    name: "netem40",
    description: "40ms ±10ms with 1% loss",
    setup: () => runScript("setup-netem.sh", ["lo", "40ms", "10ms", "1%"]),
    teardown: () => runScript("clear-netem.sh", ["lo"]),
  },

  // bursty loss (correlation)
  bursty: {
    name: "bursty",
    description: "10ms ±2ms, 1% loss with 25% correlation (bursty)",
    setup: () => runScript("setup-netem.sh", ["lo", "10ms", "2ms", "1%", "25%"]),
    teardown: () => runScript("clear-netem.sh", ["lo"]),
  },

  // slow link (rate limit)
  slowlink: {
    name: "slowlink",
    description: "60ms ±20ms, 0% loss, 10mbit rate",
    setup: () => runScript("setup-netem.sh", ["lo", "60ms", "20ms", "0%", "0%", "10mbit"]),
    teardown: () => runScript("clear-netem.sh", ["lo"]),
  },
};

export async function withProfile<T>(
  profileName: string,
  runner: () => Promise<T>,
): Promise<T> {
  const profile = PROFILES[profileName];
  if (!profile) {
    throw new Error(`Unknown profile: ${profileName}`);
  }

  if (profile.setup) {
    try {
      await profile.setup();
    } catch (err) {
      console.warn(
        `[bench-harness] Failed to apply profile '${profileName}': ${(err as Error).message}`,
      );
      throw err;
    }
  }

  let result: T;
  try {
    result = await runner();
  } finally {
    if (profile.teardown) {
      try {
        await profile.teardown();
      } catch (err) {
        console.warn(
          `[bench-harness] Failed to clear profile '${profileName}': ${(err as Error).message}`,
        );
      }
    }
  }

  return result;
}
