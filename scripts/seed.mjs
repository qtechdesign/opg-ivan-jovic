#!/usr/bin/env node
/**
 * Seed D1 from seed/*.sql via wrangler --command
 * (wrangler --file currently throws a FileHandle GC error on exit)
 *
 * Local default: ivan-jovic + demo-opg
 * Remote default: ivan-jovic only (demo-opg is refused)
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const remote = process.argv.includes("--remote");
const farmArg = process.argv.find((a) => a.startsWith("--farm="));
const farmFlag = farmArg ? farmArg.slice("--farm=".length) : remote ? "ivan-jovic" : "all";

const FILES = {
  "ivan-jovic": "opg-ivan-jovic.sql",
  "demo-opg": "demo-opg.sql",
};

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function resolveFarms(flag) {
  if (flag === "all") return ["ivan-jovic", "demo-opg"];
  if (flag in FILES) return [flag];
  console.error(`Unknown --farm=${flag}. Use ivan-jovic, demo-opg, or all.`);
  process.exit(1);
}

const farms = resolveFarms(farmFlag);

if (remote && farms.includes("demo-opg")) {
  console.error(
    "Refuse: demo-opg is local/CI only. seed:remote applies ivan-jovic only."
  );
  process.exit(1);
}

function statementsFrom(sqlPath) {
  const raw = readFileSync(sqlPath, "utf8");
  return raw
    .split(";")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter(Boolean);
}

for (const slug of farms) {
  const sqlPath = join(root, "seed", FILES[slug]);
  const statements = statementsFrom(sqlPath);
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
  console.log(`Seed applied: ${slug} (${remote ? "remote" : "local"}).`);
}
