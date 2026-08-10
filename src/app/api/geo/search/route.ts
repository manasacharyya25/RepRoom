import { NextResponse } from "next/server";
import { resolveSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

type NominatimResult = {
  place_id?: number;
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
};

type LocationSuggestion = {
  placeId: number | null;
  displayName: string;
  name: string | null;
  lat: string | null;
  lon: string | null;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;
const searchCache = new Map<
  string,
  { at: number; results: LocationSuggestion[] }
>();

function cacheGet(key: string): LocationSuggestion[] | null {
  const hit = searchCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return hit.results;
}

function cacheSet(key: string, results: LocationSuggestion[]) {
  if (searchCache.size >= CACHE_MAX) {
    const oldest = searchCache.keys().next().value;
    if (oldest) searchCache.delete(oldest);
  }
  searchCache.set(key, { at: Date.now(), results });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] as LocationSuggestion[] });
  }

  const cacheKey = q.toLowerCase();
  const cached = cacheGet(cacheKey);
  if (cached) {
    return NextResponse.json({ results: cached, cached: true });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "10");
  url.searchParams.set("addressdetails", "0");

  const site = resolveSiteUrl();
  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": `RhoQ/1.0 (${site}; location-search)`,
        Referer: site
      },
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Location search failed", results: [] },
        { status: 502 }
      );
    }

    const raw = (await response.json()) as NominatimResult[];
    const results: LocationSuggestion[] = (Array.isArray(raw) ? raw : [])
      .map((row) => ({
        placeId: typeof row.place_id === "number" ? row.place_id : null,
        displayName: (row.display_name ?? "").trim(),
        name: row.name?.trim() || null,
        lat: row.lat ?? null,
        lon: row.lon ?? null
      }))
      .filter((row) => row.displayName.length > 0)
      .slice(0, 10);

    cacheSet(cacheKey, results);
    return NextResponse.json({ results, cached: false });
  } catch (error) {
    console.error("[geo/search]", error);
    return NextResponse.json(
      { error: "Location search failed", results: [] },
      { status: 502 }
    );
  }
}
