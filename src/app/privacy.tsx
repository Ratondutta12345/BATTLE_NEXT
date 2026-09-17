import { InfoPage, InfoSection, InfoText, InfoBullet } from '@/components/ui/InfoPage';

export default function PrivacyScreen() {
  return <InfoPage title="Privacy Policy" eyebrow="Your data, your trust" intro="This policy explains how BATTLE-NEXT uses information to provide a reliable tournament experience.">
    <InfoSection title="Information we use"><InfoBullet>Account details such as your name, username, email, and phone number.</InfoBullet><InfoBullet>Match activity, in-game name, entries, results, kills, and prizes.</InfoBullet><InfoBullet>Profile information you choose to upload, such as your profile image.</InfoBullet></InfoSection>
    <InfoSection title="Why we use it"><InfoText>We use this information to sign you in, show your joined matches, calculate account statistics, publish results, protect the platform, and respond to support requests.</InfoText></InfoSection>
    <InfoSection title="Your choices"><InfoText>You can review your profile information in the app and contact support about account questions or privacy requests. We do not sell your personal information.</InfoText></InfoSection>
    <InfoSection title="Security"><InfoText>We use reasonable technical and organizational measures to protect account data. Please keep your password private and contact us if you notice unusual activity.</InfoText></InfoSection>
  </InfoPage>;
}
