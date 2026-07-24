"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import {
  GUEST_VIEW_SECONDS,
  type Tier
} from "@/lib/entitlements";
import { getGuestViewRemainingSeconds } from "@/lib/guest-view-quota";
import {
  getOrCreateClientGuestId,
  syncClientGuestId
} from "@/lib/guest-client-id";

type EntitlementsContextValue = {
  tier: Tier;
  remainingSeconds: number | null;
  quotaSeconds: number;
  /** True after at least one status response for the current auth identity. */
  statusReady: boolean;
  setTier: (tier: Tier) => void;
  setRemainingSeconds: (seconds: number | null) => void;
  refreshStatus: () => Promise<void>;
};

const EntitlementsContext = createContext<EntitlementsContextValue | null>(
  null
);

export function useEntitlements() {
  const value = useContext(EntitlementsContext);
  if (!value) {
    throw new Error("useEntitlements must be used within EntitlementsProvider");
  }
  return value;
}

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const { authReady, isSignedIn, user } = useAuth();
  const [tier, setTier] = useState<Tier>("guest");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [quotaSeconds, setQuotaSeconds] = useState(0);
  const [statusReady, setStatusReady] = useState(false);
  const lastUserIdRef = useRef<string | null | undefined>(undefined);

  const refreshStatus = useCallback(async () => {
    const fingerprint = await getDeviceFingerprint();
    const clientGuestId = getOrCreateClientGuestId();
    const params = new URLSearchParams({
      fingerprint,
      ...(clientGuestId ? { clientGuestId } : {})
    });
    const response = await fetch(`/api/room-access/status?${params}`);
    if (!response.ok) return;
    const data = (await response.json()) as {
      tier?: Tier;
      remainingSeconds?: number | null;
      quotaSeconds?: number;
      guestId?: string | null;
    };
    syncClientGuestId(data.guestId);
    const nextTier = data.tier ?? "guest";
    setTier(nextTier);

    if (nextTier === "guest") {
      setRemainingSeconds(getGuestViewRemainingSeconds());
      setQuotaSeconds(GUEST_VIEW_SECONDS);
    } else {
      setRemainingSeconds(
        data.remainingSeconds === undefined ? null : data.remainingSeconds
      );
      setQuotaSeconds(data.quotaSeconds ?? 0);
    }
    setStatusReady(true);
  }, []);

  useEffect(() => {
    if (!authReady) return;

    const userId = user?.id ?? null;
    if (lastUserIdRef.current !== userId) {
      lastUserIdRef.current = userId;
      setStatusReady(false);
      if (isSignedIn) {
        setTier("free");
        setRemainingSeconds(null);
      } else {
        setTier("guest");
        setRemainingSeconds(getGuestViewRemainingSeconds());
        setQuotaSeconds(GUEST_VIEW_SECONDS);
      }
    }

    let cancelled = false;
    void (async () => {
      try {
        await refreshStatus();
      } catch {
        if (!cancelled) {
          setTier(isSignedIn ? "free" : "guest");
          if (!isSignedIn) {
            setRemainingSeconds(getGuestViewRemainingSeconds());
            setQuotaSeconds(GUEST_VIEW_SECONDS);
          }
          setStatusReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, isSignedIn, user?.id, refreshStatus]);

  const value = useMemo(
    () => ({
      tier,
      remainingSeconds,
      quotaSeconds,
      statusReady,
      setTier,
      setRemainingSeconds,
      refreshStatus
    }),
    [tier, remainingSeconds, quotaSeconds, statusReady, refreshStatus]
  );

  return (
    <EntitlementsContext.Provider value={value}>
      {children}
    </EntitlementsContext.Provider>
  );
}
