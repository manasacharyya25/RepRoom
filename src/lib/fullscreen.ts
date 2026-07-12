export async function enterFullscreen() {
  if (typeof document === "undefined") return;
  if (document.fullscreenElement) return;

  try {
    await document.documentElement.requestFullscreen();
  } catch {
    // Fullscreen may be blocked without a user gesture or by browser policy.
  }
}

export async function exitFullscreen() {
  if (typeof document === "undefined") return;
  if (!document.fullscreenElement) return;

  try {
    await document.exitFullscreen();
  } catch {
    // Ignore if the browser already exited fullscreen.
  }
}

export function isFullscreenActive() {
  if (typeof document === "undefined") return false;
  return Boolean(document.fullscreenElement);
}

export async function toggleFullscreen() {
  if (isFullscreenActive()) {
    await exitFullscreen();
    return;
  }
  await enterFullscreen();
}
