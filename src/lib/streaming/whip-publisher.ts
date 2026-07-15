import { applyPublisherBitrate } from "@/lib/streaming/capture";

export type WhipPublisher = {
  stop: () => Promise<void>;
};

function waitForIceGatheringComplete(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const onChange = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", onChange);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

/**
 * Publish a local MediaStream to MediaMTX via WHIP.
 * Video only — audio tracks on the stream are ignored.
 */
export async function startWhipPublisher(options: {
  stream: MediaStream;
  whipEndpoint: string;
}): Promise<WhipPublisher> {
  const { stream, whipEndpoint } = options;
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) {
    throw new Error("No video track available to publish.");
  }

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  let resourceUrl: string | null = null;
  let stopped = false;

  const stop = async () => {
    if (stopped) return;
    stopped = true;

    if (resourceUrl) {
      try {
        await fetch(resourceUrl, { method: "DELETE" });
      } catch {
        /* MediaMTX may already have closed the session */
      }
      resourceUrl = null;
    }

    pc.getSenders().forEach((sender) => {
      try {
        pc.removeTrack(sender);
      } catch {
        /* ignore */
      }
    });
    pc.close();
  };

  try {
    const transceiver = pc.addTransceiver(videoTrack, {
      direction: "sendonly",
      streams: [stream]
    });

    // Prefer H.264 when the browser exposes codec preferences.
    const capabilities = RTCRtpSender.getCapabilities?.("video");
    if (capabilities?.codecs?.length && transceiver.setCodecPreferences) {
      const h264 = capabilities.codecs.filter((codec) =>
        /h264/i.test(codec.mimeType)
      );
      const rest = capabilities.codecs.filter(
        (codec) => !/h264/i.test(codec.mimeType)
      );
      if (h264.length > 0) {
        transceiver.setCodecPreferences([...h264, ...rest]);
      }
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGatheringComplete(pc);

    const localSdp = pc.localDescription?.sdp;
    if (!localSdp) {
      throw new Error("Failed to create WHIP offer.");
    }

    const response = await fetch(whipEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/sdp"
      },
      body: localSdp
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        detail.trim() ||
          `WHIP publish failed (${response.status}). Is MediaMTX running?`
      );
    }

    const answerSdp = await response.text();
    const location = response.headers.get("Location");
    if (location) {
      resourceUrl = new URL(location, whipEndpoint).toString();
    }

    await pc.setRemoteDescription({
      type: "answer",
      sdp: answerSdp
    });

    const sender = transceiver.sender;
    if (sender) {
      try {
        await applyPublisherBitrate(sender);
      } catch {
        /* Bitrate hint is best-effort */
      }
    }

    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        void stop();
      }
    });

    return { stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
