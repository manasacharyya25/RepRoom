import Link from "next/link";
import { CommunityFeed } from "@/components/feed/CommunityFeed";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import "@/app/landing.css";
import "@/app/feed.css";

export default function FeedPage() {
  return (
    <div className="feed-page">
      <header className="landing-nav">
        <Link className="landing-logo" href="/">
          <span className="landing-logo-mark" aria-hidden>
            S
          </span>
          Satara
        </Link>
        <div className="landing-nav-actions">
          <ThemeSwitch />
          <Link className="btn-ghost" href="/rooms">
            Rooms
          </Link>
          <Link className="btn-primary" href="/">
            Profile
          </Link>
        </div>
      </header>

      <main className="feed-page-main">
        <CommunityFeed allowComments enableLoadMore className="feed-page-panel" />
      </main>
    </div>
  );
}
