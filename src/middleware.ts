import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  clearOnboardingCompleteCookie,
  ONBOARDING_COMPLETE_COOKIE,
  readOnboardingCompleteCookie,
  setOnboardingCompleteCookie
} from "@/lib/onboarding-status-cookie";
import { isWaitlistMode } from "@/lib/waitlist";

const AUTH_REQUIRED_PREFIXES = [
  "/profile",
  "/inbox",
  "/onboarding",
  "/u"
];

const GUEST_ALLOWED_PREFIXES = ["/rooms", "/feed"];

const WAITLIST_ALLOWED_PATHS = new Set([
  "/",
  "/privacy",
  "/terms",
  "/community-guidelines",
  "/credits",
  "/sitemap.xml",
  "/robots.txt"
]);

const WAITLIST_ALLOWED_PREFIXES = [
  "/api/waitlist",
  "/onboard",
  "/api/onboarding-record",
  "/rhoq-admin",
  "/api/rhoq-admin",
  "/api/billing",
  "/billing"
];

function isWaitlistAllowed(pathname: string): boolean {
  if (WAITLIST_ALLOWED_PATHS.has(pathname)) return true;
  return WAITLIST_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { supabase, supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (isWaitlistMode()) {
    if (isWaitlistAllowed(pathname)) {
      return supabaseResponse;
    }
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  const requiresAuth = AUTH_REQUIRED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  const isAppSurface = GUEST_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (requiresAuth && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!user) {
    if (request.cookies.has(ONBOARDING_COMPLETE_COOKIE)) {
      clearOnboardingCompleteCookie(supabaseResponse);
    }
  }

  let onboardingComplete = true;

  if (user) {
    if (await readOnboardingCompleteCookie(request, user.id)) {
      onboardingComplete = true;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("id", user.id)
        .maybeSingle();

      onboardingComplete = Boolean(profile?.onboarding_completed_at);
      if (!profile) {
        onboardingComplete = false;
      }

      if (onboardingComplete) {
        await setOnboardingCompleteCookie(supabaseResponse, user.id);
      } else {
        clearOnboardingCompleteCookie(supabaseResponse);
      }
    }
  }

  if (
    user &&
    !onboardingComplete &&
    pathname !== "/onboarding" &&
    !pathname.startsWith("/auth") &&
    (requiresAuth || isAppSurface)
  ) {
    const onboardingUrl = request.nextUrl.clone();
    onboardingUrl.pathname = "/onboarding";
    onboardingUrl.search = "";
    return NextResponse.redirect(onboardingUrl);
  }

  if (pathname === "/login" && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = onboardingComplete ? "/rooms" : "/onboarding";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname === "/onboarding" && user && onboardingComplete) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/rooms";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|videos/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|mov)$).*)"
  ]
};
