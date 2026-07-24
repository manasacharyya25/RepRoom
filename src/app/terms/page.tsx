import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = {
  title: "Terms of Service — RhoQ",
  description:
    "Terms for using RhoQ, including account rules and a ban on NSFW content."
};

export default function TermsOfServicePage() {
  return (
    <LegalPage path="/terms" title="Terms of Service" updated="July 24, 2026">
      <p>
        These Terms of Service (“Terms”) govern your use of RhoQ. By creating an
        account or using the service, you agree to these Terms and our Community
        Guidelines, including that NSFW content is not allowed on the platform.
      </p>

      <h2>The service</h2>
      <p>
        RhoQ provides live workout rooms, a community feed, and related features
        so people can train together and stay motivated. Features may change as
        we improve the product.
      </p>

      <h2>Eligibility and accounts</h2>
      <ul>
        <li>You must be able to form a binding contract in your jurisdiction.</li>
        <li>Provide accurate account information and keep your credentials secure.</li>
        <li>You are responsible for activity that occurs under your account.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Post, stream, share, or solicit NSFW content — including nudity,
          sexual content, pornography, or sexually explicit material of any kind.
        </li>
        <li>Harass, threaten, or abuse other users.</li>
        <li>Upload illegal, harmful, or infringing content.</li>
        <li>Interfere with the service, scrape without permission, or attempt unauthorized access.</li>
        <li>Use RhoQ for spam, scams, or commercial abuse outside allowed features.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You retain ownership of content you submit. You grant RhoQ a worldwide,
        non-exclusive license to host, store, display, and distribute that
        content as needed to operate and improve the service. You represent that
        you have the rights to share what you post or stream.
      </p>

      <h2>Enforcement</h2>
      <p>
        We may remove content or suspend or terminate accounts that violate these
        Terms or our Community Guidelines. NSFW violations may result in
        immediate permanent removal without prior notice.
      </p>

      <h2>Disclaimers</h2>
      <p>
        RhoQ is provided “as is.” Fitness activities carry risk; you are
        responsible for your own health and safety while training. We do not
        provide medical advice.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, RhoQ and its operators are not
        liable for indirect, incidental, or consequential damages arising from
        your use of the service.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms from time to time. Continued use after changes
        take effect means you accept the updated Terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms can be sent through RhoQ’s published support
        or contact channels.
      </p>
    </LegalPage>
  );
}
