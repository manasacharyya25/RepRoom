import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";

type TokenRequest = {
  roomName?: string;
  participantName?: string;
};

export async function POST(request: Request) {
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!livekitUrl || !apiKey || !apiSecret) {
    return NextResponse.json(
      {
        error:
          "Missing LiveKit environment variables. Set NEXT_PUBLIC_LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET."
      },
      { status: 500 }
    );
  }

  const body = (await request.json()) as TokenRequest;
  const roomName = body.roomName?.trim();
  const participantName = body.participantName?.trim();

  if (!roomName || !participantName) {
    return NextResponse.json(
      {
        error: "roomName and participantName are required."
      },
      { status: 400 }
    );
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: `${participantName}-${crypto.randomUUID().slice(0, 8)}`,
    name: participantName
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: false,
    canSubscribe: true
  });

  return NextResponse.json({
    token: await token.toJwt(),
    url: livekitUrl
  });
}
