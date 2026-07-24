import Link from "next/link";
import "@/app/landing.css";
import { Logo } from "@/components/brand/Logo";
import { FeedShareCarousel } from "@/components/landing/FeedShareCarousel";
import { HeroLivePreview } from "@/components/landing/HeroLivePreview";

export function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo showMark={false} />
        <div className="landing-nav-actions">
          <Link className="btn-secondary" href="/login">
            Log in
          </Link>
          <Link className="btn-primary" href="/feed">
            Get Started
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div>
          <h1>Work out together. Motivate each other.</h1>
          <p className="landing-description">
          Fitness is easier together. Join live Strength 
          Training, Yoga, and Zumba sessions, connect with 
          people who inspire you, celebrate your progress, 
          and stay accountable every step of the way.
          </p>
        </div>

        <HeroLivePreview />
      </section>

      <section className="landing-section feed-section" id="feed">
        <FeedShareCarousel />
      </section>

      <section className="landing-cta-band">
        <Link className="btn-primary btn-primary-lg" href="/feed">
          Get Started Now
        </Link>
      </section>

      <footer className="landing-footer">
        <span>Rhoq Fitness</span>
        <Link href="/rooms">Rooms</Link>
        <Link href="/feed">Feed</Link>
        <Link href="/community-guidelines">Community Guidelines</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
      </footer>
    </div>
  );
}
