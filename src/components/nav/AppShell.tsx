"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AppNav } from "@/components/nav/AppNav";

function isImmersiveRoomPath(pathname: string) {
  return /^\/rooms\/[^/]+\/?$/.test(pathname);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (isImmersiveRoomPath(pathname)) {
    return <>{children}</>;
  }

  const isFeed = pathname === "/feed" || pathname.startsWith("/feed/");
  const isRoomsList = pathname === "/rooms" || pathname === "/rooms/";
  const isInbox = pathname === "/inbox" || pathname.startsWith("/inbox/");

  if (isRoomsList) {
    return (
      <div className="room-select-page">
        <AppNav variant="rooms" />
        {children}
      </div>
    );
  }

  if (isFeed) {
    return (
      <div className="feed-page">
        <AppNav variant="feed" />
        {children}
      </div>
    );
  }

  return (
    <div className="profile-shell">
      <AppNav
        variant="profile"
        defaultInboxOpen={isInbox}
        onInboxClose={
          isInbox
            ? () => {
                router.replace("/profile");
              }
            : undefined
        }
      />
      {children}
    </div>
  );
}
