import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = {
  title: "Community Guidelines — RhoQ",
  description:
    "Rules for staying safe and respectful on RhoQ, including a clear ban on NSFW content."
};

export default function CommunityGuidelinesPage() {
  return (
    <LegalPage
      path="/community-guidelines"
      title="Community Guidelines"
      updated="July 24, 2026"
    >
      <p>
        RhoQ is built for people who want to work out together and motivate
        each other. These guidelines keep rooms, the feed, and chat focused on
        fitness and mutual support. Nudity, sexual content, pornography, and
        any other NSFW material are not allowed anywhere on the platform.
      </p>

      <h2>Be respectful</h2>
      <ul>
        <li>Encourage others. Harassment, bullying, hate speech, and threats are not allowed.</li>
        <li>Respect boundaries in live rooms and private messages.</li>
        <li>Do not impersonate others or misrepresent who you are.</li>
      </ul>

      <h2>Keep it fitness-first</h2>
      <ul>
        <li>Share workouts, progress, tips, and motivation that help the community.</li>
        <li>Stay on topic in live rooms so sessions remain useful for everyone.</li>
        <li>No spam, scams, or promotional flooding.</li>
      </ul>

      <h2>No NSFW</h2>
      <p>
        Nudity, sexual content, pornography, fetish content, and any other NSFW
        material are strictly prohibited — including suggestive camera framing
        intended for sexual attention rather than training.
      </p>
      <ul>
        <li>Wear appropriate workout clothing on camera and in photos.</li>
        <li>Do not post or stream sexual audio, text, or imagery.</li>
        <li>Do not solicit or share NSFW content with other members.</li>
      </ul>

      <h2>Safety and legality</h2>
      <ul>
        <li>Do not share others’ personal information without consent.</li>
        <li>Do not engage in illegal activity or encourage self-harm.</li>
        <li>Report violations so we can review them quickly.</li>
      </ul>

      <h2>Enforcement</h2>
      <p>
        We may remove content, limit features, or suspend or ban accounts that
        break these guidelines. Serious or repeated NSFW violations may result
        in an immediate permanent ban.
      </p>
    </LegalPage>
  );
}
