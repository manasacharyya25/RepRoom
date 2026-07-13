import type { SupabaseClient } from "@supabase/supabase-js";

export const AVATAR_BUCKET = "avatars";
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function validateAvatarFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Please choose an image file.";
  }
  if (
    file.type &&
    !AVATAR_ACCEPT.includes(file.type) &&
    !file.type.startsWith("image/")
  ) {
    return "Use a JPG, PNG, WEBP, or GIF image.";
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return "Image must be 5MB or smaller.";
  }
  return null;
}

/** Resize + compress large photos before upload. */
export async function prepareAvatarFile(file: File, maxEdge = 1024): Promise<File> {
  if (typeof createImageBitmap === "undefined") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size <= 800_000) {
      bitmap.close();
      return file;
    }

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.85);
    });

    if (!blob) return file;

    return new File([blob], file.name.replace(/\.\w+$/, ".jpg") || "avatar.jpg", {
      type: "image/jpeg",
      lastModified: Date.now()
    });
  } catch {
    return file;
  }
}

export async function uploadAvatar(
  supabase: SupabaseClient,
  userId: string,
  file: File
) {
  const prepared = await prepareAvatarFile(file);
  const extension =
    prepared.name.split(".").pop()?.toLowerCase() ||
    (prepared.type === "image/png" ? "png" : "jpg");
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(extension)
    ? extension === "jpeg"
      ? "jpg"
      : extension
    : "jpg";
  const path = `${userId}/avatar-${Date.now()}.${safeExt}`;

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, prepared, {
    cacheControl: "3600",
    upsert: true,
    contentType: prepared.type || `image/${safeExt}`
  });

  if (error) throw error;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
