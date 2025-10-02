import { randomBytes } from "node:crypto";
import { writeFileDirect, readFileDirect, rmFileDirect } from "@proj/dta-impl";
import { mcpFs } from "@proj/mcp-impl";
import { Bench } from "tinybench";

type Impl = "dta" | "mcp";

export async function fsSweep(impl: Impl, sizes = [4_096, 65_536, 1_048_576]) {
  const bench = new Bench({ time: 200 });

  for (const size of sizes) {
    const payload = randomBytes(size);
    const path = `./tmp-${impl}-${size}.bin`;

    bench.add(`${impl}-fs-write-${(size/1024)|0}KB`, async () => {
      if (impl === "dta") await writeFileDirect(path, payload);
      else await mcpFs.writeFile(path, payload);
    });

    bench.add(`${impl}-fs-read-${(size/1024)|0}KB`, async () => {
      if (impl === "dta") await readFileDirect(path);
      else await mcpFs.readFile(path);
    });

    bench.add(`${impl}-fs-rm-${(size/1024)|0}KB`, async () => {
      if (impl === "dta") await rmFileDirect(path);
      else await mcpFs.rmFile(path);
    });
  }

  await bench.run();
  return bench.table();
}
