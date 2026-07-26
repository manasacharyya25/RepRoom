export function isWaitlistMode(): boolean {
  const value =
    process.env.WAITLIST_MODE?.trim() ||
    process.env.NEXT_PUBLIC_WAITLIST_MODE?.trim() ||
    "";
  return value === "1" || value.toLowerCase() === "true";
}

export function normalizeWaitlistEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidWaitlistEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
