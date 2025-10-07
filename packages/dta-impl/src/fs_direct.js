import { promises as fs } from "node:fs";
export async function writeFileDirect(path, data) {
  await fs.writeFile(path, data);
}
export async function readFileDirect(path) {
  return fs.readFile(path);
}
export async function rmFileDirect(path) {
  await fs.rm(path, { force: true });
}
