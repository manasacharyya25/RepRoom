import { DEFAULT_FACE_STYLE, type FaceStyleId } from "@/lib/face-styles";

export const SESSION_STORAGE_KEY = "workout-with-me:preview-settings";

export type PreviewSettings = {
  roomName: string;
  participantName: string;
  styleId: FaceStyleId;
  uploadedImageDataUrl?: string;
};

export function createDefaultSettings(
  roomName = "",
  participantName = ""
): PreviewSettings {
  return {
    roomName,
    participantName,
    styleId: DEFAULT_FACE_STYLE
  };
}
