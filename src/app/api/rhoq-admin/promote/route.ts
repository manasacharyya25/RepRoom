import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { onboardingR2Folder } from "@/lib/onboarding-recorder";
import {
  isValidProfileUsername,
  postImageR2Key,
  readRhoqAdminSession
} from "@/lib/rhoq-admin";
import { isRoomId } from "@/lib/rooms";
import {
  createR2Client,
  isR2Configured,
  publicObjectUrl
} from "@/lib/streaming/r2";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function extensionFromKey(key: string) {
  const match = key.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? "jpg";
}

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Admin client is not configured" },
      { status: 503 }
    );
  }
  if (!isR2Configured()) {
    return NextResponse.json({ error: "R2 is not configured" }, { status: 503 });
  }

  const auth = await readRhoqAdminSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    recorderId?: string;
    email?: string;
    password?: string;
    roomId?: string;
    sessionIds?: string[];
    imageIds?: string[];
  } | null;

  const recorderId = String(body?.recorderId ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const roomId = String(body?.roomId ?? "").trim();
  const sessionIds = Array.isArray(body?.sessionIds)
    ? [...new Set(body.sessionIds.map((id) => String(id).trim()).filter(Boolean))]
    : [];
  const imageIds = Array.isArray(body?.imageIds)
    ? [...new Set(body.imageIds.map((id) => String(id).trim()).filter(Boolean))]
    : [];

  if (!recorderId) {
    return NextResponse.json({ error: "recorderId is required" }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }
  if (!isRoomId(roomId)) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  }
  if (sessionIds.length === 0 && imageIds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one recording or photo" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: recorder, error: recorderError } = await admin
    .from("onboarding_recorders")
    .select("id, username, active")
    .eq("id", recorderId)
    .maybeSingle();

  if (recorderError) {
    console.error("[rhoq-admin/promote] recorder", recorderError);
    return NextResponse.json({ error: "Could not load recorder" }, { status: 500 });
  }
  if (!recorder) {
    return NextResponse.json({ error: "Recorder not found" }, { status: 404 });
  }

  const username = String(recorder.username).trim().toLowerCase();
  if (!isValidProfileUsername(username)) {
    return NextResponse.json(
      {
        error:
          "Username must match recorder rules (a-z, 0-9, underscore, hyphen; 1–32 chars). Rename the recorder before promoting."
      },
      { status: 400 }
    );
  }

  const { data: existingUsername } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existingUsername) {
    return NextResponse.json(
      { error: `Username @${username} is already taken` },
      { status: 409 }
    );
  }

  let sessions: {
    session_id: string;
    started_at: string;
    ended_at: string | null;
    last_chunk_number: number;
    last_chunk_uploaded_at: string | null;
    available_chunks: number[] | null;
  }[] = [];

  if (sessionIds.length > 0) {
    const { data, error } = await admin
      .from("onboarding_recorder_sessions")
      .select(
        "session_id, started_at, ended_at, last_chunk_number, last_chunk_uploaded_at, available_chunks"
      )
      .eq("recorder_id", recorderId)
      .in("session_id", sessionIds)
      .gt("last_chunk_number", 0);

    if (error) {
      console.error("[rhoq-admin/promote] sessions", error);
      return NextResponse.json({ error: "Could not load sessions" }, { status: 500 });
    }
    sessions = (data ?? []) as typeof sessions;
    if (sessions.length !== sessionIds.length) {
      return NextResponse.json(
        { error: "One or more selected recordings were not found" },
        { status: 400 }
      );
    }
  }

  let images: { image_id: string; r2_key: string; content_type: string }[] = [];
  if (imageIds.length > 0) {
    const { data, error } = await admin
      .from("onboarding_recorder_images")
      .select("image_id, r2_key, content_type")
      .eq("recorder_id", recorderId)
      .in("image_id", imageIds);

    if (error) {
      console.error("[rhoq-admin/promote] images", error);
      return NextResponse.json({ error: "Could not load images" }, { status: 500 });
    }
    images = (data ?? []) as typeof images;
    if (images.length !== imageIds.length) {
      return NextResponse.json(
        { error: "One or more selected photos were not found" },
        { status: 400 }
      );
    }
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: username }
  });

  if (createError || !created.user) {
    const message = createError?.message ?? "Could not create user";
    const status =
      /already|registered|exists/i.test(message) || createError?.status === 422
        ? 409
        : 500;
    console.error("[rhoq-admin/promote] createUser", createError);
    return NextResponse.json({ error: message }, { status });
  }

  const userId = created.user.id;
  const now = new Date().toISOString();

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      display_name: username,
      username,
      onboarding_completed_at: now,
      updated_at: now
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error("[rhoq-admin/promote] profile", profileError);
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json(
      { error: profileError.message || "Could not create profile" },
      { status: 500 }
    );
  }

  if (sessions.length > 0) {
    const archiveRows = sessions.map((session) => ({
      session_id: session.session_id,
      user_id: userId,
      room_id: roomId,
      r2_folder: onboardingR2Folder(recorderId, session.session_id),
      status: "ended" as const,
      started_at: session.started_at,
      ended_at: session.ended_at ?? session.last_chunk_uploaded_at ?? now,
      last_chunk_number: session.last_chunk_number,
      last_chunk_uploaded_at:
        session.last_chunk_uploaded_at ?? session.ended_at ?? now,
      available_chunks: session.available_chunks,
      created_at: session.started_at ?? now,
      updated_at: now,
      archived_at: now,
      archive_reason: "ended"
    }));

    const { error: archiveError } = await admin
      .from("archive_sessions")
      .upsert(archiveRows, { onConflict: "session_id" });

    if (archiveError) {
      console.error("[rhoq-admin/promote] archive_sessions", archiveError);
      return NextResponse.json(
        {
          error: `User created, but archive sessions failed: ${archiveError.message}`,
          userId,
          username,
          email
        },
        { status: 500 }
      );
    }
  }

  const createdPostIds: string[] = [];
  if (images.length > 0) {
    const { client, bucket } = createR2Client();

    for (const image of images) {
      const ext = extensionFromKey(image.r2_key);
      const destId = randomUUID();
      const destKey = postImageR2Key(userId, "post", ext, destId);

      try {
        await client.send(
          new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${image.r2_key}`,
            Key: destKey,
            ContentType: image.content_type || undefined,
            MetadataDirective: "REPLACE"
          })
        );
      } catch (copyError) {
        console.error("[rhoq-admin/promote] R2 copy", copyError);
        return NextResponse.json(
          {
            error: `User created, but copying image ${image.image_id} failed`,
            userId,
            username,
            email,
            createdPostIds
          },
          { status: 500 }
        );
      }

      const publicUrl = publicObjectUrl(destKey);
      if (!publicUrl) {
        return NextResponse.json(
          {
            error: "R2 public base URL is not configured",
            userId,
            username,
            email,
            createdPostIds
          },
          { status: 503 }
        );
      }

      const { data: post, error: postError } = await admin
        .from("posts")
        .insert({
          user_id: userId,
          kind: "standard",
          category: "pump_check",
          caption: "Welcome to RhoQ",
          image_url: publicUrl,
          before_image_url: null,
          after_image_url: null,
          location: null,
          tags: []
        })
        .select("id")
        .single();

      if (postError) {
        console.error("[rhoq-admin/promote] posts", postError);
        return NextResponse.json(
          {
            error: `User created, but creating a post failed: ${postError.message}`,
            userId,
            username,
            email,
            createdPostIds
          },
          { status: 500 }
        );
      }
      if (post?.id) createdPostIds.push(post.id as string);
    }
  }

  const { error: markError } = await admin
    .from("onboarding_recorders")
    .update({
      promoted_at: now,
      promoted_user_id: userId,
      active: false,
      updated_at: now
    })
    .eq("id", recorderId);

  if (markError) {
    console.error("[rhoq-admin/promote] mark promoted", markError);
    return NextResponse.json(
      {
        error: `User created, but marking recorder as promoted failed: ${markError.message}`,
        userId,
        username,
        email,
        archivedSessions: sessions.length,
        createdPosts: createdPostIds.length,
        createdPostIds
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    userId,
    username,
    email,
    archivedSessions: sessions.length,
    createdPosts: createdPostIds.length,
    createdPostIds,
    promoted: true
  });
}
