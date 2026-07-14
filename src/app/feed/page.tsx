import { CommunityFeed } from "@/components/feed/CommunityFeed";
import { AppNav } from "@/components/nav/AppNav";
import "@/app/landing.css";
import "@/app/feed.css";

export default function FeedPage() {
  return (
    <div className="feed-page">
      <AppNav variant="feed" />
      <main className="feed-page-main">
        <CommunityFeed
          allowComments
          enableLoadMore
          hideHeader
          className="feed-page-panel"
        />
      </main>
    </div>
  );
}
