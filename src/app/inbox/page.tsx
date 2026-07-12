import { AppNav } from "@/components/nav/AppNav";
import "@/app/landing.css";
import "@/app/feed.css";

export default function InboxPage() {
  return (
    <div className="feed-page">
      <AppNav variant="feed" />
      <main className="feed-page-main">
        <section className="inbox-empty">
          <h1>Inbox</h1>
          <p>No messages yet. Check back after you join a room.</p>
        </section>
      </main>
    </div>
  );
}
