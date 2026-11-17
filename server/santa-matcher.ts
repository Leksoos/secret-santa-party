import { Participant, Pair } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Secret Santa Derangement Matcher
 * Guarantees nobody gets themselves, and avoids immediate 2-cycles if >= 3 participants
 */
export function generatePairs(participants: Participant[]): Pair[] {
  if (participants.length < 2) {
    throw new Error('Для жеребьевки нужно как минимум 2 участника');
  }

  const ids = participants.map((p) => p.id);
  const n = ids.length;

  let attempts = 0;
  const maxAttempts = 500;

  while (attempts < maxAttempts) {
    attempts++;
    const receivers = [...ids];

    // Fisher-Yates shuffle
    for (let i = receivers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [receivers[i], receivers[j]] = [receivers[j], receivers[i]];
    }

    // Check conditions:
    // 1. No self-giving (derangement)
    let valid = true;
    for (let i = 0; i < n; i++) {
      if (ids[i] === receivers[i]) {
        valid = false;
        break;
      }
    }
    if (!valid) continue;

    // 2. If 3 or more participants, avoid immediate mutual cycles A -> B and B -> A for extra suspense
    if (n >= 3) {
      let hasMutual = false;
      const map = new Map<string, string>();
      for (let i = 0; i < n; i++) {
        map.set(ids[i], receivers[i]);
      }
      for (let i = 0; i < n; i++) {
        const giver = ids[i];
        const receiver = map.get(giver)!;
        if (map.get(receiver) === giver) {
          hasMutual = true;
          break;
        }
      }
      if (hasMutual && attempts < maxAttempts - 20) {
        continue; // retry to find an even better single-cycle or non-mutual permutation
      }
    }

    // Success! Generate pairs
    return ids.map((giverId, idx) => ({
      id: uuidv4(),
      giverId,
      receiverId: receivers[idx],
      hintRiddle: '',
      backstagePhotos: [],
      revealed: false,
    }));
  }

  // Fallback: guaranteed single cycle
  // A -> B -> C -> ... -> A
  const shuffled = [...ids].sort(() => Math.random() - 0.5);
  return shuffled.map((giverId, idx) => ({
    id: uuidv4(),
    giverId,
    receiverId: shuffled[(idx + 1) % shuffled.length],
    hintRiddle: '',
    backstagePhotos: [],
    revealed: false,
  }));
}
