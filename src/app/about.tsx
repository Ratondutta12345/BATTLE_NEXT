import { InfoPage, InfoSection, InfoText, InfoBullet } from '@/components/ui/InfoPage';

export default function AboutScreen() {
  return <InfoPage title="About Us" eyebrow="Built for the next match" intro="BATTLE-NEXT brings competitive mobile gaming into one focused place, from finding a match to celebrating the final result.">
    <InfoSection title="What we do"><InfoText>We make esports tournaments easier to discover, join, and follow. Players can browse games, enter skill-based matches, track their performance, and keep their winnings in one account.</InfoText></InfoSection>
    <InfoSection title="Our promise"><InfoBullet>Clear match information before you join.</InfoBullet><InfoBullet>Fair result tracking for every participant.</InfoBullet><InfoBullet>A fast, friendly experience for the gaming community.</InfoBullet></InfoSection>
    <InfoSection title="Play with purpose"><InfoText>Respect your opponents, follow each match rule, and keep the competition fun. Every match is a chance to improve.</InfoText></InfoSection>
  </InfoPage>;
}
