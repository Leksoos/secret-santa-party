import assert from 'node:assert';
import {
  initDemoRoom,
  getRoom,
  startPartyShow,
  advancePartyStep,
  submitPartyGuess,
  getClientRoomView,
} from '../server/rooms.js';

console.log('🧪 Starting Timer Sync and Fast-Forward Tests...');

// 1. Setup demo room
initDemoRoom();
const room = getRoom('SANTA-2026');
assert(room, 'Demo room must exist');
const hostId = room.hostId;

// 2. Start party show -> step should be roulette with 5 seconds timerDuration
startPartyShow('SANTA-2026', hostId, { skipWarmupQuiz: true });
assert.strictEqual(room.party.currentStep, 'roulette');
assert.strictEqual(room.party.timerDuration, 5);
assert(room.party.stepStartTime > 0, 'stepStartTime must be set');
console.log('✅ Test 1 Passed: Roulette initialized with 5 seconds duration and valid stepStartTime');

// 3. Advance to riddle
advancePartyStep('SANTA-2026', hostId);
assert.strictEqual(room.party.currentStep, 'riddle');
assert.strictEqual(room.party.timerDuration, 0);
console.log('✅ Test 2 Passed: Riddle initialized with stepStartTime');

// 4. Advance to guess -> 25 seconds timerDuration
advancePartyStep('SANTA-2026', hostId);
assert.strictEqual(room.party.currentStep, 'guess');
assert.strictEqual(room.party.timerDuration, 25);
const guessStepStart = room.party.stepStartTime;
assert(guessStepStart > 0, 'guess stepStartTime must be set');
console.log('✅ Test 3 Passed: Guess step initialized with 25s timerDuration');

// 5. Test Fast-Forward:
// In SANTA-2026, 4 players (Oleg, Elena, Dima, Anya).
// Current pair has receiver and giver. Exactly 4 - 2 = 2 eligible voters!
const currentPair = room.pairs.find((p) => p.id === room.party.currentPairId)!;
const eligibleVoters = room.participants.filter(
  (p) => p.id !== currentPair.receiverId && p.id !== currentPair.giverId
);
assert.strictEqual(eligibleVoters.length, 2, 'Exactly 2 voters eligible in 4-player round');

// First voter votes -> timer should NOT yet fast forward to <= 3
submitPartyGuess('SANTA-2026', eligibleVoters[0].id, eligibleVoters[1].id);
assert.strictEqual(room.party.timerDuration, 25, 'Timer remains 25 after 1st vote');

// Second (and final) voter votes -> timer MUST snap to 3 seconds!
submitPartyGuess('SANTA-2026', eligibleVoters[1].id, eligibleVoters[0].id);
assert.strictEqual(room.party.timerDuration, 3, 'Timer snapped to 3 seconds upon all eligible votes');
assert(room.party.stepStartTime >= guessStepStart, 'stepStartTime refreshed for 3s countdown');
console.log('✅ Test 4 Passed: Fast-Forward triggered! Timer snapped to 3s when all eligible players voted');

// 6. Test Client Room View has stepStartTime and timerDuration
const view = getClientRoomView('SANTA-2026', eligibleVoters[0].id)!;
assert(view.party.stepStartTime > 0, 'Client view contains stepStartTime');
assert.strictEqual(view.party.timerDuration, 3, 'Client view contains timerDuration=3');
console.log('✅ Test 5 Passed: getClientRoomView returns accurate stepStartTime and timerDuration');

console.log('🎉 ALL TIMER SYNC AND FAST-FORWARD TESTS PASSED 100%!');
