import assert from 'node:assert';
import * as rooms from '../server/rooms.js';
import type { Participant, PublicParticipant } from '../server/types.js';

console.log('🎄 ==================================================================');
console.log('🧪 Starting Dedicated TV Spectator & Central QR Check-in Test Suite');
console.log('🎄 ==================================================================\n');

let totalTests = 0;
let passedTests = 0;

function pass(name: string, details?: string) {
  passedTests++;
  totalTests++;
  console.log(`  ✅ [PASS] ${name}${details ? ` — ${details}` : ''}`);
}

// ----------------------------------------------------------------------------
// Test 1: TV Spectator Mode Session Isolation (Requirement R2)
// ----------------------------------------------------------------------------
console.log('▶ [Test 1] Verifying TV Spectator Mode Isolation (view=tv, participantId: undefined)...');

{
  const { room, host } = rooms.createRoom({
    title: 'Корпоративная Ёлка 2026',
    budget: '3000 ₽',
    eventDate: '2026-12-31',
    hostName: 'Олег (Хост)',
    avatar: '🎅',
  });

  rooms.updateParticipantProfile(room.code, host.id, {
    wishlist: 'Секретный вишлист: Кофемашина DeLonghi',
    antiWishlist: 'Никаких кружек и магнитов',
    clothingSize: 'XL',
  });

  const { participant: pElena } = rooms.joinRoom({
    code: room.code,
    name: 'Елена',
    avatar: '🤶',
  });

  rooms.updateParticipantProfile(room.code, pElena.id, {
    wishlist: 'Секретный вишлист: Набор кистей для акварели',
    antiWishlist: 'Сладкие подарки',
    clothingSize: 'M',
  });

  rooms.drawRoomPairs(room.code, host.id);

  // 1.1 TV Spectator opens view without participantId
  const tvView = rooms.getClientRoomView(room.code, undefined);
  assert(tvView, 'TV spectator view must resolve successfully');
  assert.strictEqual(tvView.myProfile, null, 'TV mode must have myProfile === null');
  assert.strictEqual(tvView.myRecipient, null, 'TV mode must have myRecipient === null');
  pass('1.1 TV spectator view contains null myProfile and null myRecipient');

  // 1.2 No private data leaks in public participants
  for (const p of tvView.participants) {
    assert.strictEqual((p as any).wishlist, undefined, `Wishlist for ${p.name} must be stripped`);
    assert.strictEqual((p as any).antiWishlist, undefined, `Anti-wishlist for ${p.name} must be stripped`);
    assert.strictEqual((p as any).clothingSize, undefined, `Clothing size for ${p.name} must be stripped`);
    assert.strictEqual(typeof p.hasWishlist, 'boolean', 'hasWishlist boolean flag must be present');
    assert.strictEqual(typeof p.checkedIn, 'boolean', 'checkedIn boolean flag must be present');
  }
  pass('1.2 Public participants strip all private fields while exposing checkedIn and hasWishlist booleans');

  // 1.3 Empty string participantId also operates as TV spectator
  const emptyStringView = rooms.getClientRoomView(room.code, '');
  assert(emptyStringView, 'Empty string participantId must resolve');
  assert.strictEqual(emptyStringView.myProfile, null, 'Empty string participantId must not bind to profile');
  assert.strictEqual(emptyStringView.myRecipient, null, 'Empty string participantId must not bind to recipient');
  pass('1.3 Empty string participantId (URL edge case) handled as conflict-free TV spectator');

  // 1.4 Host mobile coexistence: Host logs in from phone while TV is running
  const hostPhoneView = rooms.getClientRoomView(room.code, host.id);
  assert(hostPhoneView, 'Host mobile view must resolve');
  assert(hostPhoneView.myProfile, 'Host mobile view must have active myProfile');
  assert.strictEqual(hostPhoneView.myProfile.id, host.id);
  assert(hostPhoneView.myRecipient, 'Host mobile view must have secret recipient assignment');
  assert.strictEqual(hostPhoneView.myRecipient.participant.id, pElena.id);

  // Re-verify TV view is completely unpolluted
  const tvViewAfterPhone = rooms.getClientRoomView(room.code, undefined);
  assert.strictEqual(tvViewAfterPhone?.myProfile, null, 'TV screen remains unpolluted after mobile login');
  assert.strictEqual(tvViewAfterPhone?.myRecipient, null, 'TV screen recipient remains null');
  pass('1.4 Host smartphone session operates conflict-free alongside dedicated TV broadcast screen');
}

// ----------------------------------------------------------------------------
// Test 2: Participant Live Check-in Flow (Requirement R3)
// ----------------------------------------------------------------------------
console.log('\n▶ [Test 2] Verifying Live Check-in Flow & Presence Badging ("В зале 🎮")...');

{
  const { room, host } = rooms.createRoom({
    title: 'Вечеринка Санты в Офисе',
    budget: '2000 ₽',
    eventDate: '2026-12-31',
    hostName: 'Павел',
    avatar: '🎩',
  });

  // Host starts unchecked in
  const initialView = rooms.getClientRoomView(room.code, undefined);
  assert(initialView);
  const hostInitial = initialView.participants.find((p) => p.id === host.id);
  assert.strictEqual(hostInitial?.checkedIn, false, 'Host initially checkedIn is false until arrival');
  pass('2.1 Host initial checkedIn presence flag is false');

  // Pavel checks in via QR scan action
  const checkinRes = rooms.checkInParticipant(room.code, host.id);
  assert.strictEqual(checkinRes.success, true);
  assert.strictEqual(checkinRes.participant.checkedIn, true);
  assert.strictEqual(checkinRes.participant.online, true);

  const viewAfterHostCheckin = rooms.getClientRoomView(room.code, undefined);
  assert(viewAfterHostCheckin);
  const hostChecked = viewAfterHostCheckin.participants.find((p) => p.id === host.id);
  assert.strictEqual(hostChecked?.checkedIn, true, 'Host checkedIn is now true for TV "В зале 🎮" badge');
  pass('2.2 checkInParticipant marks host checkedIn: true and online: true');

  // New participant joins room via mobile QR code
  const { participant: guestDaria } = rooms.joinRoom({
    code: room.code,
    name: 'Дарья',
    avatar: '🦄',
  });

  assert.strictEqual(guestDaria.checkedIn, true, 'New participant joining room receives checkedIn: true');
  const viewAfterDaria = rooms.getClientRoomView(room.code, undefined);
  const dariaPublic = viewAfterDaria?.participants.find((p) => p.id === guestDaria.id);
  assert.strictEqual(dariaPublic?.checkedIn, true, 'Guest Daria is immediately marked "В зале 🎮" on TV');
  pass('2.3 joinRoom automatically grants checkedIn: true for incoming mobile guests');

  // Existing participant re-joining synchronizes online and checkedIn
  const rejoinRes = rooms.joinRoom({
    code: room.code,
    name: 'Дарья',
    avatar: '🦄',
  });
  assert.strictEqual(rejoinRes.participant.id, guestDaria.id);
  assert.strictEqual(rejoinRes.participant.checkedIn, true);
  assert.strictEqual(rejoinRes.participant.online, true);
  pass('2.4 Re-joining room preserves and synchronizes active check-in presence');
}

// ----------------------------------------------------------------------------
// Test 3: Error Handling & Boundary Safety for Check-in
// ----------------------------------------------------------------------------
console.log('\n▶ [Test 3] Verifying Check-in Error Handling & Boundaries...');

{
  const { room, host } = rooms.createRoom({
    title: 'Безопасная Комната',
    budget: '1500 ₽',
    eventDate: '2026-12-31',
    hostName: 'Хост',
    avatar: '🎅',
  });

  // Non-existent room code
  assert.throws(
    () => rooms.checkInParticipant('NON-EXISTENT-CODE', host.id),
    /Комната не найдена/,
    'checkInParticipant with invalid room code must throw descriptive error'
  );
  pass('3.1 Invalid room code throws descriptive error');

  // Non-existent participant ID
  assert.throws(
    () => rooms.checkInParticipant(room.code, 'ghost-participant-id'),
    /Участник не найден/,
    'checkInParticipant with invalid participantId must throw descriptive error'
  );
  pass('3.2 Invalid participantId throws descriptive error');
}

// ----------------------------------------------------------------------------
// Test 4: Demo Room ("SANTA-2026") Live Check-in Seeding
// ----------------------------------------------------------------------------
console.log('\n▶ [Test 4] Verifying Demo Room SANTA-2026 Check-in States...');

{
  rooms.initDemoRoom();
  const demoView = rooms.getClientRoomView('SANTA-2026', undefined);
  assert(demoView, 'SANTA-2026 demo room must exist');

  const checkedInCount = demoView.participants.filter((p) => p.checkedIn).length;
  const waitingCount = demoView.participants.filter((p) => !p.checkedIn).length;

  assert(checkedInCount >= 1, 'At least 1 participant must be checked in');
  assert(waitingCount >= 1, 'At least 1 participant must be waiting for realistic TV lobby preview');
  pass('4.1 Demo room seeds realistic mix of checked-in ("В зале 🎮") and waiting ("Ожидаем 📱") guests');

  // Check in the waiting participant
  const waitingParticipant = demoView.participants.find((p) => !p.checkedIn)!;
  rooms.checkInParticipant('SANTA-2026', waitingParticipant.id);

  const updatedDemoView = rooms.getClientRoomView('SANTA-2026', undefined);
  const updatedParticipant = updatedDemoView?.participants.find((p) => p.id === waitingParticipant.id);
  assert.strictEqual(updatedParticipant?.checkedIn, true);
  pass('4.2 Waiting demo guest transitions live to checked-in');
}

console.log('\n======================================================================');
console.log(`🎉 ALL ${passedTests}/${totalTests} DEDICATED TV & CHECK-IN TESTS PASSED CLEANLY!`);
console.log('======================================================================\n');
