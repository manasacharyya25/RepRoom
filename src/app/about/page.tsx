import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = {
  title: "About Us — RhoQ",
  description:
    "RhoQ is a live fitness community where people work out together, stay accountable, and motivate each other."
};

export default function AboutPage() {
  return (
    <LegalPage path="/about" title="About Us" updated="August 3, 2026">
      <p>
        RhoQ is built for people who want to work out together. Fitness is
        easier when someone else is showing up with you — live, in the moment,
        with the same goals in mind.
      </p>

      <h2>What we do</h2>
      <p>
        RhoQ brings live workout rooms and a community feed into one place.
        Join Strength Training, Yoga, Zumba, and more sessions with people who
        keep you moving. Share progress, celebrate wins, and stay accountable
        every step of the way.
      </p>

      <h2>Why RhoQ</h2>
      <ul>
        <li>
          Train live with others instead of working out alone on a screen.
        </li>
        <li>
          Find rooms that match how you train — from lifting to yoga to dance.
        </li>
        <li>
          Stay motivated through community: posts, encouragement, and shared
          routines.
        </li>
      </ul>

      <h2>Our focus</h2>
      <p>
        We keep RhoQ fitness-first and respectful. The community exists to help
        people show up, put in the work, and lift each other up — not to
        distract from training.
      </p>

      <p>
        Thanks for being here. Whether you’re just getting started or already
        deep into your routine, we’re glad to train with you.
      </p>
    </LegalPage>
  );
}
