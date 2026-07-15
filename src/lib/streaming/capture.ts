/** Architecture-aligned capture: 360p @ 15fps, video only. */
export const LIVE_CAPTURE_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    width: { ideal: 640 },
    height: { ideal: 360 },
    frameRate: { ideal: 15, max: 15 },
    facingMode: "user"
  }
};

const TARGET_BITRATE_BPS = 600_000;

export async function captureLiveCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera is not supported in this browser.");
  }

  return navigator.mediaDevices.getUserMedia(LIVE_CAPTURE_CONSTRAINTS);
}

export async function applyPublisherBitrate(
  sender: RTCRtpSender,
  maxBitrate = TARGET_BITRATE_BPS
) {
  const params = sender.getParameters();
  if (!params.encodings || params.encodings.length === 0) {
    params.encodings = [{}];
  }
  params.encodings = params.encodings.map((encoding) => ({
    ...encoding,
    maxBitrate
  }));
  await sender.setParameters(params);
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}
