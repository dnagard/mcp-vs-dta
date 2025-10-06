import { httpSweep } from "./scenarios/http_sweep.js";
import { fsSweep } from "./scenarios/fs_sweep.js";
import { BenchMcpClient } from "./mcp_client.js";

async function main() {
  const mcp = new BenchMcpClient();
  try {
    // Ensure MCP server is responsive before benchmarking.
    await mcp.listTools();

    console.log("=== HTTP (DTA) ===");
    console.table(await httpSweep("dta"));

    console.log("=== HTTP (MCP) ===");
    console.table(await httpSweep("mcp", { client: mcp }));

    console.log("=== FS (DTA) ===");
    console.table(await fsSweep("dta"));

    console.log("=== FS (MCP) ===");
    console.table(await fsSweep("mcp", { client: mcp }));
  } finally {
    await mcp.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
