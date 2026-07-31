import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createR2Client, isR2Configured } from "@/lib/streaming/r2";

const CHUNK_KEY_RE = /(?:^|\/)chunk_(\d+)\.webm$/i;

export function parseChunkIndexFromKey(key: string): number | null {
  const match = key.match(CHUNK_KEY_RE);
  if (!match?.[1]) return null;
  const index = Number(match[1]);
  if (!Number.isFinite(index) || index < 1) return null;
  return Math.floor(index);
}

/**
 * Class A ListObjects over an R2 session folder. Use only for ended archives,
 * and persist the result so subsequent replays skip listing.
 */
export async function listChunkIndicesInFolder(
  r2Folder: string
): Promise<number[]> {
  if (!isR2Configured()) {
    throw new Error("R2 is not configured");
  }

  const folder = r2Folder.trim().replace(/^\/+|\/+$/g, "");
  if (!folder) throw new Error("r2Folder is required");

  const { client, bucket } = createR2Client();
  const prefix = `${folder}/`;
  const indices = new Set<number>();
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken
      })
    );

    for (const object of response.Contents ?? []) {
      if (!object.Key) continue;
      const index = parseChunkIndexFromKey(object.Key);
      if (index !== null) indices.add(index);
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return [...indices].sort((a, b) => a - b);
}

export function normalizeAvailableChunks(
  value: unknown
): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const cleaned = [
    ...new Set(
      value
        .map((entry) => Number(entry))
        .filter((entry) => Number.isFinite(entry) && entry >= 1)
        .map((entry) => Math.floor(entry))
    )
  ].sort((a, b) => a - b);
  return cleaned.length > 0 ? cleaned : null;
}
