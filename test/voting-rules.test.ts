import {
  createRoom,
  joinRoom,
  drawRoomPairs,
  startPartyShow,
  advancePartyStep,
  submitPartyGuess,
  computeEndgameNominations,
} from '../server/rooms';

console.log('🧪 Starting Voting Rules and Nominations Test Suite...');

// Setup Room with 4 players
const { room, host } = createRoom({
  title: 'Тест Голосования',
  budget: '2000 ₽',
  eventDate: '2026-12-31',
  hostName: 'Олег',
  avatar: '🎅',
});

const { participant: p2 } = joinRoom({ code: room.code, name: 'Лена', avatar: '🤶' });
const { participant: p3 } = joinRoom({ code: room.code, name: 'Дима', avatar: '🦌' });
const { participant: p4 } = joinRoom({ code: room.code, name: 'Аня', avatar: '⛄' });

drawRoomPairs(room.code, host.id);
startPartyShow(room.code, host.id, { skipWarmupQuiz: true });

// advance to guess
advancePartyStep(room.code, host.id); // roulette -> riddle
advancePartyStep(room.code, host.id); // riddle -> guess

const currentPair = room.pairs.find((p) => p.id === room.party.currentPairId)!;
const receiverId = currentPair.receiverId;
const giverId = currentPair.giverId;

// Find eligible voters (not receiver, not giver)
const eligibleVoters = room.participants.filter(
  (p) => p.id !== receiverId && p.id !== giverId
);

if (eligibleVoters.length < 2) {
  throw new Error('Expected at least 2 eligible voters in 4-player game');
}

const voter1 = eligibleVoters[0];
const voter2 = eligibleVoters[1];

// 1. Recipient tries to vote -> MUST BE IGNORED
submitPartyGuess(room.code, receiverId, giverId);
if (room.party.guesses[receiverId]) {
  throw new Error('Violation! Recipient was able to submit a guess in their own round');
}
console.log('✅ Rule 1 Passed: Recipient is blocked from voting in their own round');

// 2. Giver (Santa) tries to vote -> MUST BE IGNORED
submitPartyGuess(room.code, giverId, giverId);
if (room.party.guesses[giverId]) {
  throw new Error('Violation! Santa was able to vote in their own round');
}
console.log('✅ Rule 2 Passed: Secret Santa is blocked from voting in their own round');

// 3. Eligible voter votes correctly
submitPartyGuess(room.code, voter1.id, giverId);
if (room.party.guesses[voter1.id] !== giverId) {
  throw new Error('Eligible voter could not submit vote');
}

// Voter tries to CHANGE vote -> MUST BE IGNORED
submitPartyGuess(room.code, voter1.id, 'another-id');
if (room.party.guesses[voter1.id] !== giverId) {
  throw new Error('Violation! Voter was able to change their locked vote');
}
console.log('✅ Rule 3 Passed: Vote is locked once submitted and cannot be changed');

// Complete this round
advancePartyStep(room.code, host.id); // guess -> photos
if (room.party.roundHistory.length !== 1) {
  throw new Error('Expected roundHistory to record round');
}
console.log('✅ Rule 4 Passed: Round history recorded correctly');

// Complete through finish
while (room.party.status !== 'finished') {
  advancePartyStep(room.code, host.id);
}

const nominations = computeEndgameNominations(room);
if (!nominations || typeof nominations.totalGifts !== 'number') {
  throw new Error('Nominations failed to compute');
}
console.log('✅ Rule 5 Passed: Endgame nominations computed cleanly');
console.log('🎉 ALL VOTING AND NOMINATION RULES VERIFIED 100%!');
