Workout Live Streaming Architecture Implementation Spec
1. High-Level Architecture
                         NEXT.JS APPLICATION

User Browser
    |
    |
Camera Access (getUserMedia)
    |
    |
Client Encoder (H.264)
    |
    |
Stream Upload
    |
    v

                    MEDIA SERVER

              SRS / MediaMTX

    Receives encoded stream
              |
              |
       HLS Packaging
              |
       +------+------+
       |             |
       |             |
   Live HLS       Archive Pipeline
       |             |
       |             |
       v             v

     CDN        Object Storage
       |             |
       |             |
       +------+------+
              |
              v

          Other Users
2. Frontend Implementation (Next.js)
Camera Capture

Use browser Media APIs.

Flow:

navigator.mediaDevices.getUserMedia({
  video: {
    width: 640,
    height: 360,
    frameRate: 15
  },
  audio: false
})

Requirements:

Disable microphone completely.

Request low-resolution video.

Prefer rear camera on mobile if desired.

3. Client Encoding

Target encoding:

Codec:
H264

Resolution:
360p

FPS:
15

Bitrate:
500-600 kbps

Audio:
None

For MVP:

Use MediaRecorder.

Example:

const recorder = new MediaRecorder(stream, {
  mimeType: "video/mp4",
  videoBitsPerSecond: 600000
});

Generate small chunks:

chunk duration:
1-2 seconds

Each chunk should be uploaded immediately.

6. Media Server Setup

Use:

SRS
or

MediaMTX

Responsibilities:

ONLY:

Receive H264 stream

Create HLS segments

Maintain playlist

Do NOT:

Transcode

Resize

Generate multiple qualities

Example:

Incoming:

rtmp://media.example.com/live/user123

Generated:

https://cdn.example.com/live/user123/index.m3u8
7. HLS Configuration

Target:

Segment duration:
2 seconds

Playlist window:
30 seconds

Low latency:
enabled

Example:

playlist:

segment101.ts
segment102.ts
segment103.ts
segment104.ts

Keep only recent segments.

8. Video Player

Use:

hls.js

For React component:

<LiveVideoPlayer />

Input:

{
 hlsUrl,
 quality
}

Default room:

360p streams

Grid:

9 video elements

Each:
muted
autoplay
playsInline
10. Archive Pipeline

When stream starts:

Create archive job.

Example:

stream started
        |
        |
Media Server
        |
        |
Archive Worker
        |
        |
Object Storage

Storage:

Cloudflare R2 recommended.

Structure:

archives/

room_id/

user_id/

session_id/

360p/

playlist.m3u8

segment001.m4s
segment002.m4s


480p/

playlist.m3u8

segment001.m4s
11. Archive Cleanup

Maintain maximum:

1000 hours

Background job:

Runs daily:

calculate total archive duration

if >1000 hours:

delete oldest sessions
14. Infrastructure

Initial deployment:

Next.js
    |
Vercel

Supabase
    |
Postgres/Auth

Media Server
    |
Dedicated VPS

Archive Storage
    |
Cloudflare R2

CDN
    |
Cloudflare
15. MVP Development Order

Do not build everything at once.

Build in this order:

Phase 1

Single user:

Camera
↓
Encode
↓
Media Server
↓
HLS
↓
Play
Phase 2

Multiple users:

Room
↓
Multiple streams
↓
Grid playback
Phase 3

Quality switching:

360p grid
480p focus
Phase 4

Archive:

Live stream
↓
Save
↓
Replay
Phase 5

Room population:

Live + archived participants

This should give Cursor enough context to generate the implementation without drifting into a completely different architecture. I would specifically tell Cursor: "Do not introduce WebRTC SFU, LiveKit, Agora, or server-side transcoding. The architecture decision is already made."