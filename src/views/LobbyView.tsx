import React, { useState, useEffect } from 'react';
import {
  Users,
  Sparkles,
  Gift,
  Play,
  Share2,
  Edit3,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Lock,
  Clock,
  UserCheck,
  RotateCcw,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';
import { ClientRoomView, PublicParticipant } from '../types';
import { sound } from '../lib/sound';
import { triggerHaptic } from '../lib/tg';
import { triggerSnowBurst } from '../lib/confetti';
import { AddQuestionModal } from '../components/AddQuestionModal';

interface LobbyProps {
  room: ClientRoomView;
  currentParticipant?: PublicParticipant | null;
  onDrawPairs: () => Promise<void>;
  onStartParty: () => void;
  onOpenProfile: () => void;
  onGoToMySanta: () => void;
  onGoToTv: () => void;
  onJoinDemoSandbox?: () => void;
}

export const LobbyView: React.FC<LobbyProps> = ({
  room,
  currentParticipant,
  onDrawPairs,
  onStartParty,
  onOpenProfile,
  onGoToMySanta,
  onGoToTv,
  onJoinDemoSandbox,
}) => {
  const [drawing, setDrawing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [quizStats, setQuizStats] = useState<{ totalQuestions: number; customCount: number } | null>(null);

  useEffect(() => {
    fetch('/api/quiz/stats')
      .then((r) => r.json())
      .then((data) => setQuizStats(data))
      .catch((e) => console.warn('Could not fetch quiz stats:', e));
  }, []);

  // Auto check-in if URL contains checkin=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkin') === 'true' && currentParticipant?.id && room?.code) {
      fetch(`/api/rooms/${room.code}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: currentParticipant.id }),
      }).catch((e) => console.warn('Lobby auto check-in error:', e));

      // Clean checkin param from URL without reload
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('checkin');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [currentParticipant?.id, room?.code]);

  const isHost = currentParticipant?.isHost;
  const isDemoRoom = room.code === 'SANTA-2026';

  const hostParticipant = room.participants.find((p) => p.isHost);

  const totalParticipants = room.participants.length;
  const readyParticipants = room.participants.filter((p) => p.isReady);
  const preparingParticipants = room.participants.filter((p) => !p.isReady);
  const readyPercent =
    totalParticipants > 0
      ? Math.round((readyParticipants.length / totalParticipants) * 100)
      : 0;
  const allReady = totalParticipants > 0 && readyParticipants.length === totalParticipants;


  const handleShare = () => {
    const url = window.location.origin + `?code=${room.code}`;
    if (navigator.share) {
      navigator.share({
        title: `Тайный Санта: ${room.title}`,
        text: `Присоединяйся к нашему Тайному Санте! Код комнаты: ${room.code}`,
        url,
      });
    } else {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
    triggerHaptic('light');
  };

  const handleDraw = async () => {
    if (room.participants.length < 2) {
      alert('Для жеребьевки нужно как минимум 2 участника!');
      return;
    }
    if (
      !confirm(
        'Провести жеребьевку? Пары будут секретно распределены между всеми участниками.'
      )
    ) {
      return;
    }

    setDrawing(true);
    triggerHaptic('heavy');
    try {
      await onDrawPairs();
      triggerSnowBurst();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDrawing(false);
    }
  };

  const formattedDate = new Date(room.eventDate).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 relative z-10">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-red-950/80 via-slate-900 to-amber-950/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-900/60 border border-red-800 text-red-200 text-xs font-semibold mb-2">
              <span>🎅 Комната вечеринки</span>
              <span>•</span>
              <span className="font-mono text-amber-300 font-bold">{room.code}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-festive">
              {room.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Встреча: <span className="text-emerald-400 font-semibold">{formattedDate}</span> • Лимит: <span className="text-amber-400 font-semibold">{room.budget}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedLink ? 'Ссылка скопирована!' : 'Позвать друзей'}</span>
            </button>

            <button
              onClick={onOpenProfile}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-semibold transition shadow-md shadow-amber-900/30"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Моя анкета</span>
            </button>
          </div>
        </div>

        {/* Demo Sandbox Quick Join/Reset Banner */}
        {isDemoRoom && onJoinDemoSandbox && (
          <div className="mt-4 p-3 rounded-2xl bg-amber-950/40 border border-amber-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-200">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Тестовый полигон с друзьями:</strong> в комнате уже собрались Олег, Лена, Дима и Аня.
              </span>
            </div>
            <button
              onClick={onJoinDemoSandbox}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition shrink-0 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Перемешать с моим участием</span>
            </button>
          </div>
        )}

        {/* Action alerts depending on status & host role */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {room.status === 'lobby' ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-300 text-xs">
                <Users className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Гостей в комнате: <strong className="text-white">{room.participants.length}</strong>.
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {isHost ? (
                  <span className="text-amber-300 font-medium">
                    👑 Вы администратор комнаты. Когда все гости соберутся, нажмите «Провести жеребьевку».
                  </span>
                ) : (
                  <span>
                    Организатор: <strong className="text-slate-200">{hostParticipant?.name || 'Хост'}</strong>. Ожидаем запуска жеребьевки.
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-emerald-300 text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                <strong>Жеребьевка проведена!</strong> Секретные пары распределены.
                Узнайте, кому вы дарите, во вкладке{' '}
                <strong
                  className="underline cursor-pointer text-amber-300"
                  onClick={onGoToMySanta}
                >
                  «Мой подарок»
                </strong>
                .
              </span>
            </div>
          )}

          {/* Host Draw or Start party button */}
          {isHost && (
            <div>
              {room.status === 'lobby' ? (
                <button
                  onClick={handleDraw}
                  disabled={drawing || room.participants.length < 2}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-red-900/40 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{drawing ? 'Перемешиваем...' : 'Провести жеребьевку 🎲'}</span>
                </button>
              ) : (
                <button
                  onClick={onGoToTv}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 transition flex items-center gap-2 glow-emerald"
                >
                  <Play className="w-4 h-4" />
                  <span>Открыть Jackbox Party на ТВ 📺</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Secret recipient shortcut banner */}
      {room.status !== 'lobby' && (
        <div
          onClick={onGoToMySanta}
          className="bg-gradient-to-r from-amber-500/20 to-red-500/20 border border-amber-500/40 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-amber-400 transition shadow-lg group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition">
              🎁
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-200">
                Кто твой подопечный?
              </h4>
              <p className="text-xs text-slate-300">
                Открой сургучный конверт, чтобы увидеть персональный вишлист и загрузить улики для ТВ!
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-300 group-hover:translate-x-1 transition" />
        </div>
      )}

      {/* Aggregated Party Readiness Progress (R1) */}
      <div className="bg-gradient-to-br from-slate-900/90 via-slate-900 to-slate-950/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
              🎁
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Готовность к вечеру подарков</span>
                {allReady && (
                  <span className="text-[11px] bg-emerald-950 text-emerald-300 border border-emerald-700/80 px-2 py-0.5 rounded-full font-bold">
                    Все готовы! 🎄
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Синхронизация готовности гостей и подарков перед показом на большом экране
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-bold text-amber-300 font-mono bg-amber-950/80 border border-amber-800/80 px-3 py-1.5 rounded-xl tabular-nums shadow-sm">
              {readyParticipants.length} из {totalParticipants} участников готовы ({readyPercent}%)
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-950 rounded-full h-3.5 p-0.5 border border-slate-800/90 overflow-hidden relative shadow-inner">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
              style={{ width: `${Math.max(readyPercent, totalParticipants === 0 ? 0 : 3)}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium px-1">
            <span>0%</span>
            <span>50%</span>
            <span className={allReady ? 'text-emerald-400 font-bold' : ''}>
              100% {allReady ? '🎉' : ''}
            </span>
          </div>
        </div>

        {/* Ready vs Preparing Participants Lists */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Ready participants */}
          <div className="bg-slate-950/60 border border-emerald-900/40 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Готовы к вечеринке ({readyParticipants.length})</span>
              </span>
            </div>
            {readyParticipants.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {readyParticipants.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 text-xs bg-emerald-950/80 text-emerald-200 border border-emerald-800/80 px-2.5 py-1 rounded-xl font-medium"
                  >
                    <span>{p.avatar}</span>
                    <span>{p.name}</span>
                    <span className="text-[10px] text-emerald-400 font-bold">🎁</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Пока никто не нажал подтверждение готовности
              </p>
            )}
          </div>

          {/* Preparing participants */}
          <div className="bg-slate-950/60 border border-amber-900/30 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Готовятся ({preparingParticipants.length})</span>
              </span>
            </div>
            {preparingParticipants.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {preparingParticipants.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 text-xs bg-slate-900 text-slate-300 border border-slate-800 px-2.5 py-1 rounded-xl"
                  >
                    <span>{p.avatar}</span>
                    <span>{p.name}</span>
                    <span className="text-[10px] text-amber-400">⏳</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Все гости готовы к началу вечера!</span>
              </p>
            )}
          </div>
        </div>

        {/* Active Host Prompt to initiate TV gathering */}
        {isHost ? (
          <div
            className={`rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 ${
              allReady
                ? 'bg-gradient-to-r from-emerald-950/90 via-teal-950/80 to-slate-900 border-2 border-emerald-500 shadow-xl shadow-emerald-950/50'
                : readyParticipants.length > 0
                ? 'bg-gradient-to-r from-amber-950/60 via-slate-900 to-emerald-950/40 border border-amber-500/50'
                : 'bg-slate-950/50 border border-slate-800/80'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">{allReady ? '🚀' : readyParticipants.length > 0 ? '✨' : '👑'}</span>
                <h4 className="text-sm sm:text-base font-bold text-white">
                  {allReady
                    ? 'Все участники готовы к вечеринке!'
                    : readyParticipants.length > 0
                    ? `Участники готовы (${readyParticipants.length} из ${totalParticipants})`
                    : 'Ожидание готовности участников'}
                </h4>
              </div>
              <p className="text-xs text-slate-300 max-w-xl">
                {allReady
                  ? 'Все гости приготовили подарки и подтвердили участие! Нажимайте кнопку ниже, чтобы собрать всех перед экраном ТВ и запустить праздник.'
                  : readyParticipants.length > 0
                  ? 'Часть гостей уже готова. Вы можете подождать остальных или уже открыть ТВ-экран в гостиной для сбора.'
                  : 'Попросите участников открыть вкладку «Мой подарок» и подтвердить готовность подарка к вечеринке.'}
              </p>
            </div>

            <button
              onClick={onGoToTv}
              className={`px-6 py-3 rounded-xl font-extrabold text-xs sm:text-sm shadow-xl transition flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-center active:scale-[0.98] ${
                allReady
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-950/60 animate-bounce'
                  : readyParticipants.length > 0
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                {allReady
                  ? 'Начать вечеринку на ТВ 📺'
                  : 'Запустить сбор у ТВ 📺'}
              </span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl p-3.5 bg-slate-950/50 border border-slate-800/80 flex items-center gap-3 text-xs text-slate-300">
            <span className="text-lg">📺</span>
            <div>
              {allReady ? (
                <span className="text-emerald-300 font-semibold">
                  Все гости готовы к началу! Организатор вот-вот запустит шоу на большом экране ТВ.
                </span>
              ) : (
                <span>
                  Подтвердите готовность своего подарка во вкладке{' '}
                  <strong
                    className="text-amber-300 underline cursor-pointer"
                    onClick={onGoToMySanta}
                  >
                    «Мой подарок»
                  </strong>
                  , чтобы организатор мог начать вечеринку на ТВ!
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Festive Quiz / Trivia Bank Banner */}

      <div className="bg-gradient-to-r from-violet-950/40 via-indigo-950/30 to-purple-950/40 border border-indigo-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-2xl shrink-0">
            🧠
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-indigo-200">
                Праздничная Викторина в стиле Jackbox
              </h4>
              <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700/60 px-2 py-0.5 rounded-full font-bold">
                {quizStats?.totalQuestions || '120+'} вопросов
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Перед подарками и в перерывах игроков ждут остроумные праздничные вопросы с объяснениями «Почему именно так?».
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            triggerHaptic('light');
            setIsAddQuestionOpen(true);
          }}
          className="px-3.5 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-md shadow-indigo-950/40 shrink-0 self-stretch sm:self-auto justify-center"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Добавить свой вопрос 💡</span>
        </button>
      </div>

      {/* Privacy Guarantee Notice */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
        <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          <strong>Строгая конфиденциальность:</strong> чужие вишлисты засекречены. Их увидит только тот единственный Санта, которому выпал человек по жребию.
        </span>
      </div>

      {/* Participants Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-red-400" />
            <span>Участники вечеринки ({room.participants.length})</span>
          </h3>
          <span className="text-xs text-slate-400">
            {room.participants.filter((p) => p.hasWishlist).length} из {room.participants.length} заполнили вишлист
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {room.participants.map((p) => {
            const isMe = currentParticipant?.id === p.id;

            return (
              <div
                key={p.id}
                className={`bg-slate-900/90 border rounded-2xl p-4 transition relative flex flex-col justify-between ${
                  isMe
                    ? 'border-red-500/80 shadow-lg shadow-red-950/30 ring-1 ring-red-500/30'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-3xl">{p.avatar}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-slate-100 text-sm">
                            {p.name}
                          </h4>
                          {isMe && (
                            <span className="text-[10px] bg-red-950 text-red-300 border border-red-800 px-1.5 py-0.2 rounded font-semibold">
                              Вы
                            </span>
                          )}
                        </div>
                        {p.isHost && (
                          <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-0.5">
                            👑 Организатор
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {p.checkedIn ? (
                        <span className="text-[10px] bg-emerald-950/90 text-emerald-300 border border-emerald-500/70 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>В зале 🎮</span>
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-medium">
                          Ожидаем 📱
                        </span>
                      )}

                      {p.isReady ? (
                        <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                          Готов 🎁
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                          Готовится
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Public Hobbies Tags */}
                  {p.hobbies && p.hobbies.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {p.hobbies.map((h) => (
                        <span
                          key={h}
                          className="text-[10px] bg-slate-950 text-slate-300 px-2 py-0.5 rounded-md border border-slate-800"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Privacy Status Indicators */}
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                      <span className="text-slate-400">Вишлист:</span>
                      {p.hasWishlist ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Заполнен (скрыт)</span>
                        </span>
                      ) : (
                        <span className="text-amber-400 font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>В процессе</span>
                        </span>
                      )}
                    </div>

                    {p.hasAntiWishlist && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-red-950/20 border border-red-900/30">
                        <span className="text-red-300">Стоп-лист:</span>
                        <span className="text-red-400 font-semibold">Указан 🚫</span>
                      </div>
                    )}
                  </div>
                </div>

                {isMe && (
                  <button
                    onClick={onOpenProfile}
                    className="mt-3 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center justify-center gap-1.5 border border-slate-700"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Редактировать мою анкету</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AddQuestionModal
        isOpen={isAddQuestionOpen}
        onClose={() => setIsAddQuestionOpen(false)}
        onQuestionAdded={() => {
          fetch('/api/quiz/stats')
            .then((r) => r.json())
            .then((data) => setQuizStats(data))
            .catch(() => {});
        }}
      />
    </div>
  );
};
