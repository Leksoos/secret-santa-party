import { io, Socket } from 'socket.io-client';
import { ClientRoomView, ReactionEvent } from '../types';
import { getApiBaseUrl } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const apiBase = getApiBaseUrl();
    socket = apiBase
      ? io(apiBase, { autoConnect: true, reconnectionAttempts: 10 })
      : io({ autoConnect: true, reconnectionAttempts: 10 });
  }
  return socket;
}

export function subscribeToRoom(
  code: string,
  participantId: string | undefined,
  callbacks: {
    onRoomState?: (state: ClientRoomView) => void;
    onRoomUpdated?: () => void;
    onReaction?: (reaction: ReactionEvent) => void;
    onSound?: (data: { sound: string }) => void;
    onParticipantCheckedIn?: (data: { participantId: string; name: string; avatar: string }) => void;
  }
) {
  const s = getSocket();

  s.emit('room:join', { code, participantId });

  if (callbacks.onRoomState) {
    s.on('room:state', callbacks.onRoomState);
  }
  if (callbacks.onRoomUpdated) {
    s.on('room:updated', callbacks.onRoomUpdated);
  }
  if (callbacks.onReaction) {
    s.on('reaction:trigger', callbacks.onReaction);
  }
  if (callbacks.onSound) {
    s.on('sound:trigger', callbacks.onSound);
  }
  if (callbacks.onParticipantCheckedIn) {
    s.on('participant:checked_in', callbacks.onParticipantCheckedIn);
  }

  return () => {
    if (callbacks.onRoomState) s.off('room:state', callbacks.onRoomState);
    if (callbacks.onRoomUpdated) s.off('room:updated', callbacks.onRoomUpdated);
    if (callbacks.onReaction) s.off('reaction:trigger', callbacks.onReaction);
    if (callbacks.onSound) s.off('sound:trigger', callbacks.onSound);
    if (callbacks.onParticipantCheckedIn) s.off('participant:checked_in', callbacks.onParticipantCheckedIn);
  };
}
