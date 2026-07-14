import {
  ACCEPTED_IMAGE_TYPES,
  IMAGE_PRESETS,
  type ImagePreset,
  type ImagePresetName
} from "@/lib/media/presets";

function extensionForMime(mime: string) {
  if (mime === "image/webp") return "webp";
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

function replaceExtension(filename: string, extension: string) {
  const base = filename.replace(/\.[^/.]+$/, "") || "image";
  return `${base}.${extension}`;
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Resize + compress an image for Storage uploads.
 * Animated GIFs are left untouched (canvas would flatten them).
 */
export async function compressImage(
  file: File,
  presetOrName: ImagePresetName | ImagePreset = "post"
): Promise<File> {
  const preset =
    typeof presetOrName === "string"
      ? IMAGE_PRESETS[presetOrName]
      : presetOrName;

  if (file.type === "image/gif") {
    return file;
  }

  if (typeof createImageBitmap === "undefined") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, preset.maxEdge / longest);

    if (scale >= 1 && file.size <= preset.skipUnderBytes) {
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

    let outputType = preset.format;
    let blob = await canvasToBlob(canvas, outputType, preset.quality);

    if (!blob && outputType === "image/webp") {
      outputType = "image/jpeg";
      blob = await canvasToBlob(canvas, outputType, preset.quality);
    }

    if (!blob) {
      return file;
    }

    // If compression somehow got larger, keep the smaller of the two.
    if (blob.size >= file.size && scale >= 1) {
      return file;
    }

    const extension = extensionForMime(outputType);
    return new File([blob], replaceExtension(file.name, extension), {
      type: outputType,
      lastModified: Date.now()
    });
  } catch {
    return file;
  }
}

export function validateImageFile(
  file: File,
  presetOrName: ImagePresetName | ImagePreset = "post"
): string | null {
  const preset =
    typeof presetOrName === "string"
      ? IMAGE_PRESETS[presetOrName]
      : presetOrName;

  if (!file.type.startsWith("image/")) {
    return "Please choose an image file.";
  }

  if (
    file.type &&
    !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type) &&
    !file.type.startsWith("image/")
  ) {
    return "Use a JPG, PNG, WEBP, or GIF image.";
  }

  if (file.size > preset.maxBytes) {
    const mb = Math.round(preset.maxBytes / (1024 * 1024));
    return `Image must be ${mb}MB or smaller.`;
  }

  return null;
}
