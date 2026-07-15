/** Single quality: 360p @ 15–20fps, video only. */
export const LIVE_CAPTURE_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    width: { ideal: 640, max: 640 },
    height: { ideal: 360, max: 360 },
    frameRate: { ideal: 15, min: 15, max: 20 },
    facingMode: "user"
  }
};

const TRACK_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640, max: 640 },
  height: { ideal: 360, max: 360 },
  frameRate: { ideal: 15, min: 15, max: 20 }
};

const TARGET_BITRATE_BPS = 600_000;
const TARGET_MAX_FRAMERATE = 20;

export async function captureLiveCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera is not supported in this browser.");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(LIVE_CAPTURE_CONSTRAINTS);
  } catch {
    // Some devices reject min frameRate; retry without min.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: 640, max: 640 },
        height: { ideal: 360, max: 360 },
        frameRate: { ideal: 15, max: 20 },
        facingMode: "user"
      }
    });
  }

  const track = stream.getVideoTracks()[0];
  if (track) {
    try {
      await track.applyConstraints(TRACK_CONSTRAINTS);
    } catch {
      try {
        await track.applyConstraints({
          width: { ideal: 640, max: 640 },
          height: { ideal: 360, max: 360 },
          frameRate: { ideal: 15, max: 20 }
        });
      } catch {
        /* Device may ignore resolution/FPS hints */
      }
    }

    if (process.env.NODE_ENV === "development") {
      const settings = track.getSettings();
      console.info("[live-capture]", {
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate
      });
    }
  }

  return stream;
}

/** Cap WHIP encode bitrate and FPS so live + archive stay near 360p / 15–20fps. */
export async function applyPublisherEncodeLimits(
  sender: RTCRtpSender,
  options?: { maxBitrate?: number; maxFramerate?: number }
) {
  const maxBitrate = options?.maxBitrate ?? TARGET_BITRATE_BPS;
  const maxFramerate = options?.maxFramerate ?? TARGET_MAX_FRAMERATE;
  const params = sender.getParameters();
  if (!params.encodings || params.encodings.length === 0) {
    params.encodings = [{}];
  }
  params.encodings = params.encodings.map((encoding) => ({
    ...encoding,
    maxBitrate,
    maxFramerate
  }));
  await sender.setParameters(params);
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}
