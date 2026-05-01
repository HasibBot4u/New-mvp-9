import { LegalPage } from "@/components/public/PublicShell";
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="April 2026">
      <p>NexusEdu collects only what's needed to deliver lessons and improve the product: your email, display name, watch progress, and basic device metadata.</p>
      <h2>What we collect</h2>
      <ul><li>Account information (email, display name).</li><li>Watch history & progress.</li><li>Anonymous usage analytics.</li></ul>
      <h2>How we use it</h2>
      <p>To personalize your dashboard, resume videos, and send important account notices.</p>
      <h2>Your rights</h2>
      <p>You can request export or deletion of your data at any time by emailing <a href="mailto:privacy@nexusedu.app">privacy@nexusedu.app</a>.</p>
    </LegalPage>
  );
}
