import { httpGetBlob } from "@proj/dta-impl";
import { Bench } from "tinybench";
import type { BenchMcpClient } from "../mcp_client.js";

type Impl = "dta" | "mcp";

type HttpSweepOptions = {
  sizes?: number[];
  client?: BenchMcpClient;
};

const DEFAULT_SIZES = [1024, 32_768, 262_144];

export async function httpSweep(impl: Impl, options: HttpSweepOptions = {}) {
  const sizes = options.sizes ?? DEFAULT_SIZES;
  const client = options.client;
  if (impl === "mcp" && !client) throw new Error("MCP client required for mcp implementation");

  const base = "http://localhost:8080/blob?size=";
  const bench = new Bench({ time: 200 });

  for (const size of sizes) {
    const name = `${impl}-http-${(size / 1024) | 0}KB`;
    const url = base + size;

    bench.add(name, async () => {
      if (impl === "dta") {
        await httpGetBlob(url);
      } else {
        await client!.callTool("http_get_blob", { url });
      }
    });
  }

  await bench.run();
  return bench.table();
}
