import Link from "next/link";
import "@/app/landing.css";
import { Logo } from "@/components/brand/Logo";
import { FeedShareCarousel } from "@/components/landing/FeedShareCarousel";
import { HeroLivePreview } from "@/components/landing/HeroLivePreview";
import { WaitlistForm } from "@/components/landing/WaitlistForm";

type LandingPageProps = {
  waitlistMode?: boolean;
};

export function LandingPage({ waitlistMode = false }: LandingPageProps) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo showMark={false} />
        {waitlistMode ? (
          <p className="landing-nav-waitlist">Coming soon</p>
        ) : (
          <div className="landing-nav-actions">
            <Link className="btn-secondary" href="/login">
              Log in
            </Link>
            <Link className="btn-primary" href="/feed">
              Get Started
            </Link>
          </div>
        )}
      </header>

      <section className="landing-hero">
        <div>
          <h1>Work out together. Motivate each other.</h1>
          <p className="landing-description">
            Fitness is easier together. Join live Strength Training, Yoga, and
            Zumba sessions, connect with people who inspire you, celebrate your
            progress, and stay accountable every step of the way.
          </p>
        </div>

        <HeroLivePreview />
      </section>

      {waitlistMode ? (
        <section className="landing-waitlist-strip" aria-label="Join waitlist">
          <div className="landing-waitlist-strip-inner">
            <h2>Get early access</h2>
            <p>Leave your email — we’ll invite you when RhoQ opens.</p>
            <WaitlistForm source="landing-mid" size="large" />
          </div>
        </section>
      ) : null}

      <section className="landing-section feed-section" id="feed">
        <FeedShareCarousel />
      </section>

      {waitlistMode ? null : (
        <section className="landing-cta-band">
          <Link className="btn-primary btn-primary-lg" href="/feed">
            Get Started Now
          </Link>
        </section>
      )}

      <footer className="landing-footer">
        <span>Rhoq Fitness</span>
        {waitlistMode ? null : (
          <>
            <Link href="/rooms">Rooms</Link>
            <Link href="/feed">Feed</Link>
          </>
        )}
        <Link href="/about">About Us</Link>
        <Link href="/community-guidelines">Community Guidelines</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
        <Link href="/credits">Credits</Link>
      </footer>
    </div>
  );
}
