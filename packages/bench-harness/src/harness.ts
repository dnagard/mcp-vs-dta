import { httpSweep } from "./scenarios/http_sweep";
import { fsSweep } from "./scenarios/fs_sweep";

async function main() {
  console.log("=== HTTP (DTA) ===");
  console.table(await httpSweep("dta"));
  console.log("=== HTTP (MCP stub) ===");
  console.table(await httpSweep("mcp"));

  console.log("=== FS (DTA) ===");
  console.table(await fsSweep("dta"));
  console.log("=== FS (MCP stub) ===");
  console.table(await fsSweep("mcp"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
