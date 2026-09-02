/**
 * DNS-AID (draft-mozleywilliams-dnsop-dnsaid) + RFC 9460 ServiceMode.
 * Live records are published with `npm run dns:aid` (Cloudflare DNS API).
 *
 * Experimental SvcParamKeys use RFC 9460 private-use numbers until IANA assigns names.
 * Do not advertise `_a2a._agents` — Polje has no A2A endpoint.
 */

export const DNS_AID_HOST = "opg-ivanjovic.hr";

/** Private-use SvcParamKeys (dns-aid-core / draft-02 pending IANA). */
export const DNS_AID_KEYS = {
  cap: "key65400",
  capSha256: "key65401",
  bap: "key65402",
  wellKnown: "key65409",
} as const;

export const DNS_AID_NAMES = [
  "_index._agents",
  "_mcp._agents",
  "_catalog._agents",
] as const;

/**
 * Presentation-form records (hashes filled at publish time).
 * TargetName has no underscore labels so public certs match.
 */
export function dnsAidZonePresentation(host = DNS_AID_HOST): string {
  return `
_index._agents.${host}.  3600  IN  HTTPS  1  ${host}. alpn="h3,h2" port=443 mandatory=alpn,port
_index._agents.${host}.  3600  IN  SVCB   1  ${host}. alpn="h3,h2" port=443 mandatory=alpn,port
_mcp._agents.${host}.    3600  IN  HTTPS  1  ${host}. alpn="h3,h2" port=443 mandatory=alpn,port
_mcp._agents.${host}.    3600  IN  SVCB   1  ${host}. alpn="h3,h2" port=443 mandatory=alpn,port
_catalog._agents.${host}. 3600 IN  TXT    "url=https://${host}/.well-known/ai-catalog.json"
`.trim();
}
