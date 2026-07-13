import Image from "next/image";
import Link from "next/link";
import "@/app/landing.css";
import { CommunityFeed } from "@/components/feed/CommunityFeed";
import { HeroLivePreview } from "@/components/landing/HeroLivePreview";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { LIVE_IMAGES } from "@/lib/live-images";

const FEED_FEATURES = [
  {
    id: "progress",
    eyebrow: "Before / after transformation posts",
    title: "Share Your Progress",
    cta: "Share",
    href: "/feed",
    image: LIVE_IMAGES.participant2,
    secondaryImage: LIVE_IMAGES.participant4,
    variant: "split" as const
  },
  {
    id: "feedback",
    eyebrow: "Fit checks and pump checks",
    title: "Get Feedback",
    cta: "Post Form",
    href: "/feed",
    image: LIVE_IMAGES.participant3,
    variant: "single" as const
  },
  {
    id: "fuel",
    eyebrow: "Meal prep and nutrition wins",
    title: "Fuel Your Body",
    cta: "Share Plate",
    href: "/feed",
    image: LIVE_IMAGES.participant8,
    secondaryImage: LIVE_IMAGES.participant1,
    variant: "split" as const
  },
  {
    id: "consistent",
    eyebrow: "Streaks, weight checks, and comments",
    title: "Stay Consistent",
    cta: "Update Stats",
    href: "/feed",
    variant: "stats" as const
  }
];

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
        <div className="landing-nav-actions">
          <ThemeSwitch />
          <Link className="btn-secondary" href="/login">
            Sign in
          </Link>
          <Link className="btn-primary" href="/login">
            Get Started
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
            <Link className="btn-primary" href="/login">
              Get Started
            </Link>
            <Link className="btn-secondary" href="/feed">
              Explore the feed
            </Link>
          </div>
          <div className="landing-stats">
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

        <HeroLivePreview />
      </section>

      <section className="landing-section feed-section" id="feed">
        <div className="feed-section-layout">
          <div className="feed-visual">
            <div aria-hidden className="feed-visual-backdrop" />
            <CommunityFeed decorative />
          </div>

          <div className="feed-copy">
            <div aria-hidden className="feed-copy-backdrop">
              <Image
                alt=""
                className="feed-copy-backdrop-image"
                fill
                sizes="(max-width: 960px) 90vw, 560px"
                src="/images/decor/feed-bg.png"
              />
            </div>
            <div className="feed-copy-inner">
              <div className="feed-copy-top">
                <h2>Share the work between workouts</h2>
                <span aria-hidden className="feed-copy-mark">
                  ⌇
                </span>
              </div>
              <p className="feed-copy-description">
                The feed keeps motivation going when you are not in a live room. Post
                transformations, fit checks, meal prep, pump checks, streaks, and progress —
                then comment, connect, and build a crew that holds you accountable.
              </p>

              <div className="feed-feature-grid">
                {FEED_FEATURES.map((feature) => (
                  <article className="feed-feature-card" key={feature.id}>
                    <div
                      className={`feed-feature-media${feature.variant === "stats" ? " feed-feature-media--stats" : ""}`}
                    >
                      {feature.variant === "split" && feature.image && feature.secondaryImage ? (
                        <div className="feed-feature-split">
                          <div className="feed-feature-half">
                            <Image
                              alt=""
                              className="feed-feature-image"
                              fill
                              sizes="140px"
                              src={feature.image}
                            />
                          </div>
                          <div className="feed-feature-half">
                            <Image
                              alt=""
                              className="feed-feature-image"
                              fill
                              sizes="140px"
                              src={feature.secondaryImage}
                            />
                          </div>
                        </div>
                      ) : null}

                      {feature.variant === "single" && feature.image ? (
                        <Image
                          alt=""
                          className="feed-feature-image"
                          fill
                          sizes="280px"
                          src={feature.image}
                        />
                      ) : null}

                      {feature.variant === "stats" ? (
                        <div className="feed-feature-stats" aria-hidden>
                          <span className="feed-feature-stat-chip">🔥 21 day streak</span>
                          <span className="feed-feature-stat-chip">⚖ −2.4 kg</span>
                          <span className="feed-feature-stat-chip">🏅 PR week</span>
                          <span className="feed-feature-stat-chip">📅 5 / 7</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="feed-feature-body">
                      <p>{feature.eyebrow}</p>
                      <strong>{feature.title}</strong>
                      <Link className="feed-feature-cta" href={feature.href}>
                        {feature.cta}
                      </Link>
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
