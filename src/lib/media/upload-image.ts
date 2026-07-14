import type { SupabaseClient } from "@supabase/supabase-js";
import { compressImage, validateImageFile } from "@/lib/media/compress-image";
import {
  IMAGE_PRESETS,
  type ImagePresetName,
  type StorageBucket
} from "@/lib/media/presets";

function extensionFromFile(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/png") return "png";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

export type UploadImageOptions = {
  bucket: StorageBucket;
  /** Full object path inside the bucket, e.g. `${userId}/avatar-123.webp` */
  path: string;
  file: File;
  preset?: ImagePresetName;
  /** Validate before compress. Defaults to true. */
  validate?: boolean;
  /** Compress before upload. Defaults to true. Set false if already compressed. */
  compress?: boolean;
  upsert?: boolean;
  cacheControl?: string;
};

/**
 * One-place Storage upload: validate → compress → upload → public URL.
 */
export async function uploadImage(
  supabase: SupabaseClient,
  options: UploadImageOptions
) {
  const {
    bucket,
    path,
    file,
    preset = "post",
    validate = true,
    compress = true,
    upsert = true,
    cacheControl = "3600"
  } = options;

  if (validate) {
    const validationError = validateImageFile(file, preset);
    if (validationError) {
      throw new Error(validationError);
    }
  }

  const prepared = compress
    ? await compressImage(file, IMAGE_PRESETS[preset])
    : file;

  const { error } = await supabase.storage.from(bucket).upload(path, prepared, {
    cacheControl,
    upsert,
    contentType: prepared.type || `image/${extensionFromFile(prepared)}`
  });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return {
    publicUrl: data.publicUrl,
    path,
    file: prepared
  };
}

export function buildUserImagePath(
  userId: string,
  kind: "avatar" | "post" | "thumb",
  file: File
) {
  const ext = extensionFromFile(file);
  return `${userId}/${kind}-${Date.now()}.${ext}`;
}
