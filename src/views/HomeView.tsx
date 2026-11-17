import React, { useState, useEffect } from 'react';
import { Sparkles, Gift, Tv, ArrowRight, Calendar, DollarSign, User, ShieldCheck, CheckCircle2, Users, Plus, ChevronLeft, Loader2 } from 'lucide-react';
import { PublicParticipant } from '../types';
import { getSocket } from '../lib/socket';
import { sound } from '../lib/sound';
import { getTelegramWebApp, triggerHaptic } from '../lib/tg';

interface HomeProps {
  onRoomJoined: (roomCode: string, participantId: string) => void;
  initialCode?: string;
}

const AVATARS = ['🎅', '🤶', '⛄', '🎄', '🦌', '🎁', '🐻', '🦊', '🐧', '🦉', '🍪', '🥂'];

export const HomeView: React.FC<HomeProps> = ({ onRoomJoined, initialCode = '' }) => {
  const [mode, setMode] = useState<'join' | 'create'>(initialCode ? 'join' : 'join');
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🎅');
  const [existingParticipants, setExistingParticipants] = useState<PublicParticipant[]>([]);
  const [showManualJoin, setShowManualJoin] = useState(false);
  const [fetchingRoom, setFetchingRoom] = useState(false);
  
  // Create room fields
  const [title, setTitle] = useState('Новогодний Санта 2026');
  const [budget, setBudget] = useState('до 3 000 ₽');
  const [eventDate, setEventDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fetch room participants when code changes or initially provided
  useEffect(() => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 3) {
      setExistingParticipants([]);
      return;
    }

    let isMounted = true;
    setFetchingRoom(true);
    fetch(`/api/rooms/${cleanCode}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.view?.participants) {
          setExistingParticipants(data.view.participants);
        } else if (isMounted) {
          setExistingParticipants([]);
        }
      })
      .catch(() => {
        if (isMounted) setExistingParticipants([]);
      })
      .finally(() => {
        if (isMounted) setFetchingRoom(false);
      });

    return () => {
      isMounted = false;
    };
  }, [code]);

  const handleClaimParticipant = async (p: PublicParticipant) => {
    const cleanCode = code.trim().toUpperCase();
    triggerHaptic('heavy');
    sound.play('pop');
    setLoading(true);

    try {
      localStorage.setItem('santa_participant_id', p.id);
      localStorage.setItem(`santa_participant_id_${cleanCode}`, p.id);
      localStorage.setItem('santa_room_code', cleanCode);

      // Trigger check-in
      await fetch(`/api/rooms/${cleanCode}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: p.id }),
      }).catch(() => {});

      const s = getSocket();
      s.emit('party:player_checkin', {
        code: cleanCode,
        participantId: p.id,
      });

      onRoomJoined(cleanCode, p.id);
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill name from Telegram WebApp if available
  useEffect(() => {
    const tg = getTelegramWebApp();
    if (tg?.initDataUnsafe?.user) {
      const u = tg.initDataUnsafe.user;
      setName(u.first_name + (u.last_name ? ` ${u.last_name}` : ''));
    }
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError('Введите код комнаты и ваше имя');
      return;
    }

    setLoading(true);
    setError(null);
    triggerHaptic('medium');

    try {
      const res = await fetch(`/api/rooms/${code.trim().toUpperCase()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          avatar,
          tgUsername: getTelegramWebApp()?.initDataUnsafe?.user?.username,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка при входе');

      sound.play('pop');
      onRoomJoined(code.trim().toUpperCase(), data.participant.id);
    } catch (err: any) {
      setError(err.message);
      triggerHaptic('error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Укажите ваше имя организатора');
      return;
    }

    setLoading(true);
    setError(null);
    triggerHaptic('medium');

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          budget,
          eventDate,
          hostName: name.trim(),
          avatar,
          tgUsername: getTelegramWebApp()?.initDataUnsafe?.user?.username,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка создания комнаты');

      sound.play('fanfare');
      onRoomJoined(data.roomCode, data.host.id);
    } catch (err: any) {
      setError(err.message);
      triggerHaptic('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      {/* Decorative Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-950/70 border border-red-800/80 text-red-300 text-xs font-semibold mb-6 shadow-lg shadow-red-950/40">
        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
        <span>Jackbox Party Edition • Вечеринка дарения на ТВ</span>
      </div>

      {/* Main Title */}
      <div className="text-center max-w-xl mx-auto mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-3 font-festive">
          🎅 Тайный Санта
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Не просто скучная жеребьевка, а <span className="text-amber-400 font-semibold">настоящее праздничное шоу</span> в гостиной! Включайте на ТВ, угадывайте Санту с телефонов, смотрите секретный бэкстейдж покупок и взрывайте зал овациями!
        </p>
      </div>

      {/* Card container */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Glow corner */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-amber-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Mode Toggle */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl mb-6 border border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('join');
              setError(null);
            }}
            className={`py-2.5 rounded-xl transition ${
              mode === 'join'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Войти в комнату
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('create');
              setError(null);
            }}
            className={`py-2.5 rounded-xl transition ${
              mode === 'create'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Создать комнату
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700/60 rounded-xl text-red-200 text-xs text-center font-medium">
            {error}
          </div>
        )}

        {/* JOIN FORM */}
        {mode === 'join' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Код комнаты (с экрана ТВ)
              </label>
              <input
                type="text"
                placeholder="SANTA-4921"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setShowManualJoin(false);
                }}
                className="w-full bg-slate-950/80 border border-slate-700 focus:border-red-500 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold text-white tracking-widest placeholder-slate-600 outline-none transition"
                required
              />
            </div>

            {fetchingRoom && (
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                <span>Загрузка участников комнаты...</span>
              </div>
            )}

            {existingParticipants.length > 0 && !showManualJoin ? (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    Выбери себя из списка:
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {existingParticipants.length} участников
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 pr-1.5">
                  {existingParticipants.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={loading}
                      onClick={() => handleClaimParticipant(p)}
                      className="group relative flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700/60 hover:border-red-500/60 text-left transition active:scale-95 disabled:opacity-50"
                    >
                      <span className="text-2xl flex-shrink-0 group-hover:scale-110 transition-transform">
                        {p.avatar || '🎅'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                          {p.isHost ? (
                            <span className="text-amber-400 font-semibold">Организатор</span>
                          ) : p.checkedIn ? (
                            <span className="text-emerald-400 font-medium">✓ В зале</span>
                          ) : (
                            <span>Нажми для входа</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowManualJoin(true)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-400 hover:text-white transition flex items-center justify-center gap-1.5 mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Меня нет в списке (Новый гость)</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleJoin} className="space-y-4">
                {existingParticipants.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowManualJoin(false)}
                    className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-medium transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Вернуться к списку игроков ({existingParticipants.length})</span>
                  </button>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Ваше имя / Ник
                  </label>
                  <input
                    type="text"
                    placeholder="Например: Саша"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700 focus:border-red-500 rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition text-sm"
                    required
                  />
                </div>

                {/* Avatar Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Выберите праздничный аватар
                  </label>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {AVATARS.map((av) => (
                      <button
                        key={av}
                        type="button"
                        onClick={() => setAvatar(av)}
                        className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition ${
                          avatar === av
                            ? 'bg-red-600 scale-110 shadow-md ring-2 ring-white/50'
                            : 'bg-slate-800 hover:bg-slate-700'
                        }`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 font-bold rounded-xl text-white shadow-lg shadow-red-900/40 transition flex items-center justify-center gap-2 mt-4 text-sm disabled:opacity-50"
                >
                  <span>{loading ? 'Входим...' : 'Присоединиться к празднику'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* CREATE FORM */}
        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Название мероприятия
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700 focus:border-red-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 outline-none transition text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-amber-400" />
                  Бюджет
                </label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2 text-white text-xs outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-emerald-400" />
                  Дата встречи
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2 text-white text-xs outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <User className="w-3 h-3 text-red-400" />
                Ваше имя (Организатор)
              </label>
              <input
                type="text"
                placeholder="Как вас зовут?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700 focus:border-red-500 rounded-xl px-4 py-2.5 text-white outline-none transition text-sm"
                required
              />
            </div>

            {/* Avatar Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Ваш аватар
              </label>
              <div className="flex flex-wrap gap-2 justify-center">
                {AVATARS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setAvatar(av)}
                    className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition ${
                      avatar === av
                        ? 'bg-red-600 scale-110 shadow-md ring-2 ring-white/50'
                        : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 font-bold rounded-xl text-white shadow-lg shadow-red-900/40 transition flex items-center justify-center gap-2 mt-4 text-sm disabled:opacity-50"
            >
              <span>{loading ? 'Создаем...' : 'Создать комнату вечеринки'}</span>
              <Sparkles className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      {/* Features preview footer */}
      <div className="mt-8 grid grid-cols-3 gap-4 max-w-md text-center text-xs text-slate-400">
        <div className="p-2.5 bg-slate-900/50 rounded-xl border border-slate-800">
          <Tv className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <span>Режим ТВ-шоу</span>
        </div>
        <div className="p-2.5 bg-slate-900/50 rounded-xl border border-slate-800">
          <Gift className="w-4 h-4 text-amber-400 mx-auto mb-1" />
          <span>Вишлист & Мемы</span>
        </div>
        <div className="p-2.5 bg-slate-900/50 rounded-xl border border-slate-800">
          <ShieldCheck className="w-4 h-4 text-red-400 mx-auto mb-1" />
          <span>Без самодарения</span>
        </div>
      </div>
    </div>
  );
};
