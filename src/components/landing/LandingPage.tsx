import Link from "next/link";
import "@/app/landing.css";
import { FeedShareCarousel } from "@/components/landing/FeedShareCarousel";
import { HeroLivePreview } from "@/components/landing/HeroLivePreview";

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
        </div>

        <HeroLivePreview />
      </section>

      <section className="landing-section feed-section" id="feed">
        <FeedShareCarousel />
      </section>

      <section className="landing-cta-band">
        <Link className="btn-primary btn-primary-lg" href="/login">
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
