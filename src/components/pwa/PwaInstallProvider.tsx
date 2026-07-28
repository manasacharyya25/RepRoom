"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaInstallContextValue = {
  /** True when running as an installed PWA / standalone. */
  isStandalone: boolean;
  /** Chrome/Edge deferred install prompt is available. */
  canInstall: boolean;
  /** iPhone / iPad (any browser). */
  isIos: boolean;
  /** Likely phone/tablet viewport — show install CTA even without native prompt. */
  isMobile: boolean;
  /** Hide the CTA after dismiss or successful install. */
  dismissed: boolean;
  dismiss: () => void;
  install: () => Promise<boolean>;
};

const STORAGE_KEY = "rhoq_pwa_install_dismissed";

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

function detectStandalone() {
  if (typeof window === "undefined") return false;
  const media = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in window.navigator &&
    Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone
    );
  return media || iosStandalone;
}

function detectIos() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function detectMobile() {
  if (typeof window === "undefined") return false;
  if (detectIos()) return true;
  if (window.matchMedia("(max-width: 960px)").matches) return true;
  if (window.matchMedia("(pointer: coarse)").matches) return true;
  return /Android|Mobile/i.test(window.navigator.userAgent);
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );

  useEffect(() => {
    setIsStandalone(detectStandalone());
    setIsIos(detectIos());
    setIsMobile(detectMobile());
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW optional in dev / unsupported contexts */
      });
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    const onInstalled = () => {
      setCanInstall(false);
      setDeferred(null);
      setIsStandalone(true);
    };

    const syncMobile = () => setIsMobile(detectMobile());
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("resize", syncMobile);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("resize", syncMobile);
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    setCanInstall(false);
    if (choice.outcome === "accepted") {
      setIsStandalone(true);
      return true;
    }
    return false;
  }, [deferred]);

  const value = useMemo<PwaInstallContextValue>(
    () => ({
      isStandalone,
      canInstall,
      isIos,
      isMobile,
      dismissed,
      dismiss,
      install
    }),
    [isStandalone, canInstall, isIos, isMobile, dismissed, dismiss, install]
  );

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
    </PwaInstallContext.Provider>
  );
}

export function usePwaInstall() {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) {
    throw new Error("usePwaInstall must be used within PwaInstallProvider");
  }
  return ctx;
}
