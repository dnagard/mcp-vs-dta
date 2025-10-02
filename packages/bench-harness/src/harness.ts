import { Bench } from "tinybench";

async function main() {
  const bench = new Bench({ time: 100 });
  bench
    .add("noop", () => {})
    .add("JSON stringify small", () => JSON.stringify({ a: 1, b: 2, c: 3 }));
  await bench.run();
  console.table(bench.table());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
