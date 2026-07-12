import { NextResponse } from "next/server";
import { enrichTravelSources, type LiveTravelSource } from "@/lib/tinyfish";

export async function POST(request: Request) {
  const body = await request.json();
  const kind = body.kind === "hotel" ? "hotel" : "flight";
  const rawSources = Array.isArray(body.sources) ? body.sources : [];
  const sources = rawSources.slice(0, 3).flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Partial<LiveTravelSource>;
    if (source.kind !== kind || !source.url || !source.title || !source.siteName) return [];
    try {
      const url = new URL(source.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") return [];
      return [{ kind, url: url.toString(), title: String(source.title), siteName: String(source.siteName), snippet: String(source.snippet || "") } satisfies LiveTravelSource];
    } catch { return []; }
  });
  try {
    return NextResponse.json({ kind, sources: await enrichTravelSources(sources) });
  } catch (error) {
    return NextResponse.json({ kind, sources: [], error: error instanceof Error ? error.message : "Tinyfish Fetch failed" }, { status: 502 });
  }
}
