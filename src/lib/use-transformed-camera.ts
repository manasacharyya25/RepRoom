"use client";

import type { RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { FaceStyleId } from "@/lib/face-styles";

type Point = {
  x: number;
  y: number;
};

type FaceBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type UseTransformedCameraOptions = {
  styleId: FaceStyleId;
  uploadedImageDataUrl?: string;
};

type UseTransformedCameraResult = {
  previewRef: RefObject<HTMLCanvasElement | null>;
  processedStream: MediaStream | null;
  status: "idle" | "starting" | "ready" | "error";
  error: string | null;
  detectionMode: "mediapipe" | "fallback";
};

const DETECTION_INTERVAL_MS = 240;
const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400,
  377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67,
  109
];
const MEDIAPIPE_WASM_URL = "/mediapipe";
const FACE_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

function createFallbackFaceContour(width: number, height: number): Point[] {
  const centerX = width * 0.5;
  const centerY = height * 0.28;
  const radiusX = width * 0.18;
  const radiusY = height * 0.19;
  const points = 32;

  return Array.from({ length: points }, (_, index) => {
    const angle = (Math.PI * 2 * index) / points - Math.PI / 2;
    return {
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY
    };
  });
}

function clampPoint(point: Point, width: number, height: number): Point {
  return {
    x: Math.max(0, Math.min(point.x, width)),
    y: Math.max(0, Math.min(point.y, height))
  };
}

function getFaceBounds(points: Point[], width: number, height: number): FaceBounds {
  if (points.length === 0) {
    return {
      x: width * 0.33,
      y: height * 0.14,
      width: width * 0.34,
      height: height * 0.28
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  const paddingX = (maxX - minX) * 0.12;
  const paddingY = (maxY - minY) * 0.14;

  return {
    x: Math.max(0, minX - paddingX),
    y: Math.max(0, minY - paddingY),
    width: Math.max(24, Math.min(width, maxX - minX + paddingX * 2)),
    height: Math.max(24, Math.min(height, maxY - minY + paddingY * 2))
  };
}

function traceContour(context: CanvasRenderingContext2D, points: Point[]) {
  if (points.length === 0) {
    return;
  }

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }

  context.closePath();
}

function createContourFromLandmarks(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number
): Point[] {
  return FACE_OVAL_INDICES.map((landmarkIndex) => {
    const landmark = landmarks[landmarkIndex];

    if (!landmark) {
      return { x: width * 0.5, y: height * 0.25 };
    }

    return clampPoint(
      {
        x: landmark.x * width,
        y: landmark.y * height
      },
      width,
      height
    );
  });
}

function drawPixelatedFace(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  contour: Point[]
) {
  const box = getFaceBounds(contour, context.canvas.width, context.canvas.height);
  const tempCanvas = document.createElement("canvas");
  const scale = 0.12;
  tempCanvas.width = Math.max(6, Math.floor(box.width * scale));
  tempCanvas.height = Math.max(6, Math.floor(box.height * scale));
  const tempContext = tempCanvas.getContext("2d");

  if (!tempContext) {
    return;
  }

  tempContext.imageSmoothingEnabled = false;
  tempContext.drawImage(
    video,
    box.x,
    box.y,
    box.width,
    box.height,
    0,
    0,
    tempCanvas.width,
    tempCanvas.height
  );

  context.save();
  traceContour(context, contour);
  context.clip();
  context.imageSmoothingEnabled = false;
  context.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, box.x, box.y, box.width, box.height);
  context.restore();
}

function drawBlurredFace(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  contour: Point[]
) {
  context.save();
  traceContour(context, contour);
  context.clip();
  context.filter = "blur(18px)";
  context.drawImage(video, 0, 0, context.canvas.width, context.canvas.height);
  context.restore();
}

function drawMaskFace(context: CanvasRenderingContext2D, contour: Point[]) {
  const box = getFaceBounds(contour, context.canvas.width, context.canvas.height);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  context.save();
  traceContour(context, contour);
  context.fillStyle = "rgba(6, 182, 212, 0.85)";
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = "rgba(255,255,255,0.72)";
  context.stroke();

  context.beginPath();
  context.arc(centerX - box.width * 0.16, centerY - box.height * 0.08, box.width * 0.05, 0, Math.PI * 2);
  context.arc(centerX + box.width * 0.16, centerY - box.height * 0.08, box.width * 0.05, 0, Math.PI * 2);
  context.fillStyle = "#05273d";
  context.fill();

  context.beginPath();
  context.arc(centerX, centerY + box.height * 0.16, box.width * 0.18, 0, Math.PI);
  context.strokeStyle = "#05273d";
  context.lineWidth = 5;
  context.stroke();
  context.restore();
}

function drawAvatarFace(
  context: CanvasRenderingContext2D,
  contour: Point[],
  uploadedImage: HTMLImageElement | null
) {
  const box = getFaceBounds(contour, context.canvas.width, context.canvas.height);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  context.save();
  traceContour(context, contour);
  context.clip();

  if (uploadedImage) {
    context.drawImage(uploadedImage, box.x - box.width * 0.08, box.y - box.height * 0.08, box.width * 1.16, box.height * 1.16);
  } else {
    const gradient = context.createLinearGradient(box.x, box.y, box.x + box.width, box.y + box.height);
    gradient.addColorStop(0, "#fb7185");
    gradient.addColorStop(1, "#818cf8");
    context.fillStyle = gradient;
    context.fillRect(box.x, box.y, box.width, box.height);
    context.fillStyle = "rgba(255,255,255,0.82)";
    context.fillRect(box.x + box.width * 0.24, box.y + box.height * 0.28, box.width * 0.12, box.height * 0.08);
    context.fillRect(box.x + box.width * 0.64, box.y + box.height * 0.28, box.width * 0.12, box.height * 0.08);
    context.beginPath();
    context.arc(centerX, centerY + box.height * 0.1, box.width * 0.18, 0, Math.PI);
    context.strokeStyle = "rgba(255,255,255,0.9)";
    context.lineWidth = 6;
    context.stroke();
  }

  context.restore();
}

export function useTransformedCamera({
  styleId,
  uploadedImageDataUrl
}: UseTransformedCameraOptions): UseTransformedCameraResult {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [detectionMode, setDetectionMode] = useState<"mediapipe" | "fallback">("fallback");

  const uploadedImagePromise = useMemo(() => {
    if (!uploadedImageDataUrl) {
      return Promise.resolve(null);
    }

    return new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = uploadedImageDataUrl;
    });
  }, [uploadedImageDataUrl]);

  useEffect(() => {
    let cancelled = false;
    let animationFrameId = 0;
    let rawStream: MediaStream | null = null;
    let canvasStream: MediaStream | null = null;
    let faceContour: Point[] | null = null;
    let lastDetectionTime = 0;
    let faceLandmarker: FaceLandmarker | null = null;

    const canvas = previewRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      setStatus("error");
      setError("Could not initialize local video processing.");
      return;
    }

    setStatus("starting");
    setError(null);
    setProcessedStream(null);

    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    const loadFaceLandmarker = async () => {
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_MODEL_URL
        },
        numFaces: 1,
        runningMode: "VIDEO"
      });
    };

    const detectFace = async () => {
      if (!faceLandmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }

      try {
        const detectionResult = faceLandmarker.detectForVideo(video, performance.now());
        const landmarks = detectionResult.faceLandmarks[0];

        if (landmarks) {
          faceContour = createContourFromLandmarks(landmarks, canvas.width, canvas.height);
          setDetectionMode("mediapipe");
        } else {
          faceContour = null;
          setDetectionMode("fallback");
        }
      } catch {
        faceContour = null;
        setDetectionMode("fallback");
      }
    };

    const renderFrame = async (uploadedImage: HTMLImageElement | null) => {
      if (cancelled) {
        return;
      }

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        if (!canvas.width || !canvas.height) {
          canvas.width = video.videoWidth || 960;
          canvas.height = video.videoHeight || 720;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const shouldDetect = performance.now() - lastDetectionTime >= DETECTION_INTERVAL_MS;

        if (shouldDetect) {
          lastDetectionTime = performance.now();
          void detectFace();
        }

        const contour = faceContour ?? createFallbackFaceContour(canvas.width, canvas.height);

        switch (styleId) {
          case "pixelate":
            drawPixelatedFace(context, video, contour);
            break;
          case "silhouette":
            drawMaskFace(context, contour);
            break;
          case "avatar":
            drawAvatarFace(context, contour, uploadedImage);
            break;
          case "blur":
          default:
            drawBlurredFace(context, video, contour);
            break;
        }
      }

      animationFrameId = window.requestAnimationFrame(() => {
        void renderFrame(uploadedImage);
      });
    };

    const start = async () => {
      try {
        rawStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user"
          },
          audio: false
        });

        if (cancelled) {
          return;
        }

        video.srcObject = rawStream;
        await video.play();
        faceLandmarker = await loadFaceLandmarker();

        const uploadedImage = await uploadedImagePromise;

        canvasStream = canvas.captureStream(24);
        setProcessedStream(canvasStream);
        setStatus("ready");

        void renderFrame(uploadedImage);
      } catch (caughtError) {
        setStatus("error");
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not start your camera. Check browser permissions and try again."
        );
      }
    };

    void start();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrameId);
      rawStream?.getTracks().forEach((track) => track.stop());
      canvasStream?.getTracks().forEach((track) => track.stop());
      faceLandmarker?.close();
      video.pause();
      video.srcObject = null;
    };
  }, [styleId, uploadedImagePromise]);

  return {
    previewRef,
    processedStream,
    status,
    error,
    detectionMode
  };
}
