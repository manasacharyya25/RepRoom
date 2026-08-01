const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    query.trim()
  )}`;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function extractFirstVideoId(payload: string): string | null {
  const renderer = payload.match(
    /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"/
  );
  if (renderer?.[1] && VIDEO_ID_RE.test(renderer[1])) {
    return renderer[1];
  }

  const fallback = payload.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
  if (fallback?.[1] && VIDEO_ID_RE.test(fallback[1])) {
    return fallback[1];
  }

  return null;
}

async function searchViaInnertube(query: string): Promise<string | null> {
  const response = await fetch(
    "https://www.youtube.com/youtubei/v1/search?prettyPrint=false",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20240101.00.00",
            hl: "en",
            gl: "US"
          }
        },
        query
      }),
      next: { revalidate: 86400 }
    }
  );

  if (!response.ok) return null;
  return extractFirstVideoId(JSON.stringify(await response.json()));
}

async function searchViaHtml(query: string): Promise<string | null> {
  const response = await fetch(
    `${youtubeSearchUrl(query)}&sp=EgIQAQ%253D%253D`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      },
      next: { revalidate: 86400 }
    }
  );

  if (!response.ok) return null;
  return extractFirstVideoId(await response.text());
}

/** Resolve the first YouTube search result video id for an exercise name. */
export async function resolveFirstYoutubeVideoId(
  query: string
): Promise<string | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const fromInnertube = await searchViaInnertube(trimmed);
    if (fromInnertube) return fromInnertube;
  } catch {
    // Fall through to HTML scrape.
  }

  try {
    return await searchViaHtml(trimmed);
  } catch {
    return null;
  }
}
