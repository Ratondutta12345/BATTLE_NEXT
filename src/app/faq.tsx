import { InfoPage, InfoSection, InfoText } from '@/components/ui/InfoPage';

const questions = [
  ['How do I join a match?', 'Open a game, choose an upcoming or ongoing match, and tap Join Now. Enter your in-game name exactly as it appears in the game.'],
  ['When can I see the room details?', 'Room ID and password are shown after you join when the organizer has published them.'],
  ['Where can I see my results?', 'Open History to view completed matches you joined. Select a match to see every participant, kills, position, booyah prize, and total prize.'],
  ['What happens when a match is full?', 'A full match shows its capacity and the join control is disabled until a slot becomes available.'],
  ['How can I get help?', 'Use Contact Us from your profile to reach the BATTLE-NEXT support team.'],
];

export default function FaqScreen() {
  return <InfoPage title="FAQ" eyebrow="Quick answers" intro="Everything you need to know before your next BATTLE-NEXT match.">
    {questions.map(([question, answer]) => <InfoSection key={question} title={question}><InfoText>{answer}</InfoText></InfoSection>)}
  </InfoPage>;
}
