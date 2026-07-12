import { AppNav } from "@/components/nav/AppNav";
import { ProfilePage } from "@/components/profile/ProfilePage";
import "@/app/landing.css";
import "@/app/feed.css";
import "@/app/profile.css";

export default function ProfileRoutePage() {
  return (
    <div className="profile-shell">
      <AppNav variant="profile" />
      <main className="profile-main">
        <ProfilePage />
      </main>
    </div>
  );
}
