import { randomBytes } from "node:crypto";
import { writeFileDirect, readFileDirect, rmFileDirect } from "@proj/dta-impl";
import { Bench } from "tinybench";
import type { BenchMcpClient } from "../mcp_client.js";

type Impl = "dta" | "mcp";

type FsSweepOptions = {
  sizes?: number[];
  client?: BenchMcpClient;
};

const DEFAULT_SIZES = [4_096, 65_536, 1_048_576];

export async function fsSweep(impl: Impl, options: FsSweepOptions = {}) {
  const sizes = options.sizes ?? DEFAULT_SIZES;
  const client = options.client;
  if (impl === "mcp" && !client) throw new Error("MCP client required for mcp implementation");

  const bench = new Bench({ time: 200 });

  for (const size of sizes) {
    const payload = randomBytes(size).toString("base64");
    const path = `./tmp-${impl}-${size}.txt`;

    bench.add(`${impl}-fs-write-${(size / 1024) | 0}KB`, async () => {
      if (impl === "dta") {
        await writeFileDirect(path, payload);
      } else {
        await client!.callTool("write_file", { path, data: payload });
      }
    });

    bench.add(`${impl}-fs-read-${(size / 1024) | 0}KB`, async () => {
      if (impl === "dta") {
        await readFileDirect(path);
      } else {
        await client!.callTool("read_file", { path });
      }
    });

    bench.add(`${impl}-fs-rm-${(size / 1024) | 0}KB`, async () => {
      if (impl === "dta") {
        await rmFileDirect(path);
      } else {
        await client!.callTool("remove_file", { path });
      }
    });
  }

  await bench.run();
  return bench.table();
}
