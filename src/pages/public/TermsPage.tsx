import { LegalPage } from "@/components/public/PublicShell";
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="April 2026">
      <p>By creating an account on NexusEdu, you agree to use the platform for personal HSC preparation and not to redistribute or resell content.</p>
      <h2>Account</h2>
      <p>You're responsible for keeping your login credentials safe. One account per person.</p>
      <h2>Content access</h2>
      <p>Some chapters are gated behind enrollment codes. Codes are device-bound and non-transferable.</p>
      <h2>Conduct</h2>
      <p>No scraping, screen-recording for redistribution, or sharing of paid content. Violations result in account suspension.</p>
    </LegalPage>
  );
}
