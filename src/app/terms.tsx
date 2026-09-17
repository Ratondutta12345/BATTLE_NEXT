import { InfoPage, InfoSection, InfoText, InfoBullet } from '@/components/ui/InfoPage';

export default function TermsScreen() {
  return <InfoPage title="Terms & Conditions" eyebrow="Play fair, play smart" intro="By using BATTLE-NEXT, you agree to use the app responsibly and follow the rules for every match.">
    <InfoSection title="Using the app"><InfoBullet>Provide accurate account and in-game information.</InfoBullet><InfoBullet>Keep your login details secure and use only your own account.</InfoBullet><InfoBullet>Use the app only for lawful, respectful competition.</InfoBullet></InfoSection>
    <InfoSection title="Matches and results"><InfoText>Entry details, player limits, room information, and prize rules are defined on each match. Results are recorded by the tournament team and displayed in the app after completion.</InfoText></InfoSection>
    <InfoSection title="Fair play"><InfoText>Cheating, impersonation, abusive behavior, match manipulation, and attempts to exploit the service are not allowed. We may restrict accounts that break these rules or harm other players.</InfoText></InfoSection>
    <InfoSection title="Updates"><InfoText>We may update these terms as the app grows. Continued use of BATTLE-NEXT after an update means you accept the revised terms.</InfoText></InfoSection>
  </InfoPage>;
}
