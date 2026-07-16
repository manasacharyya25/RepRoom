/** YouTube ids for guest room previews (avoids HLS/archive egress). */
export const GUEST_PREVIEW_YOUTUBE_IDS = [
  "5ODTt006LS4",
  "MOrRRvSGIQc",
  "IKi2QRhYlfs",
  "rRqbCorYi9s",
  "jKTxe236-4U",
  "7-mVPCVJMtI",
  "uxOP0jKJJPc",
  "NFr-3aAb2Gg",
  "AudPmaQe9AM"
] as const;

export function guestPreviewYoutubeId(slot: number): string {
  const ids = GUEST_PREVIEW_YOUTUBE_IDS;
  return ids[((slot % ids.length) + ids.length) % ids.length];
}

export function youtubeEmbedSrc(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    loop: "1",
    playlist: videoId,
    controls: "0",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
    iv_load_policy: "3",
    disablekb: "1",
    fs: "0",
    color: "white"
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}
