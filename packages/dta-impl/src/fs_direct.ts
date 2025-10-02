import { promises as fs } from "node:fs";

export async function writeFileDirect(path: string, data: Buffer | string) {
  await fs.writeFile(path, data);
}

export async function readFileDirect(path: string): Promise<Buffer> {
  return fs.readFile(path);
}

export async function rmFileDirect(path: string) {
  await fs.rm(path, { force: true });
}
