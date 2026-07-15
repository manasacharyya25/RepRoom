import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createArchiveSession,
  filePlaybackUrl,
  listArchiveSessions
} from "@/lib/streaming/archive-store";
import { archivePlaybackUrl, streamPath } from "@/lib/streaming/config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId")?.trim() || undefined;
  const userId = searchParams.get("userId")?.trim() || undefined;
  const limit = Number(searchParams.get("limit") ?? "20");

  const sessions = await listArchiveSessions({ roomId, userId, limit });

  return NextResponse.json({
    sessions: sessions.map((session) => {
      const endedAt = session.endedAt ?? new Date().toISOString();
      const durationSec = Math.max(
        1,
        Math.round(
          (new Date(endedAt).getTime() - new Date(session.startedAt).getTime()) /
            1000
        )
      );

      return {
        ...session,
        durationSec,
        fileUrl: session.recordingRelativePath
          ? filePlaybackUrl(session.recordingRelativePath)
          : null,
        playbackUrl: archivePlaybackUrl({
          mtxPath: session.mtxPath,
          startIso: session.startedAt,
          durationSec
        })
      };
    })
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    roomId?: string;
  } | null;

  const roomId = body?.roomId?.trim();
  if (!roomId) {
    return NextResponse.json({ error: "roomId is required" }, { status: 400 });
  }

  const mtxPath = streamPath(roomId, user.id);
  const session = await createArchiveSession({
    roomId,
    userId: user.id,
    mtxPath
  });

  return NextResponse.json({ session });
}
