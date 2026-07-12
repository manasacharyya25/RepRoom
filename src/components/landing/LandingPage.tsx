import Image from "next/image";
import Link from "next/link";
import "@/app/landing.css";
import { CommunityFeed } from "@/components/feed/CommunityFeed";
import { HERO_PARTICIPANTS, HERO_SIDEBAR_LIVE, LIVE_IMAGES } from "@/lib/live-images";

const TRIBES = [
  {
    id: "hiit",
    name: "6am HIIT Crew",
    members: "2.4k members",
    image: LIVE_IMAGES.participant1
  },
  {
    id: "yoga",
    name: "Sunrise Flow",
    members: "1.8k members",
    image: LIVE_IMAGES.participant2
  },
  {
    id: "zumba",
    name: "Dance Burn",
    members: "980 members",
    image: LIVE_IMAGES.main
  },
  {
    id: "lift",
    name: "Strength Circle",
    members: "3.1k members",
    image: LIVE_IMAGES.participant3
  }
];

const ROOM_TAGS = ["Cardio", "Workout", "Meditation"];

export function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link className="landing-logo" href="/">
          <span className="landing-logo-mark" aria-hidden>
            S
          </span>
          Satara
        </Link>
        <nav className="landing-nav-links" aria-label="Main">
          <Link href="/feed">Feed</Link>
        </nav>
        <div className="landing-nav-actions">
          <button className="btn-ghost" type="button">
            Log in
          </button>
          <Link className="btn-primary" href="/rooms">
            Getting started
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div>
          <h1>Work out together. Motivate each other.</h1>
          <p className="landing-description">
            Satara is a live fitness community where you join real workout rooms
            with others — Yoga, Cardio, Zumba, Workout, and Meditation. Pin the people who
            push you, share progress on the feed, and stay accountable with optional face
            filters when you want privacy.
          </p>
          <div className="landing-cta-row">
            <Link className="btn-primary" href="/rooms">
              Getting started
            </Link>
            <Link className="btn-secondary" href="/feed">
              Explore the feed
            </Link>
          </div>
          <div className="landing-stats">
            <div className="landing-stat">
              <strong>5</strong>
              <span>Live room types</span>
            </div>
            <div className="landing-stat">
              <strong>10 min</strong>
              <span>Free daily access</span>
            </div>
            <div className="landing-stat">
              <strong>24/7</strong>
              <span>Community motivation</span>
            </div>
          </div>
        </div>

        <div className="hero-mock-wrap">
          <div className="hero-room-tags" aria-hidden>
            {ROOM_TAGS.map((tag) => (
              <span className="hero-room-tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
          <div className="hero-mock" aria-hidden>
            <div className="hero-mock-header">
              <span>← Back</span>
              <strong>HIIT Circuit · Room 4</strong>
              <span className="hero-mock-live-count">12 live</span>
            </div>
            <div className="hero-mock-body">
              <div className="hero-mock-main">
                <div className="hero-mock-video">
                  <Image
                    alt=""
                    className="hero-mock-video-image"
                    fill
                    priority
                    sizes="(max-width: 960px) 100vw, 560px"
                    src={LIVE_IMAGES.main}
                  />
                  <span className="hero-mock-live-badge">● Live</span>
                  <span className="hero-mock-tile-label">Coach Maya</span>
                </div>
                <div className="hero-mock-avatars">
                  {HERO_PARTICIPANTS.slice(0, 5).map((participant) => (
                    <div className="hero-mock-avatar" key={participant.name}>
                      <div className="hero-mock-avatar-media">
                        <Image
                          alt=""
                          className="hero-mock-avatar-image"
                          fill
                          sizes="52px"
                          src={participant.image}
                        />
                      </div>
                      <span>{participant.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hero-mock-sidebar">
                {HERO_SIDEBAR_LIVE.map((participant) => (
                  <div className="hero-mock-sidebar-tile" key={participant.name}>
                    <Image
                      alt=""
                      className="hero-mock-sidebar-tile-image"
                      fill
                      sizes="160px"
                      src={participant.image}
                    />
                    <span className="hero-mock-live-badge">● Live</span>
                    <span className="hero-mock-tile-label">{participant.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section feed-section" id="feed">
        <div className="feed-section-layout">
          <CommunityFeed decorative />

          <div className="feed-copy">
            <h2>Share the work between workouts</h2>
            <p className="feed-copy-description">
              The feed keeps motivation going when you are not in a live room. Post
              transformations, fit checks, meal prep, pump checks, streaks, and progress —
              then comment, connect, and build a crew that holds you accountable.
            </p>
            <ul className="feed-feature-list">
              <li>Before / after transformation posts</li>
              <li>Fit checks and pump checks</li>
              <li>Meal prep and nutrition wins</li>
              <li>Streaks, weight checks, and comments</li>
            </ul>

            <div className="tribe-block">
              <h3>Find Your Tribe</h3>
              <div className="tribe-grid">
                {TRIBES.map((tribe) => (
                  <article className="tribe-card" key={tribe.id}>
                    <div className="tribe-card-media">
                      <Image
                        alt=""
                        className="tribe-card-image"
                        fill
                        sizes="180px"
                        src={tribe.image}
                      />
                    </div>
                    <div className="tribe-card-body">
                      <strong>{tribe.name}</strong>
                      <span>{tribe.members}</span>
                      <button className="tribe-join" type="button">
                        Join
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-cta-band">
        <Link className="btn-primary btn-primary-lg" href="/rooms">
          Get Started Now
        </Link>
      </section>

      <footer className="landing-footer">
        <span>Satara Fitness</span>
        <Link href="/feed">Feed</Link>
        <Link href="/rooms">Rooms</Link>
        <Link href="/">Contact</Link>
      </footer>
    </div>
  );
}
