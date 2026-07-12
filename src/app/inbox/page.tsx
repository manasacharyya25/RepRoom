"use client";

import { useRouter } from "next/navigation";
import { AppNav } from "@/components/nav/AppNav";
import { ProfilePage } from "@/components/profile/ProfilePage";
import "@/app/landing.css";
import "@/app/feed.css";
import "@/app/profile.css";
import "@/app/inbox.css";

export default function InboxPage() {
  const router = useRouter();

  return (
    <div className="profile-shell">
      <AppNav
        variant="profile"
        defaultInboxOpen
        onInboxClose={() => router.replace("/profile")}
      />
      <main className="profile-main">
        <ProfilePage />
      </main>
    </div>
  );
}
