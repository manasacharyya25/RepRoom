import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  endArchiveSession,
  filePlaybackUrl
} from "@/lib/streaming/archive-store";
import { archivePlaybackUrl } from "@/lib/streaming/config";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function PATCH(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await endArchiveSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const endedAt = session.endedAt ?? new Date().toISOString();
  const durationSec = Math.max(
    1,
    Math.round(
      (new Date(endedAt).getTime() - new Date(session.startedAt).getTime()) /
        1000
    )
  );

  return NextResponse.json({
    session: {
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
    }
  });
}
