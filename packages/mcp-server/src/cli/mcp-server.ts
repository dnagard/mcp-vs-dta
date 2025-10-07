#!/usr/bin/env node
import { startServer } from "../server.js";

async function main() {
  const handle = await startServer();
  const shutdown = async (signal: NodeJS.Signals | "exit") => {
    process.stderr.write(`shutting down (${signal})\n`);
    await handle.close().catch((err) => {
      process.stderr.write(
        `error closing server: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    });
  };

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  let exiting = false;
  const wrap = (signal: NodeJS.Signals) => async () => {
    if (exiting) return;
    exiting = true;
    await shutdown(signal);
    process.exit(0);
  };
  signals.forEach((sig) => process.on(sig, wrap(sig)));

  process.stderr.write("ready\n");
  await handle.waitUntilClosed();
  if (!exiting) {
    exiting = true;
    await shutdown("exit");
  }
}

main().catch((err) => {
  const message =
    err instanceof Error ? (err.stack ?? err.message) : String(err);
  process.stderr.write(message + "\n");
  process.exit(1);
});
