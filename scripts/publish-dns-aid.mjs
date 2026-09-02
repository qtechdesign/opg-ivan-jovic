#!/usr/bin/env node
/**
 * Publish DNS-AID ServiceMode HTTPS/SVCB records for opg-ivanjovic.hr
 * and print the DS that CARNet must publish for DNSSEC validation.
 *
 * Auth: CF_API_EMAIL + CF_API_KEY (or CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY).
 */
import { createHash } from "node:crypto";

const HOST = "opg-ivanjovic.hr";
const ZONE = "c00554272f230bd15e1ebc609c433dc3";
const email = process.env.CF_API_EMAIL || process.env.CLOUDFLARE_EMAIL;
const key = process.env.CF_API_KEY || process.env.CLOUDFLARE_API_KEY;

if (!email || !key) {
  console.error("Set CF_API_EMAIL and CF_API_KEY");
  process.exit(1);
}

const headers = {
  "X-Auth-Email": email,
  "X-Auth-Key": key,
  "Content-Type": "application/json",
};

async function cf(method, path, body) {
  const res = await fetch("https://api.cloudflare.com/client/v4" + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    const err = JSON.stringify(json.errors || json.messages || json);
    throw new Error(`${method} ${path} → ${res.status} ${err}`);
  }
  return json;
}

async function sha256b64url(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return createHash("sha256").update(buf).digest("base64url");
}

const catalog = `https://${HOST}/.well-known/ai-catalog.json`;
const mcpCard = `https://${HOST}/.well-known/mcp/server-card.json`;
const capIndex = await sha256b64url(catalog);
const capMcp = await sha256b64url(mcpCard);

const indexParams = [
  `alpn="h3,h2"`,
  `port="443"`,
  `mandatory="alpn,port"`,
  `key65400="${catalog}"`,
  `key65401="${capIndex}"`,
  `key65409="ai-catalog.json"`,
].join(" ");

const mcpParams = [
  `alpn="h3,h2"`,
  `port="443"`,
  `mandatory="alpn,port"`,
  `key65400="${mcpCard}"`,
  `key65401="${capMcp}"`,
  `key65402="mcp"`,
  `key65409="mcp/server-card.json"`,
].join(" ");

const desired = [
  {
    type: "HTTPS",
    name: "_index._agents",
    ttl: 3600,
    proxied: false,
    comment: "DNS-AID index (RFC 9460 ServiceMode)",
    data: { priority: 1, target: `${HOST}.`, value: indexParams },
  },
  {
    type: "SVCB",
    name: "_index._agents",
    ttl: 3600,
    proxied: false,
    comment: "DNS-AID index SVCB (RFC 9460 ServiceMode)",
    data: { priority: 1, target: `${HOST}.`, value: indexParams },
  },
  {
    type: "HTTPS",
    name: "_mcp._agents",
    ttl: 3600,
    proxied: false,
    comment: "DNS-AID MCP (RFC 9460 ServiceMode)",
    data: { priority: 1, target: `${HOST}.`, value: mcpParams },
  },
  {
    type: "SVCB",
    name: "_mcp._agents",
    ttl: 3600,
    proxied: false,
    comment: "DNS-AID MCP SVCB (RFC 9460 ServiceMode)",
    data: { priority: 1, target: `${HOST}.`, value: mcpParams },
  },
  {
    type: "TXT",
    name: "_catalog._agents",
    ttl: 3600,
    proxied: false,
    comment: "ARD catalog pointer",
    content: `url=${catalog}`,
  },
  {
    type: "TXT",
    name: "_index._agents",
    ttl: 3600,
    proxied: false,
    comment: "DNS-AID index TXT fallback",
    content: "agents=polje:mcp",
  },
];

const listed = await cf(
  "GET",
  `/zones/${ZONE}/dns_records?per_page=200&search=_agents`
);
const existing = listed.result || [];

function match(want) {
  return existing.find(
    (r) =>
      r.type === want.type &&
      (r.name === `${want.name}.${HOST}` || r.name === want.name)
  );
}

for (const rec of desired) {
  const body = { ...rec };
  const found = match(rec);
  if (found) {
    const out = await cf("PUT", `/zones/${ZONE}/dns_records/${found.id}`, body);
    console.log("updated", out.result.type, out.result.name);
  } else {
    const out = await cf("POST", `/zones/${ZONE}/dns_records`, body);
    console.log("created", out.result.type, out.result.name);
  }
}

const dnssec = await cf("GET", `/zones/${ZONE}/dnssec`);
const d = dnssec.result || {};
console.log("\nDNSSEC Cloudflare:", d.status);
console.log("DS (paste at CARNet / domene.hr):");
console.log(d.ds || `${HOST}. 3600 IN DS ${d.key_tag} ${d.algorithm} ${d.digest_type} ${d.digest}`);
console.log("\nCARNet fields:");
console.log("  key tag     ", d.key_tag);
console.log("  algorithm   ", d.algorithm, "(ECDSA P-256 SHA-256)");
console.log("  digest type ", d.digest_type, "(SHA-256)");
console.log("  digest      ", d.digest);
console.log("\nPortal: https://www.domene.hr/portal/mydomain/administration");
console.log("Request the 60-minute admin link to info@qtech.hr, then add the DS.");
