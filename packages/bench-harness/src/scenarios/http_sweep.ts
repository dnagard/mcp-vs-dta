import { httpGetBlob } from "@proj/dta-impl";
import { mcpHttp } from "@proj/mcp-impl";
import { Bench } from "tinybench";

type Impl = "dta" | "mcp";

export async function httpSweep(impl: Impl, sizes = [1024, 32_768, 262_144]) {
  const base = "http://localhost:8080/blob?size=";

  const bench = new Bench({ time: 200 });

  for (const size of sizes) {
    const name = `${impl}-http-${(size/1024)|0}KB`;

    bench.add(name, async () => {
      if (impl === "dta") {
        await httpGetBlob(base + size);
      } else {
        await mcpHttp.getBlob(base + size);
      }
    });
  }

  await bench.run();
  return bench.table();
}
