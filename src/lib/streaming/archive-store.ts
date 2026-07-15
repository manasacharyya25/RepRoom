import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export type ArchiveSession = {
  id: string;
  roomId: string;
  userId: string;
  mtxPath: string;
  quality: "360p";
  startedAt: string;
  endedAt: string | null;
  /** Relative to archives root, e.g. live/yoga/userId/2026-....mp4 */
  recordingRelativePath: string | null;
};

const ARCHIVES_ROOT = path.join(process.cwd(), "archives");
const META_DIR = path.join(ARCHIVES_ROOT, "meta");

function sessionFile(sessionId: string) {
  return path.join(META_DIR, `${sessionId}.json`);
}

export function getArchivesRoot() {
  return ARCHIVES_ROOT;
}

export async function ensureArchiveDirs() {
  await fs.mkdir(META_DIR, { recursive: true });
  await fs.mkdir(ARCHIVES_ROOT, { recursive: true });
}

export async function createArchiveSession(input: {
  roomId: string;
  userId: string;
  mtxPath: string;
}): Promise<ArchiveSession> {
  await ensureArchiveDirs();
  const session: ArchiveSession = {
    id: randomUUID(),
    roomId: input.roomId,
    userId: input.userId,
    mtxPath: input.mtxPath,
    quality: "360p",
    startedAt: new Date().toISOString(),
    endedAt: null,
    recordingRelativePath: null
  };
  await fs.writeFile(
    sessionFile(session.id),
    JSON.stringify(session, null, 2),
    "utf8"
  );
  return session;
}

export async function getArchiveSession(
  sessionId: string
): Promise<ArchiveSession | null> {
  try {
    const raw = await fs.readFile(sessionFile(sessionId), "utf8");
    return JSON.parse(raw) as ArchiveSession;
  } catch {
    return null;
  }
}

async function findLatestRecordingRelative(
  mtxPath: string
): Promise<string | null> {
  const dir = path.join(ARCHIVES_ROOT, ...mtxPath.split("/").filter(Boolean));
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".mp4"))
      .map((entry) => entry.name)
      .sort();
    const latest = files[files.length - 1];
    if (!latest) return null;
    return path.posix.join(mtxPath, latest);
  } catch {
    return null;
  }
}

export async function endArchiveSession(
  sessionId: string
): Promise<ArchiveSession | null> {
  const session = await getArchiveSession(sessionId);
  if (!session) return null;

  // Give MediaMTX a moment to finalize the open segment.
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const recordingRelativePath =
    (await findLatestRecordingRelative(session.mtxPath)) ??
    session.recordingRelativePath;

  const updated: ArchiveSession = {
    ...session,
    endedAt: new Date().toISOString(),
    recordingRelativePath
  };

  await fs.writeFile(
    sessionFile(session.id),
    JSON.stringify(updated, null, 2),
    "utf8"
  );
  return updated;
}

export async function listArchiveSessions(options?: {
  roomId?: string;
  userId?: string;
  limit?: number;
}): Promise<ArchiveSession[]> {
  await ensureArchiveDirs();
  let names: string[] = [];
  try {
    names = await fs.readdir(META_DIR);
  } catch {
    return [];
  }

  const sessions: ArchiveSession[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(META_DIR, name), "utf8");
      const session = JSON.parse(raw) as ArchiveSession;
      if (options?.roomId && session.roomId !== options.roomId) continue;
      if (options?.userId && session.userId !== options.userId) continue;
      sessions.push(session);
    } catch {
      /* skip corrupt */
    }
  }

  sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const limit = Math.min(Math.max(1, options?.limit ?? 50), 100);
  return sessions.slice(0, limit);
}

/** Resolve a relative recording path under archives/; reject path traversal. */
export function resolveArchiveFile(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.includes("..") ||
    normalized.startsWith("meta/")
  ) {
    return null;
  }
  const absolute = path.resolve(ARCHIVES_ROOT, normalized);
  if (
    !absolute.startsWith(path.resolve(ARCHIVES_ROOT) + path.sep) &&
    absolute !== path.resolve(ARCHIVES_ROOT)
  ) {
    return null;
  }
  return absolute;
}

export function filePlaybackUrl(relativePath: string) {
  const parts = relativePath.split("/").map(encodeURIComponent).join("/");
  return `/api/archives/file/${parts}`;
}
