/**
 * Copy repo docs/*.md into Starlight content.
 * Source of truth stays in /docs — copies are gitignored.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const destDir = path.resolve(here, "../src/content/docs");

const PAGES = [
  { src: "docs/API.md", dest: "api.md" },
  { src: "docs/MCP.md", dest: "mcp.md" },
  { src: "docs/FORK.md", dest: "fork.md" },
  { src: "docs/ROADMAP.md", dest: "roadmap.md" },
  { src: "docs/LOCAL-SERVERS.md", dest: "local-servers.md" },
  { src: "docs/IOT.md", dest: "iot.md" },
  { src: "docs/FPS.md", dest: "fps.md" },
  { src: "docs/HARDWARE.md", dest: "hardware.md" },
  { src: "docs/STARLINK.md", dest: "starlink.md" },
];

const SLUG = {
  FORK: "fork",
  ROADMAP: "roadmap",
  API: "api",
  MCP: "mcp",
  FPS: "fps",
  HARDWARE: "hardware",
  IOT: "iot",
  "LOCAL-SERVERS": "local-servers",
  STARLINK: "starlink",
};

const LINK_RE =
  /\]\((?:\.\.\/)?(?:docs\/)?(FORK|ROADMAP|API|MCP|FPS|HARDWARE|IOT|LOCAL-SERVERS|STARLINK)\.md\)/g;

function splitFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return { fm: "", body: raw };
  return { fm: match[0], body: raw.slice(match[0].length) };
}

function stripFirstH1(body) {
  return body.replace(/^\s*#\s+[^\n]+\n+/, "");
}

function rewriteDocLinks(body) {
  return body.replace(LINK_RE, (_full, name) => `](/${SLUG[name]}/)`);
}

await mkdir(destDir, { recursive: true });

for (const page of PAGES) {
  const raw = await readFile(path.join(repoRoot, page.src), "utf8");
  const { fm, body } = splitFrontmatter(raw);
  if (!fm) {
    throw new Error(`${page.src} is missing YAML frontmatter (title, description)`);
  }
  const out = `${fm}${rewriteDocLinks(stripFirstH1(body))}`;
  await writeFile(path.join(destDir, page.dest), out, "utf8");
}

console.log(`synced ${PAGES.length} pages → ${path.relative(repoRoot, destDir)}`);
