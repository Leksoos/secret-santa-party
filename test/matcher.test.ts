import { generatePairs } from '../server/santa-matcher';
import { Participant } from '../server/types';
import { createRoom, joinRoom, drawRoomPairs, advancePartyStep, startPartyShow } from '../server/rooms';

function createMockParticipant(name: string, id: string): Participant {
  return {
    id,
    name,
    avatar: '🎅',
    wishlist: 'Книга',
    antiWishlist: 'Носки',
    isHost: false,
    isReady: true,
    online: true,
  };
}

console.log('🧪 Starting Secret Santa Matcher Tests...');

// Test 1: Derangement and cycle testing across 100 runs
for (let run = 1; run <= 100; run++) {
  const count = 3 + (run % 10);
  const participants = Array.from({ length: count }, (_, i) =>
    createMockParticipant(`Player ${i + 1}`, `p-${i + 1}`)
  );

  const pairs = generatePairs(participants);

  if (pairs.length !== count) {
    throw new Error(`Run ${run}: Expected ${count} pairs, got ${pairs.length}`);
  }

  const givers = new Set(pairs.map((p) => p.giverId));
  const receivers = new Set(pairs.map((p) => p.receiverId));

  if (givers.size !== count || receivers.size !== count) {
    throw new Error(`Run ${run}: Not all participants are givers or receivers`);
  }

  // Verify no self-gifting
  pairs.forEach((p) => {
    if (p.giverId === p.receiverId) {
      throw new Error(`Run ${run}: Self-gifting detected for ${p.giverId}`);
    }
  });
}
console.log('✅ Test 1 Passed: 100 iterations of derangement matching succeeded without self-gifting!');

// Test 2: Edge Case with 2 participants
const twoPlayers = [
  createMockParticipant('Alice', 'p-1'),
  createMockParticipant('Bob', 'p-2'),
];
const twoPairs = generatePairs(twoPlayers);
if (
  twoPairs.length !== 2 ||
  twoPairs[0].giverId === twoPairs[0].receiverId ||
  twoPairs[1].giverId === twoPairs[1].receiverId
) {
  throw new Error('Test 2 Failed: 2 players matching error');
}
console.log('✅ Test 2 Passed: 2 players matched symmetrically without self-gifting');

// Test 3: Full Room Lifecycle and Jackbox Party State Machine
const { room, host } = createRoom({
  title: 'Новогодний Тест',
  budget: 'до 2000 ₽',
  eventDate: '2026-12-31',
  hostName: 'Олег',
  avatar: '🎅',
});

// Join 2 more guests
const { participant: p2 } = joinRoom({
  code: room.code,
  name: 'Катя',
  avatar: '🤶',
});
const { participant: p3 } = joinRoom({
  code: room.code,
  name: 'Миша',
  avatar: '🦌',
});

if (room.participants.length !== 3) {
  throw new Error('Test 3 Failed: expected 3 participants');
}

// Draw pairs
drawRoomPairs(room.code, host.id);
if (room.status !== 'drawn' || room.pairs.length !== 3) {
  throw new Error('Test 3 Failed: drawRoomPairs did not create 3 pairs');
}

// Start Party (skip warmup quiz to test gifting state machine directly)
startPartyShow(room.code, host.id, { skipWarmupQuiz: true });
if (room.party.currentStep !== 'roulette') {
  throw new Error(`Test 3 Failed: expected roulette step, got ${room.party.currentStep}`);
}

// Step 1: Roulette -> Riddle
advancePartyStep(room.code);
if (room.party.currentStep !== 'riddle') {
  throw new Error(`Test 3 Failed: expected riddle, got ${room.party.currentStep}`);
}

// Step 2: Riddle -> Guess
advancePartyStep(room.code);
if (room.party.currentStep !== 'guess') {
  throw new Error(`Test 3 Failed: expected guess, got ${room.party.currentStep}`);
}

// Step 3: Guess -> Photos
advancePartyStep(room.code);
if (room.party.currentStep !== 'photos') {
  throw new Error(`Test 3 Failed: expected photos, got ${room.party.currentStep}`);
}

// Step 4: Photos -> Reveal
advancePartyStep(room.code);
if (room.party.currentStep !== 'reveal') {
  throw new Error(`Test 3 Failed: expected reveal, got ${room.party.currentStep}`);
}

console.log('✅ Test 3 Passed: Room and Jackbox Party State Machine transitioned cleanly through all steps!');
console.log('🎉 ALL AUTOMATED TESTS PASSED SUCCESSFULLY!');
