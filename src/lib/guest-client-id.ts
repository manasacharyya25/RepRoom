/** Browser-side guest id mirror (cookie may be blocked / cleared). */
export const GUEST_CLIENT_STORAGE_KEY = "satara_guest_id";

function isUsableGuestId(value: string | null | undefined): value is string {
  return Boolean(value && value.trim().length >= 8);
}

export function getOrCreateClientGuestId(): string {
  if (typeof window === "undefined") return "";

  try {
    const existing = window.localStorage.getItem(GUEST_CLIENT_STORAGE_KEY);
    if (isUsableGuestId(existing)) return existing.trim();

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(GUEST_CLIENT_STORAGE_KEY, id);
    return id;
  } catch {
    return "";
  }
}

/** Keep localStorage in sync with the server-canonical guest id. */
export function syncClientGuestId(guestId: string | null | undefined) {
  if (typeof window === "undefined" || !isUsableGuestId(guestId)) return;
  try {
    window.localStorage.setItem(GUEST_CLIENT_STORAGE_KEY, guestId.trim());
  } catch {
    /* private mode / blocked storage */
  }
}
