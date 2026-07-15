/** Lightweight browser fingerprint for guest multi-device checks (MVP). */
export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "server";

  const parts = [
    navigator.userAgent,
    navigator.language,
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency ?? 0)
  ];

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(0, 0, 120, 40);
      ctx.fillStyle = "#069";
      ctx.fillText("satara", 4, 12);
      parts.push(canvas.toDataURL().slice(-64));
    }
  } catch {
    /* ignore */
  }

  const raw = parts.join("|");
  if (crypto?.subtle) {
    const data = new TextEncoder().encode(raw);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 40);
  }

  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `fp${Math.abs(hash)}`;
}
