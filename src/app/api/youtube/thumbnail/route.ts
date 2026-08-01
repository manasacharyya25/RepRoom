import { NextResponse } from "next/server";
import {
  resolveFirstYoutubeVideoId,
  youtubeSearchUrl,
  youtubeThumbnailUrl
} from "@/lib/youtube-exercise";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ error: "Missing q." }, { status: 400 });
  }

  const videoId = await resolveFirstYoutubeVideoId(query);
  if (!videoId) {
    return NextResponse.json(
      {
        query,
        videoId: null,
        thumbnailUrl: null,
        searchUrl: youtubeSearchUrl(query)
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
        }
      }
    );
  }

  return NextResponse.json(
    {
      query,
      videoId,
      thumbnailUrl: youtubeThumbnailUrl(videoId),
      searchUrl: youtubeSearchUrl(query)
    },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=604800"
      }
    }
  );
}
