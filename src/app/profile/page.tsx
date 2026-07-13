import { AppNav } from "@/components/nav/AppNav";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { getCurrentProfileView } from "@/lib/profile-data";
import "@/app/landing.css";
import "@/app/feed.css";
import "@/app/profile.css";

export default async function ProfileRoutePage() {
  const profileData = await getCurrentProfileView();

  return (
    <div className="profile-shell">
      <AppNav variant="profile" />
      <main className="profile-main">
        <ProfilePage initialData={profileData} />
      </main>
    </div>
  );
}
