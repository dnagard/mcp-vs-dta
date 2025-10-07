import { promises as fs } from "node:fs";
import { resolve, sep } from "node:path";

export class SandboxPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxPathError";
  }
}

export function getSandboxRoot(): string {
  const rootEnv = process.env.MCP_SANDBOX_ROOT;
  const base =
    rootEnv && rootEnv.trim().length > 0
      ? rootEnv
      : resolve(process.cwd(), "sandbox");
  return resolve(base);
}

export async function ensureSandboxRoot(root = getSandboxRoot()) {
  await fs.mkdir(root, { recursive: true });
  return root;
}

export function resolveSandbox(root: string, relativePath: string): string {
  const absRoot = resolve(root);
  const abs = resolve(absRoot, relativePath);
  const normalizedRoot = absRoot.endsWith(sep) ? absRoot : absRoot + sep;
  if (abs !== absRoot && !abs.startsWith(normalizedRoot)) {
    throw new SandboxPathError(`Path escapes sandbox: ${relativePath}`);
  }
  return abs;
}
