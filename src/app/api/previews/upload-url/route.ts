import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { isRoomId } from "@/lib/rooms";
import { previewChunkKey } from "@/lib/streaming/preview-chunks";
import { createR2Client, isR2Configured, publicObjectUrl } from "@/lib/streaming/r2";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "R2 is not configured" },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    roomId?: string;
    chunkIndex?: number;
    contentType?: string;
  } | null;

  const roomId = body?.roomId?.trim() ?? "";
  if (!isRoomId(roomId)) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  }

  const chunkIndex = Number(body?.chunkIndex);
  if (!Number.isFinite(chunkIndex) || chunkIndex < 1 || chunkIndex > 1_000_000) {
    return NextResponse.json({ error: "Invalid chunkIndex" }, { status: 400 });
  }

  const contentType = "video/webm";

  const key = previewChunkKey({
    roomId,
    userId: user.id,
    chunkIndex
  });

  try {
    const { client, bucket } = createR2Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType
    });
    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: 60,
      // Only sign headers the browser will actually send.
      signableHeaders: new Set(["content-type"])
    });

    return NextResponse.json({
      uploadUrl,
      key,
      chunkIndex,
      contentType,
      publicUrl: publicObjectUrl(key),
      expiresIn: 60
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create upload URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
