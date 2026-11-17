import {
  createRoom,
  joinRoom,
  drawRoomPairs,
  startPartyShow,
  advancePartyStep,
  getClientRoomView,
  joinDemoCompany,
} from '../server/rooms';

console.log('🧪 Starting Privacy and Host Permissions Test Suite...');

// 1. Create room and participants
const { room, host } = createRoom({
  title: 'Приватная вечеринка',
  budget: '2000 ₽',
  eventDate: '2026-12-31',
  hostName: 'Олег (Хост)',
  avatar: '🎅',
});

const { participant: guest1 } = joinRoom({
  code: room.code,
  name: 'Лена',
  avatar: '🤶',
});

const { participant: guest2 } = joinRoom({
  code: room.code,
  name: 'Дима',
  avatar: '🦌',
});

// Set secret wishlists
host.wishlist = 'Секретная мечта Олега: Робот-пылесос';
guest1.wishlist = 'Секретная мечта Лены: Духи Chanel';
guest2.wishlist = 'Секретная мечта Димы: Видеокарта RTX';

// 2. Test Privacy in Lobby
const lobbyViewForGuest = getClientRoomView(room.code, guest1.id);
if (!lobbyViewForGuest) throw new Error('Failed to get room view');

// Check that public participants list does NOT expose raw wishlist
lobbyViewForGuest.participants.forEach((p) => {
  if ((p as any).wishlist !== undefined) {
    throw new Error(`Privacy Leak! Participant ${p.name} has exposed raw wishlist in public view`);
  }
  if ((p as any).antiWishlist !== undefined) {
    throw new Error(`Privacy Leak! Participant ${p.name} has exposed raw antiWishlist in public view`);
  }
});
console.log('✅ Privacy Test 1 Passed: Public participants list strictly hides raw wishlists in lobby');

// 3. Test Host Permissions: Non-host cannot draw pairs
let nonHostDrawFailed = false;
try {
  drawRoomPairs(room.code, guest1.id); // Guest1 is not host
} catch (e: any) {
  nonHostDrawFailed = true;
}
if (!nonHostDrawFailed) {
  throw new Error('Security Leak! Non-host was able to draw room pairs!');
}
console.log('✅ Security Test 1 Passed: Non-host cannot trigger pair draw');

// 4. Host draws pairs
const pairs = drawRoomPairs(room.code, host.id);
if (pairs.length !== 3) throw new Error('Expected 3 pairs drawn');
console.log('✅ Security Test 2 Passed: Host successfully drew pairs');

// 5. Test Post-Draw Privacy: Guest only sees THEIR recipient's wishlist
const guest1PostDrawView = getClientRoomView(room.code, guest1.id);
if (!guest1PostDrawView?.myRecipient) {
  throw new Error('Expected guest1 to have an assigned recipient');
}

const assignedToGuest1 = guest1PostDrawView.myRecipient.participant;
if (!assignedToGuest1.wishlist) {
  throw new Error('Assigned recipient wishlist should be visible to their Secret Santa');
}

// Ensure guest1 does NOT see other participants' wishlists
guest1PostDrawView.participants.forEach((p) => {
  if ((p as any).wishlist !== undefined) {
    throw new Error(`Privacy Leak! Guest1 can see wishlist of ${p.name} in participants array`);
  }
});
console.log(`✅ Privacy Test 2 Passed: Guest sees only their assigned recipient (${assignedToGuest1.name}) wishlist, others remain secret!`);

// 6. Test Host-only Party Start
let nonHostStartFailed = false;
try {
  startPartyShow(room.code, guest1.id);
} catch (e) {
  nonHostStartFailed = true;
}
if (!nonHostStartFailed) {
  throw new Error('Security Leak! Non-host was able to start party show!');
}
console.log('✅ Security Test 3 Passed: Non-host cannot start party show');

// Host starts party
startPartyShow(room.code, host.id);
console.log('✅ Security Test 4 Passed: Host successfully started party show');

// 7. Test Sandbox Join in SANTA-2026
const { room: demoRoom, user: testUser } = joinDemoCompany({
  userName: 'Тестер',
  avatar: '⛄',
  asHost: true,
});

if (demoRoom.participants.length !== 5) {
  throw new Error(`Expected 5 participants in demo room, got ${demoRoom.participants.length}`);
}
if (demoRoom.hostId !== testUser.id || !testUser.isHost) {
  throw new Error('Expected test user to be assigned as host in sandbox');
}
console.log('✅ Sandbox Test Passed: User joined demo company of friends as 5th participant & host!');

console.log('🎉 ALL PRIVACY AND SECURITY TESTS PASSED 100%!');
