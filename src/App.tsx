import React, { useState, useEffect, useCallback } from 'react';
import { HomeView } from './views/HomeView';
import { LobbyView } from './views/LobbyView';
import { MySantaView } from './views/MySantaView';
import { TvShowView } from './views/TvShowView';
import { ControllerView } from './views/ControllerView';
import { ProfileModal } from './views/ProfileModal';
import { Header } from './components/Header';
import { SnowflakeBg } from './components/SnowflakeBg';
import { FlyingReactions } from './components/FlyingReactions';
import { PartySimulatorDrawer } from './components/PartySimulatorDrawer';
import { ClientRoomView, Participant, ReactionEvent } from './types';
import { subscribeToRoom, getSocket } from './lib/socket';
import { sound } from './lib/sound';
import { initTelegram } from './lib/tg';

export const App: React.FC = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const isTvMode = searchParams.get('view') === 'tv';
  const isHostClaim = searchParams.get('role') === 'host';
  const queryHostId = searchParams.get('hostId');
  const requestedTab = searchParams.get('tab');

  const [roomCode, setRoomCode] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('code') || (!isTvMode ? localStorage.getItem('santa_room_code') || '' : '');
  });

  const [participantId, setParticipantId] = useState<string>(() => {
    if (isTvMode) return '';
    if (isHostClaim && queryHostId) {
      try {
        localStorage.setItem('santa_participant_id', queryHostId);
      } catch (e) {
        console.error(e);
      }
      return queryHostId;
    }
    return localStorage.getItem('santa_participant_id') || '';
  });

  const [activeTab, setActiveTab] = useState<'lobby' | 'my-santa' | 'tv' | 'controller'>(() => {
    if (isTvMode) return 'tv';
    if (isHostClaim || requestedTab === 'controller') return 'controller';
    return 'lobby';
  });
  const [room, setRoom] = useState<ClientRoomView | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showProfile, setShowProfile] = useState<boolean>(false);
  const [lastReaction, setLastReaction] = useState<ReactionEvent | null>(null);

  // Auto-claim host session on mobile when scanned from Host QR modal
  useEffect(() => {
    if (!isTvMode && isHostClaim && queryHostId) {
      setParticipantId(queryHostId);
      setActiveTab('controller');
      try {
        localStorage.setItem('santa_participant_id', queryHostId);
        if (roomCode) {
          localStorage.setItem('santa_room_code', roomCode);
          fetch(`/api/rooms/${roomCode}/checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participantId: queryHostId }),
          }).catch((err) => console.warn('Host check-in notice:', err));
        }
      } catch (e) {
        console.error(e);
      }

      // Clean query parameters from URL without reloading
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('role');
      cleanUrl.searchParams.delete('hostId');
      window.history.replaceState({}, '', cleanUrl.toString());
    }
  }, [isTvMode, isHostClaim, queryHostId, roomCode]);

  // Initialize Telegram environment
  useEffect(() => {
    initTelegram();
  }, []);

  // Fetch fresh room data
  const fetchRoom = useCallback(async (code: string, pId?: string) => {
    if (!code) return;
    try {
      const url = `/api/rooms/${code}${pId ? `?participantId=${pId}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.view) {
        setRoom(data.view);
      }
    } catch (e) {
      console.error('Failed to load room:', e);
    }
  }, []);

  // Sync room code and participant ID to localStorage & URL
  const handleRoomJoined = (code: string, pId: string) => {
    setRoomCode(code);
    if (!isTvMode) {
      setParticipantId(pId);
      localStorage.setItem('santa_room_code', code);
      localStorage.setItem('santa_participant_id', pId);
    }

    // Update browser URL without reload
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('code', code);
    if (isTvMode) newUrl.searchParams.set('view', 'tv');
    window.history.pushState({}, '', newUrl.toString());

    fetchRoom(code, isTvMode ? undefined : pId);
  };

  // On mount or code change: load room & subscribe to sockets
  useEffect(() => {
    if (!roomCode) return;

    const effectivePId = isTvMode ? undefined : (participantId || undefined);
    fetchRoom(roomCode, effectivePId);

    const unsubscribe = subscribeToRoom(roomCode, effectivePId, {
      onRoomState: (state) => setRoom(state),
      onRoomUpdated: () => fetchRoom(roomCode, effectivePId),
      onReaction: (reaction) => setLastReaction(reaction),
      onSound: (data) => {
        if (data?.sound) sound.play(data.sound);
      },
    });

    return () => {
      unsubscribe();
    };
  }, [roomCode, participantId, isTvMode, fetchRoom]);

  // Current participant object
  const currentParticipant = !isTvMode && participantId
    ? room?.participants.find((p) => p.id === participantId) || null
    : null;

  // Actions
  const handleDrawPairs = async () => {
    if (!room || !participantId) return;
    const res = await fetch(`/api/rooms/${room.code}/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId: participantId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Ошибка жеребьевки');
    }
    fetchRoom(room.code, participantId);
  };

  const handleStartParty = () => {
    if (!room) return;
    const s = getSocket();
    s.emit('party:start', { code: room.code, hostId: participantId || room.hostId });
    setActiveTab('tv');
  };

  const handleNextPartyStep = () => {
    if (!room) return;
    const s = getSocket();
    s.emit('party:next', { code: room.code, hostId: participantId || room.hostId });
  };

  const handleJoinDemoSandbox = async () => {
    try {
      const res = await fetch('/api/demo/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: currentParticipant?.name || 'Вы (Хост)',
          avatar: currentParticipant?.avatar || '🎅',
          asHost: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      handleRoomJoined('SANTA-2026', data.user.id);
      sound.play('fanfare');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSendReaction = (emoji: string, soundName: string) => {
    if (!room || !currentParticipant) return;
    const s = getSocket();
    s.emit('party:reaction', {
      code: room.code,
      emoji,
      sound: soundName,
      senderName: currentParticipant.name,
    });
  };

  const handleSubmitGuess = (guessedId: string) => {
    if (!room || !currentParticipant) return;
    const s = getSocket();
    s.emit('party:guess', {
      code: room.code,
      voterId: currentParticipant.id,
      guessedId,
    });
  };

  const handleSubmitQuizAnswer = (optionIndex: number) => {
    if (!room || !currentParticipant) return;
    const s = getSocket();
    s.emit('party:quiz_answer', {
      code: room.code,
      participantId: currentParticipant.id,
      optionIndex,
    });
  };

  const handleSubmitCustomQuestion = (data: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
    category?: string;
  }) => {
    if (!room || !currentParticipant) return;
    const s = getSocket();
    s.emit('party:submit_custom_question', {
      code: room.code,
      participantId: currentParticipant.id,
      ...data,
    });
  };

  const handleSkipCustomQuestion = () => {
    if (!room || !currentParticipant) return;
    const s = getSocket();
    s.emit('party:skip_custom_question', {
      code: room.code,
      participantId: currentParticipant.id,
    });
  };

  // Dedicated TV Spectator Mode: Full screen broadcast without header, profile modals or private tabs
  if (isTvMode) {
    if (!roomCode || !room) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 relative flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
          <SnowflakeBg />
          <div className="relative z-10 max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-600/20 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto text-3xl animate-pulse">
              📺
            </div>
            <h2 className="text-2xl font-black text-white font-festive">
              Экран ТВ Вечеринки
            </h2>
            {roomCode ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">
                  Подключение экрана ТВ к комнате{' '}
                  <span className="font-mono font-bold text-amber-400">{roomCode}</span>...
                </p>
                <div className="flex justify-center items-center gap-2 text-xs text-slate-400 bg-slate-950/60 py-2 px-3 rounded-xl border border-slate-800/80">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Синхронизация с сервером комнаты</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-amber-300">
                Код комнаты не указан в ссылке ТВ. Откройте ссылку вида <code className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-amber-400">?code=SANTA-2026&view=tv</code>
              </p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 relative flex flex-col selection:bg-red-500 selection:text-white">
        <SnowflakeBg />
        <FlyingReactions lastReaction={lastReaction} />
        <main className="flex-1 flex flex-col">
          <TvShowView
            room={room}
            isHost={false}
            onNextStep={handleNextPartyStep}
            onStartParty={handleStartParty}
          />
        </main>
      </div>
    );
  }

  // If no room is active, display landing/join screen
  if (!roomCode || !room) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 relative">
        <SnowflakeBg />
        <HomeView
          onRoomJoined={handleRoomJoined}
          initialCode={new URLSearchParams(window.location.search).get('code') || ''}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative flex flex-col selection:bg-red-500 selection:text-white">
      {/* Background Snow & Floating Reactions */}
      <SnowflakeBg />
      <FlyingReactions lastReaction={lastReaction} />

      {/* Main Header */}
      <Header
        room={room}
        currentParticipant={currentParticipant}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-10">
        {activeTab === 'lobby' && (
          <LobbyView
            room={room}
            currentParticipant={currentParticipant}
            onDrawPairs={handleDrawPairs}
            onStartParty={handleStartParty}
            onOpenProfile={() => setShowProfile(true)}
            onGoToMySanta={() => setActiveTab('my-santa')}
            onGoToTv={() => setActiveTab('tv')}
            onJoinDemoSandbox={handleJoinDemoSandbox}
          />
        )}

        {activeTab === 'my-santa' && currentParticipant && (
          <MySantaView
            room={room}
            currentParticipant={currentParticipant}
            onRefresh={() => fetchRoom(room.code, participantId)}
          />
        )}

        {activeTab === 'tv' && (
          <TvShowView
            room={room}
            isHost={!!currentParticipant?.isHost}
            onNextStep={handleNextPartyStep}
            onStartParty={handleStartParty}
          />
        )}

        {activeTab === 'controller' && currentParticipant && (
          <ControllerView
            room={room}
            currentParticipant={currentParticipant}
            onSendReaction={handleSendReaction}
            onNextStep={handleNextPartyStep}
            onSubmitGuess={handleSubmitGuess}
            onSubmitQuizAnswer={handleSubmitQuizAnswer}
            onSubmitCustomQuestion={handleSubmitCustomQuestion}
            onSkipCustomQuestion={handleSkipCustomQuestion}
          />
        )}
      </main>

      {/* Profile & Wishlist Editor Modal */}
      {showProfile && (room.myProfile || currentParticipant) && (
        <ProfileModal
          participant={room.myProfile || (currentParticipant as any)}
          roomCode={room.code}
          onClose={() => setShowProfile(false)}
          onSaved={(_updated) => {
            fetchRoom(room.code, participantId);
          }}
        />
      )}

      {/* Multi-Device Party Simulator Drawer (for local testing of guests) */}
      {room && (
        <PartySimulatorDrawer
          room={room}
          onRoomUpdated={() => fetchRoom(room.code, participantId)}
        />
      )}
    </div>
  );
};
