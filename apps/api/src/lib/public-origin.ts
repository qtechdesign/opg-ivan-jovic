/** Canonical public host (www stripped). Forks: request Host still wins. */
export const CANONICAL_HOST = "opg-ivanjovic.hr";

export const DOCS_API_URL = "https://docs.opg-ivanjovic.hr/api";

export function publicOriginFromHost(
  hostHeader: string | undefined
): string {
  const raw = (hostHeader || CANONICAL_HOST).split(":")[0];
  const host = raw.replace(/^www\./i, "") || CANONICAL_HOST;
  return `https://${host}`;
}
