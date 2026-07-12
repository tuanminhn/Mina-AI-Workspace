import type { TravelPeriod } from "./tools";

type TinyfishSearchResult = {
  site_name?: string;
  title?: string;
  snippet?: string;
  url?: string;
};

export type LiveTravelSource = {
  kind: "flight" | "hotel";
  siteName: string;
  title: string;
  snippet: string;
  url: string;
};

export type EnrichedTravelSource = LiveTravelSource & {
  description: string;
  priceHint: string | null;
  priceVnd: number | null;
  fetchedAt: string;
};

export type LiveTravelSearch = {
  provider: "tinyfish" | "demo";
  status: "live" | "unavailable" | "failed";
  message: string;
  sources?: LiveTravelSource[];
};

const TINYFISH_SEARCH_URL = "https://api.search.tinyfish.ai";

async function searchTinyfish(query: string, purpose: string) {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) return [];
  const url = new URL(TINYFISH_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("purpose", purpose);
  url.searchParams.set("location", "VN");
  url.searchParams.set("language", "en");
  const response = await fetch(url, {
    headers: { "X-API-Key": apiKey },
    signal: AbortSignal.timeout(120_000),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as { results?: TinyfishSearchResult[]; message?: string };
  if (!response.ok) throw new Error(data.message || `Tinyfish Search returned ${response.status}`);
  return Array.isArray(data.results) ? data.results : [];
}

export async function searchLiveTravelOptions(destination: string, period: TravelPeriod): Promise<LiveTravelSearch> {
  if (!process.env.TINYFISH_API_KEY) {
    return { provider: "demo", status: "unavailable", message: "TINYFISH_API_KEY is not configured; using demo options." };
  }
  const dates = `${period.fromDate} to ${period.toDate}`;
  const [flights, hotels] = await Promise.all([
    searchTinyfish(
      `flights Hanoi HAN to ${destination} ${dates}`,
      "Find official or trusted flight-search pages for a read-only business-travel comparison. Do not book anything.",
    ),
    searchTinyfish(
      `hotels ${destination} Vietnam ${dates}`,
      "Find trusted hotel-search pages for a read-only business-travel comparison. Do not book anything.",
    ),
  ]);
  const toSource = (kind: LiveTravelSource["kind"], item: TinyfishSearchResult): LiveTravelSource | null => {
    if (!item.url || !item.title) return null;
    return { kind, siteName: item.site_name || new URL(item.url).hostname, title: item.title, snippet: item.snippet || "Open the source to confirm current availability and price.", url: item.url };
  };
  const sources = [...flights.slice(0, 3).map((item) => toSource("flight", item)), ...hotels.slice(0, 3).map((item) => toSource("hotel", item))]
    .filter((item): item is LiveTravelSource => Boolean(item))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index)
    .slice(0, 6);
  if (!sources.length) throw new Error("Tinyfish Search returned no usable travel sources");
  return {
    provider: "tinyfish",
    status: "live",
    message: `Found ${sources.length} live web sources via Tinyfish. Availability and price must be confirmed at the source before booking.`,
    sources,
  };
}

function findPriceHint(text: string) {
  const match = text.match(/(?:[₫đ]|VND)?\s*\d{1,3}(?:[.,]\d{3})+(?:\s*(?:VND|đ|₫))?/i)
    || text.match(/\d+(?:[.,]\d+)?\s*(?:triệu|million)\s*(?:VND|đ|₫)?/i);
  return match?.[0]?.trim() || null;
}

function priceToVnd(priceHint: string | null) {
  if (!priceHint) return null;
  const normalized = priceHint.toLowerCase();
  if (normalized.includes("triệu") || normalized.includes("million")) {
    const value = Number(normalized.replace(",", ".").match(/[\d.]+/)?.[0]);
    return Number.isFinite(value) ? Math.round(value * 1_000_000) : null;
  }
  const value = Number(normalized.replace(/[^\d]/g, ""));
  return Number.isFinite(value) && value >= 50_000 ? value : null;
}

export async function enrichTravelSources(sources: LiveTravelSource[]): Promise<EnrichedTravelSource[]> {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey || !sources.length) return [];
  const response = await fetch("https://api.fetch.tinyfish.ai", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ urls: sources.slice(0, 3).map((source) => source.url), format: "markdown", ttl: 0, per_url_timeout_ms: 45_000 }),
    signal: AbortSignal.timeout(120_000),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as {
    results?: Array<{ url?: string; final_url?: string; title?: string | null; description?: string | null; text?: string | null }>;
  };
  if (!response.ok) throw new Error("Tinyfish Fetch is unavailable");
  const pages = data.results || [];
  return sources.map((source) => {
    const page = pages.find((item) => item.url === source.url || item.final_url === source.url);
    const content = `${page?.description || ""}\n${typeof page?.text === "string" ? page.text.slice(0, 4000) : ""}`;
    return {
      ...source,
      title: page?.title || source.title,
      description: page?.description || source.snippet,
      priceHint: findPriceHint(content),
      priceVnd: priceToVnd(findPriceHint(content)),
      fetchedAt: new Date().toISOString(),
    };
  });
}
