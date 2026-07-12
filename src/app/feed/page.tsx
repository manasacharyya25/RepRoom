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
        <nav className="landing-nav-links" aria-label="Main">
          <Link href="/feed">Feed</Link>
          <Link href="/rooms">Rooms</Link>
        </nav>
        <div className="landing-nav-actions">
          <ThemeSwitch />
          <Link className="btn-ghost" href="/rooms">
            My Rooms
          </Link>
          <Link className="btn-primary" href="/rooms">
            Getting started
          </Link>
        </div>
      </header>

      <main className="feed-page-main">
        <CommunityFeed className="feed-page-panel" />
      </main>
    </div>
  );
}
