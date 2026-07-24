import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = {
  title: "Privacy Policy — RhoQ",
  description: "How RhoQ collects, uses, and protects your information."
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage path="/privacy" title="Privacy Policy" updated="July 24, 2026">
      <p>
        This Privacy Policy explains how RhoQ (“we”, “us”) handles information
        when you use our website and services. RhoQ does not allow NSFW content;
        we may process reports and related data to enforce that rule.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> — such as name, email, username, and
          profile information you provide when you sign up or edit your profile.
        </li>
        <li>
          <strong>Content you create</strong> — posts, messages, live session
          media (including video captured while you go live), and other material
          you upload or stream.
        </li>
        <li>
          <strong>Usage data</strong> — room activity, feature use, device and
          browser information, and approximate location derived from IP address.
        </li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To operate live rooms, the feed, messaging, and your account.</li>
        <li>
          Video captured during live sessions may be stored and used for replay
          on RhoQ (for example, showing recent sessions in rooms or discovery).
        </li>
        <li>To improve product performance, safety, and reliability.</li>
        <li>To enforce our Community Guidelines and Terms of Service, including our no-NSFW policy.</li>
        <li>To communicate about your account, security, and important service updates.</li>
      </ul>

      <h2>Sharing</h2>
      <p>
        We do not sell your personal information. We may share data with service
        providers who help us run RhoQ (for example hosting, authentication, or
        storage), when required by law, or to protect users and the platform.
      </p>

      <h2>Content moderation and safety</h2>
      <p>
        To keep RhoQ free of NSFW and other prohibited material, we may review
        reports, remove content, and retain related records as needed for
        enforcement and safety.
      </p>

      <h2>Data retention</h2>
      <p>
        We keep information as long as your account is active or as needed to
        provide the service, comply with legal obligations, resolve disputes,
        and enforce our policies.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>You can update profile information in your account settings.</li>
        <li>You may request account deletion subject to applicable law and retention needs.</li>
        <li>Browser controls may limit certain cookies or local storage used for sessions.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        For privacy questions, reach out through the contact options published
        on RhoQ or via your account support channel.
      </p>
    </LegalPage>
  );
}
