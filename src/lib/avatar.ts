import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildUserImagePath,
  compressImage,
  IMAGE_PRESETS,
  uploadImage,
  validateImageFile
} from "@/lib/media";

export const AVATAR_BUCKET = "avatars" as const;
export const AVATAR_MAX_BYTES = IMAGE_PRESETS.avatar.maxBytes;
export const AVATAR_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
] as const;

export function validateAvatarFile(file: File): string | null {
  return validateImageFile(file, "avatar");
}

/** @deprecated Prefer compressImage(file, "avatar") from @/lib/media */
export async function prepareAvatarFile(file: File, maxEdge = 512): Promise<File> {
  return compressImage(file, {
    ...IMAGE_PRESETS.avatar,
    maxEdge
  });
}

export async function uploadAvatar(
  supabase: SupabaseClient,
  userId: string,
  file: File
) {
  const prepared = await compressImage(file, "avatar");
  const path = buildUserImagePath(userId, "avatar", prepared);

  const { publicUrl } = await uploadImage(supabase, {
    bucket: AVATAR_BUCKET,
    path,
    file: prepared,
    preset: "avatar",
    validate: false,
    compress: false
  });

  return publicUrl;
}
