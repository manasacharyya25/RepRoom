export type FaceStyleId = "blur" | "pixelate" | "silhouette" | "avatar";

export type FaceStyle = {
  id: FaceStyleId;
  label: string;
  description: string;
};

export const FACE_STYLES: FaceStyle[] = [
  {
    id: "blur",
    label: "Blur",
    description: "Soft anonymization that keeps motion natural."
  },
  {
    id: "pixelate",
    label: "Pixelate",
    description: "Retro block effect focused on the face."
  },
  {
    id: "silhouette",
    label: "Mask",
    description: "High-contrast overlay that hides identity clearly."
  },
  {
    id: "avatar",
    label: "Avatar",
    description: "Use a playful generated look or your uploaded face image."
  }
];

export const DEFAULT_FACE_STYLE: FaceStyleId = "blur";
