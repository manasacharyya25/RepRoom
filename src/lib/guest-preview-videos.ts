/** YouTube ids for guest room previews (avoids HLS/archive egress). */
export const GUEST_PREVIEW_YOUTUBE_IDS = [
  // Kept from previous set
  "5ODTt006LS4",
  "MOrRRvSGIQc",
  "IKi2QRhYlfs",
  "rRqbCorYi9s",
  // New
  "STq7Sjhni7Y",
  "nuBkG6Darq0",
  "3TZuvI0s0hQ",
  "o1_Wb27MAG0",
  "4H0CIE9ea_o",
  "oZ8qPLYXZ7U",
  "CdgLqt3qGyQ"
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
    color: "white",
    enablejsapi: "1"
  });
  if (typeof window !== "undefined" && window.location?.origin) {
    params.set("origin", window.location.origin);
  }
  // YouTube only honors this reliably when it is the last query param.
  params.set("cc_load_policy", "0");
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}
