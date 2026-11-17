import { strict as assert } from 'assert';
import {
  createRoom,
  joinRoom,
  updateParticipantProfile,
  drawRoomPairs,
  checkInParticipant,
  startPartyShow,
  advancePartyStep,
  submitPartyGuess,
  getRoom,
  initAllRooms,
} from '../server/rooms';
import { closeDatabase, getDatabase } from '../server/db/database';

console.log('🧪 Starting SQLite Server Persistence & Restart Recovery Test Suite...');

// 1. Create a test room
const { room: initialRoom, host } = createRoom({
  title: 'Тест Сохранности Сервера',
  budget: 'до 4 000 ₽',
  eventDate: '2026-12-31',
  hostName: 'Иван Хост',
  avatar: '🎅',
});

const code = initialRoom.code;
assert(code, 'Room code must be generated');

// 2. Add second and third participant
const { participant: p2 } = joinRoom({
  code,
  name: 'Ольга',
  avatar: '🦊',
});

const { participant: p3 } = joinRoom({
  code,
  name: 'Сергей',
  avatar: '🦌',
});

// 3. Update participant wishlist
updateParticipantProfile(code, p2.id, {
  wishlist: 'Укулеле или набор для каллиграфии',
  antiWishlist: 'Сладости',
  clothingSize: 'M',
});

// 4. Mark check-in
checkInParticipant(code, host.id);
checkInParticipant(code, p2.id);

// 5. Draw pairs
const pairs = drawRoomPairs(code, host.id);
assert.equal(pairs.length, 3, 'Pairs must be drawn for 3 participants');

// 6. Start party show and advance to a step
startPartyShow(code, host.id, { skipWarmupQuiz: true });
let activeRoom = getRoom(code)!;
assert.equal(activeRoom.status, 'party');

// Advance to roulette -> riddle -> guess
advancePartyStep(code, host.id); // riddle
advancePartyStep(code, host.id); // guess
activeRoom = getRoom(code)!;
assert.equal(activeRoom.party.currentStep, 'guess');

// Submit a guess
const currentPair = activeRoom.pairs.find((p) => p.id === activeRoom.party.currentPairId)!;
const voter = activeRoom.participants.find(
  (p) => p.id !== currentPair.receiverId && p.id !== currentPair.giverId
)!;
submitPartyGuess(code, voter.id, 'some-guessed-id');

console.log('✅ Stage 1: Room created, pairs drawn, party in "guess" step with active votes.');

// =======================================================================
// 7. SIMULATE COMPLETE SERVER CRASH / RESTART:
// =======================================================================
console.log('🔄 Simulating server process restart and cold memory hydration...');

// Call initAllRooms() to re-read all rooms from SQLite
initAllRooms();

const recoveredRoom = getRoom(code);
assert(recoveredRoom, 'Room must be 100% recovered from SQLite after restart');
assert.equal(recoveredRoom.title, 'Тест Сохранности Сервера');
assert.equal(recoveredRoom.status, 'party');
assert.equal(recoveredRoom.participants.length, 3);

// Verify participant profile was preserved
const recoveredOlga = recoveredRoom.participants.find((p) => p.id === p2.id);
assert(recoveredOlga, 'Olga must be in recovered room');
assert.equal(recoveredOlga.wishlist, 'Укулеле или набор для каллиграфии');
assert.equal(recoveredOlga.antiWishlist, 'Сладости');
assert.equal(recoveredOlga.clothingSize, 'M');
assert.equal(recoveredOlga.checkedIn, true);

// Verify pairs preserved
assert.equal(recoveredRoom.pairs.length, 3);

// Verify party state preserved
assert.equal(recoveredRoom.party.currentStep, 'guess');
assert.equal(recoveredRoom.party.guesses[voter.id], 'some-guessed-id');

console.log('✅ Stage 2: 100% state recovered from SQLite without any data loss!');
console.log('🎉 PERSISTENCE & SERVER RESTART TEST PASSED CLEANLY!\n');
