import { eurosToCents } from "./money";

export type PriceQuote = {
  vendor: string;
  title: string;
  url: string | null;
  amount_eur: number | null;
  amount_cents: number | null;
  notes: string | null;
  as_of: string | null;
};

export type PriceResearchResult = {
  query: string;
  quotes: PriceQuote[];
  raw: string;
  model: string;
};

const XAI_URL = "https://api.x.ai/v1/responses";
const MODEL = "grok-4.6";

type XaiContentPart = { type?: string; text?: string };
type XaiOutputItem = {
  type?: string;
  content?: XaiContentPart[] | string;
};
type XaiResponse = {
  output?: XaiOutputItem[];
  output_text?: string;
};

function extractText(resp: XaiResponse): string {
  if (resp.output_text) return resp.output_text;
  const parts: string[] = [];
  for (const item of resp.output ?? []) {
    if (item.type === "message") {
      if (typeof item.content === "string") parts.push(item.content);
      else if (Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.text) parts.push(c.text);
        }
      }
    }
  }
  return parts.join("\n").trim();
}

function parseQuotes(text: string, query: string): PriceQuote[] {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const blob = (fence ? fence[1] : text).trim();
  const start = blob.indexOf("{");
  const end = blob.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(blob.slice(start, end + 1)) as {
      quotes?: Array<{
        vendor?: string;
        title?: string;
        url?: string;
        amount_eur?: number;
        notes?: string;
        as_of?: string;
      }>;
    };
    const quotes = Array.isArray(parsed.quotes) ? parsed.quotes : [];
    return quotes.slice(0, 8).map((q) => {
      const amount_eur =
        typeof q.amount_eur === "number" && Number.isFinite(q.amount_eur)
          ? q.amount_eur
          : null;
      return {
        vendor: String(q.vendor || "unknown").slice(0, 120),
        title: String(q.title || query).slice(0, 200),
        url: typeof q.url === "string" && q.url.startsWith("http") ? q.url.slice(0, 2000) : null,
        amount_eur,
        amount_cents: amount_eur != null ? eurosToCents(amount_eur) : null,
        notes: q.notes ? String(q.notes).slice(0, 500) : null,
        as_of: q.as_of ? String(q.as_of).slice(0, 40) : null,
      };
    });
  } catch {
    return [];
  }
}

/** Research farm-shop prices via xAI Grok web_search (runs on the Worker, not the browser). */
export async function researchPricesOnline(
  apiKey: string,
  query: string,
  fetchImpl: typeof fetch = fetch
): Promise<PriceResearchResult> {
  const prompt = `Research current retail prices in the EU / Croatia for this farm procurement item.
Query: ${query}

Return JSON only, no markdown:
{"query":"...","quotes":[{"vendor":"shop name","title":"product","url":"https://...","amount_eur":123.45,"notes":"VAT/shipping if known","as_of":"YYYY-MM-DD"}]}
Rules:
- Amounts in EUR. Null amount_eur if unknown.
- Prefer Croatian / EU shops with a real product URL.
- These are research notes, not quotes or contracts.
- Max 6 quotes. Skip ads and marketplaces with no price.`;

  const res = await fetchImpl(XAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      tools: [{ type: "web_search" }],
      input: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`xai_error ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = (await res.json()) as XaiResponse;
  const raw = extractText(data) || "";
  return {
    query,
    quotes: parseQuotes(raw, query),
    raw: raw.slice(0, 4000),
    model: MODEL,
  };
}
