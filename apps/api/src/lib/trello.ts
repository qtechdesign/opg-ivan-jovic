/** Public Trello board read. No API key. Writes stay on Trello.com. */

export const IVAN_JOVIC_TRELLO_ID = "RCANtF3j";
export const IVAN_JOVIC_TRELLO_URL =
  "https://trello.com/b/RCANtF3j/opg-ivan-jovic";

export type TrelloCard = {
  id: string;
  name: string;
  url: string;
  due: string | null;
  thumb: string | null;
};

export type TrelloList = {
  id: string;
  name: string;
  cards: TrelloCard[];
};

export type TrelloBoardView = {
  id: string;
  name: string;
  url: string;
  lists: TrelloList[];
};

export function trelloBoardIdForSlug(slug: string): string | null {
  if (slug === "ivan-jovic") return IVAN_JOVIC_TRELLO_ID;
  return null;
}

type RawPreview = { url?: string; width?: number; height?: number };

type RawBoard = {
  id?: string;
  name?: string;
  shortUrl?: string;
  url?: string;
  lists?: Array<{ id: string; name: string; closed?: boolean; pos?: number }>;
  cards?: Array<{
    id: string;
    name: string;
    url?: string;
    shortUrl?: string;
    idList: string;
    closed?: boolean;
    due?: string | null;
    pos?: number;
    cover?: { scaled?: RawPreview[] };
    attachments?: Array<{ previews?: RawPreview[] }>;
  }>;
};

/** Smallest public Trello preview (favicon-sized). Keep trello.com URLs so CloudFront signatures stay fresh. */
export function trelloCardThumb(card: {
  cover?: { scaled?: RawPreview[] };
  attachments?: Array<{ previews?: RawPreview[] }>;
}): string | null {
  const scaled = card.cover?.scaled ?? [];
  const previews = (card.attachments ?? []).flatMap((a) => a.previews ?? []);
  const pool = [...scaled, ...previews].filter((p) => p.url);
  if (!pool.length) return null;
  pool.sort((a, b) => (a.width ?? 9999) - (b.width ?? 9999));
  const url = pool[0]?.url ?? null;
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname !== "trello.com" && u.hostname !== "files.trello.com") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function parseTrelloBoard(raw: RawBoard, fallbackId: string): TrelloBoardView {
  const lists = (raw.lists ?? [])
    .filter((l) => !l.closed)
    .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  const cards = (raw.cards ?? []).filter((c) => !c.closed);
  return {
    id: raw.id || fallbackId,
    name: raw.name || "Trello",
    url: raw.shortUrl || raw.url || `https://trello.com/b/${fallbackId}`,
    lists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      cards: cards
        .filter((c) => c.idList === l.id)
        .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0))
        .slice(0, 16)
        .map((c) => ({
          id: c.id,
          name: c.name,
          url: c.shortUrl || c.url || `https://trello.com/c/${c.id}`,
          due: c.due ?? null,
          thumb: trelloCardThumb(c),
        })),
    })),
  };
}

const TRELLO_TIMEOUT_MS = 4000;

export async function fetchPublicTrelloBoard(
  boardId: string,
  fetchImpl: typeof fetch = fetch
): Promise<TrelloBoardView | null> {
  const url = `https://trello.com/b/${encodeURIComponent(boardId)}.json`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TRELLO_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      headers: { Accept: "application/json", "User-Agent": "Polje/1.0" },
      signal: ac.signal,
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as RawBoard;
    return parseTrelloBoard(raw, boardId);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
