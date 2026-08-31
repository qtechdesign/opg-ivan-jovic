#!/usr/bin/env node
/**
 * Seed D1 from seed/seed.sql via wrangler --command
 * (wrangler --file currently throws a FileHandle GC error on exit)
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const remote = process.argv.includes("--remote");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = join(root, "seed", "seed.sql");
const raw = readFileSync(sqlPath, "utf8");

const statements = raw
  .split(";")
  .map((chunk) =>
    chunk
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim()
  )
  .filter(Boolean);

for (const statement of statements) {
  const args = [
    "wrangler",
    "d1",
    "execute",
    "polje",
    remote ? "--remote" : "--local",
    "--command",
    statement,
  ];
  const result = spawnSync("npx", args, {
    cwd: root,
    stdio: "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Seed applied (${remote ? "remote" : "local"}).`);
