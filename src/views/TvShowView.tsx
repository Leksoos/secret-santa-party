import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tv,
  Sparkles,
  Trophy,
  ChevronRight,
  HelpCircle,
  Gift,
  CheckCircle2,
  Clock,
  Award,
  Search,
  Eye,
  Volume2,
  Users,
  Wifi,
  Smartphone,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { ClientRoomView, PublicParticipant } from '../types';
import { PolaroidCard } from '../components/PolaroidCard';
import { AudioToggle } from '../components/AudioToggle';
import { NetworkSettingsModal } from '../components/NetworkSettingsModal';
import { HostQrModal } from '../components/HostQrModal';
import {
  NetworkInfoResponse,
  computeBaseUrl,
  fetchNetworkInfo,
  getNetworkOverride,
} from '../lib/network';
import { sound } from '../lib/sound';
import { triggerConfetti, triggerSnowBurst } from '../lib/confetti';
import { getGenitiveName, getDativeName } from '../lib/declension';
import { getSocket } from '../lib/socket';
import QRCode from 'qrcode';

const QUIZ_OPTION_STYLES = [
  {
    label: 'A',
    bg: 'bg-rose-500/10 hover:bg-rose-500/20',
    border: 'border-rose-500/40',
    badge: 'bg-rose-500 text-white shadow-rose-900/50',
  },
  {
    label: 'B',
    bg: 'bg-blue-500/10 hover:bg-blue-500/20',
    border: 'border-blue-500/40',
    badge: 'bg-blue-500 text-white shadow-blue-900/50',
  },
  {
    label: 'C',
    bg: 'bg-amber-500/10 hover:bg-amber-500/20',
    border: 'border-amber-500/40',
    badge: 'bg-amber-500 text-white shadow-amber-900/50',
  },
  {
    label: 'D',
    bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
    border: 'border-emerald-500/40',
    badge: 'bg-emerald-500 text-white shadow-emerald-900/50',
  },
  {
    label: 'E',
    bg: 'bg-purple-500/10 hover:bg-purple-500/20',
    border: 'border-purple-500/40',
    badge: 'bg-purple-500 text-white shadow-purple-900/50',
  },
  {
    label: 'F',
    bg: 'bg-cyan-500/10 hover:bg-cyan-500/20',
    border: 'border-cyan-500/40',
    badge: 'bg-cyan-500 text-white shadow-cyan-900/50',
  },
];

interface TvShowProps {
  room: ClientRoomView;
  isHost: boolean;
  onNextStep: () => void;
  onStartParty: () => void;
}

export const TvShowView: React.FC<TvShowProps> = ({
  room,
  isHost,
  onNextStep,
  onStartParty,
}) => {
  const party = room.party;
  const currentStep = party.currentStep;
  const receiver = party.currentReceiver;
  const revealedGiver = party.revealedGiver;
  const photos = party.currentPhotos || [];
  const riddle = party.currentRiddle;
  const nominations = party.nominations;

  // Eligible voters (all participants except current receiver and secret Santa)
  const eligibleVoters = room.participants.filter(
    (p) => p.id !== receiver?.id && p.id !== party.currentGiverId
  );
  const eligibleCount = Math.max(1, eligibleVoters.length);
  const allVoted = party.guessesCount >= eligibleCount;

  // Central QR Code & Live Check-in State
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [welcomeToast, setWelcomeToast] = useState<{ name: string; avatar: string } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Network & Smart QR State (Milestone 2)
  const [networkInfo, setNetworkInfo] = useState<NetworkInfoResponse | null>(null);
  const [activeBaseUrl, setActiveBaseUrl] = useState<string>(() =>
    computeBaseUrl(null, getNetworkOverride())
  );
  const [showNetworkModal, setShowNetworkModal] = useState<boolean>(false);
  const [showHostQrModal, setShowHostQrModal] = useState<boolean>(false);

  // Discover LAN / Wi-Fi IP on mount
  useEffect(() => {
    let isMounted = true;
    fetchNetworkInfo().then((info) => {
      if (isMounted && info) {
        setNetworkInfo(info);
        const resolved = computeBaseUrl(info, getNetworkOverride());
        setActiveBaseUrl(resolved);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fullscreen state and handler for TV
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    return typeof document !== 'undefined' ? !!document.fullscreenElement : false;
  });

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  // Screen Wake Lock API to prevent TV screen from going to sleep
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        // WakeLock may not be allowed or supported in this browser
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  // Audio gesture unlock
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);

  useEffect(() => {
    const handleUserInteraction = () => {
      setAudioUnlocked(true);
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);
    window.addEventListener('touchstart', handleUserInteraction);
    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  // Generate high-contrast QR code for TV Lobby using smart LAN / tunnel base URL
  useEffect(() => {
    if (party.status === 'not_started' && room.code) {
      const joinUrl = `${activeBaseUrl}/?code=${room.code}&checkin=true`;
      QRCode.toDataURL(joinUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate TV lobby QR code:', err));
    }
  }, [party.status, room.code, activeBaseUrl]);

  // Listen for real-time check-in events on TV screen
  useEffect(() => {
    const s = getSocket();
    const handleCheckedIn = (data: { participantId: string; name: string; avatar: string }) => {
      sound.playChime();
      triggerSnowBurst();
      setWelcomeToast({
        name: data.name,
        avatar: data.avatar,
      });
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setWelcomeToast(null);
      }, 4500);
    };

    s.on('participant:checked_in', handleCheckedIn);
    return () => {
      s.off('participant:checked_in', handleCheckedIn);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Roulette animation & 5-second auto-advance state
  const [rouletteName, setRouletteName] = useState<string>('');
  const [rouletteFinished, setRouletteFinished] = useState(false);
  const [rouletteCountdown, setRouletteCountdown] = useState<number>(5);

  const isTimedStep = currentStep === 'guess' || currentStep === 'quiz_question' || currentStep === 'quiz_reveal' || currentStep === 'countdown';

  // Voting and Quiz countdown timer synchronized from server stepStartTime
  const computeRemainingSeconds = () => {
    if (!isTimedStep) return 0;
    const duration = party.timerDuration || (currentStep === 'countdown' ? 5 : currentStep === 'quiz_reveal' ? 10 : currentStep === 'quiz_question' ? 20 : 25);
    const startTime = party.stepStartTime || Date.now();
    const elapsed = (Date.now() - startTime) / 1000;
    return Math.max(0, Math.ceil(duration - elapsed));
  };

  const [countdown, setCountdown] = useState<number>(computeRemainingSeconds);
  const autoAdvanceRef = useRef(false);

  useEffect(() => {
    if (isTimedStep) {
      autoAdvanceRef.current = false;
      const initialRemaining = computeRemainingSeconds();
      setCountdown(initialRemaining);

      const timerInterval = setInterval(() => {
        const remaining = computeRemainingSeconds();
        setCountdown((prev) => {
          const current = Math.min(prev, remaining);
          if (current <= 1) {
            clearInterval(timerInterval);
            // Automatic advance to next step when timer expires!
            if (isHost && !autoAdvanceRef.current) {
              autoAdvanceRef.current = true;
              if (currentStep === 'countdown') {
                sound.play('pop');
              } else if (currentStep === 'quiz_reveal') {
                sound.play('bells');
              } else if (currentStep === 'quiz_question') {
                sound.play('mystery');
              } else {
                sound.play('camera');
              }
              onNextStep();
            }
            return 0;
          }
          if (current <= 4) {
            sound.play('countdown');
          }
          return current - 1;
        });
      }, 1000);

      return () => clearInterval(timerInterval);
    }
  }, [currentStep, party.stepStartTime, party.timerDuration, isHost, onNextStep, isTimedStep]);

  // Fast-forward countdown when all participants submitted answers
  const allQuizAnswered = Boolean(
    party.quiz && (party.quiz.answersCount || 0) >= room.participants.length
  );

  useEffect(() => {
    if (currentStep === 'guess' && allVoted) {
      setCountdown((prev) => Math.min(prev, 3));
      sound.play('countdown');
    } else if (currentStep === 'quiz_question' && allQuizAnswered) {
      setCountdown((prev) => Math.min(prev, 3));
      sound.play('countdown');
    }
  }, [currentStep, allVoted, allQuizAnswered]);

  // Roulette spin
  useEffect(() => {
    if (currentStep === 'roulette' && receiver) {
      setRouletteFinished(false);
      setRouletteCountdown(5);
      sound.play('roulette');

      let count = 0;
      const participants = room.participants;
      const interval = setInterval(() => {
        const randomP = participants[Math.floor(Math.random() * participants.length)];
        setRouletteName(randomP.name);
        count++;
        if (count > 18) {
          clearInterval(interval);
          setRouletteName(receiver.name);
          setRouletteFinished(true);
          sound.play('bells');
        }
      }, 110);

      return () => clearInterval(interval);
    }
  }, [currentStep, receiver, room.participants]);

  // Roulette auto-advance 5 seconds after stopping on recipient
  useEffect(() => {
    if (currentStep === 'roulette' && rouletteFinished) {
      setRouletteCountdown(5);
      const timer = setInterval(() => {
        setRouletteCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            if (isHost) {
              onNextStep();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentStep, rouletteFinished, isHost, onNextStep]);

  // Confetti on reveal & finished, sound on quiz reveal
  useEffect(() => {
    if (currentStep === 'reveal' || currentStep === 'finished') {
      sound.play('fanfare');
      triggerConfetti();
    } else if (currentStep === 'quiz_reveal') {
      sound.play('fanfare');
    }
  }, [currentStep]);

  // Leaderboard ranking: includes 100% of participants, even with 0 points
  const leaderboard = room.participants
    .map((p) => ({
      participant: p,
      score: party.scores[p.id] || 0,
    }))
    .sort((a, b) => b.score - a.score);

  const hostName = room.participants.find((p) => p.isHost)?.name || 'Хост';

  // Contextual step label for host
  const getNextStepLabel = () => {
    switch (currentStep) {
      case 'countdown':
        return 'ПРОПУСТИТЬ ОТСЧЕТ ⏩';
      case 'question_builder':
        return 'НАЧАТЬ ВИКТОРИНУ 🚀';
      case 'quiz_question':
        return 'ПОКАЗАТЬ ОТВЕТ 💡';
      case 'quiz_reveal':
        if (party.quiz && !party.quiz.isLastInBatch) {
          return 'СЛЕДУЮЩИЙ ВОПРОС ➡️';
        }
        return party.quiz?.nextStepAfterQuiz === 'finished'
          ? 'ИТОГИ ВЕЧЕРИНКИ 🏆'
          : 'ПЕРЕЙТИ К ПОДАРКАМ 🎁';
      case 'riddle':
        return 'ПЕРЕЙТИ К ГОЛОСОВАНИЮ 🗳️';
      case 'guess':
        return 'ПОКАЗАТЬ УЛИКИ 📸';
      case 'photos':
        return 'РАСКРЫТЬ САНТУ 🎉';
      case 'reveal':
        return party.currentPairIndex + 1 < party.totalPairs
          ? 'СЛЕДУЮЩИЙ ПОДАРОК 🎁'
          : 'ИТОГИ ВЕЧЕРИНКИ 🏆';
      default:
        return 'СЛЕДУЮЩИЙ ШАГ';
    }
  };

  // Grammatically correct receiver names
  const receiverGenitive = receiver ? getGenitiveName(receiver.name) : '';
  const receiverDative = receiver ? getDativeName(receiver.name) : '';

  return (
    <div className="min-h-[85vh] flex flex-col justify-between p-4 sm:p-8 max-w-6xl mx-auto relative z-10 select-none">
      {/* Live Check-in Animated Toast Banner */}
      <AnimatePresence>
        {welcomeToast && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -25, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white px-7 py-3.5 rounded-2xl shadow-2xl border-2 border-emerald-300 flex items-center gap-3.5 glow-emerald pointer-events-none"
          >
            <span className="text-3xl animate-bounce">{welcomeToast.avatar}</span>
            <div className="text-left">
              <div className="text-[11px] uppercase tracking-wider font-extrabold text-emerald-100 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>ГОСТЬ ВОШЕЛ В ЗАЛ! 🎮</span>
              </div>
              <div className="text-base sm:text-lg font-black text-white">
                {welcomeToast.name} подключился к вечеринке!
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top TV Bar */}
      <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 backdrop-blur-md rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-red-600/90 text-white font-bold text-xs uppercase tracking-widest px-3 py-1 rounded-full shadow">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>JACKBOX SHOW ON TV</span>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-slate-200 hidden sm:block">
            {room.title}
          </h2>
        </div>

        {/* Pair Counter or Quiz Counter */}
        {party.status === 'active' && party.quiz ? (
          <div className="flex items-center gap-2 bg-indigo-950/90 px-4 py-1.5 rounded-xl border border-indigo-700/60 shadow-lg">
            <span className="text-base">🧠</span>
            <span className="text-xs font-mono font-bold text-indigo-300">
              Вопрос {party.quiz.questionIndex + 1} из {party.quiz.totalQuestions}
            </span>
          </div>
        ) : party.status === 'active' && (
          <div className="flex items-center gap-2 bg-slate-950 px-4 py-1.5 rounded-xl border border-slate-800">
            <Gift className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono font-bold text-amber-300">
              Подарок {party.currentPairIndex + 1} из {party.totalPairs}
            </span>
          </div>
        )}

        {/* Host Step Controls vs Viewer Status + Audio Unmute Button */}
        <div className="flex items-center gap-2.5">
          <AudioToggle />

          {/* Fullscreen TV Mode */}
          <button
            onClick={toggleFullscreen}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            title={isFullscreen ? 'Выйти из полноэкранного режима' : 'Во весь экран (для ТВ)'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="hidden sm:inline">{isFullscreen ? 'Окно' : '⛶ ТВ'}</span>
          </button>

          {/* Network Settings & LAN IP switch button */}
          <button
            onClick={() => setShowNetworkModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="Настройки сети и QR-кода"
          >
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">⚙️ Сеть</span>
          </button>

          {/* Host Mobile QR / Controller button */}
          <button
            onClick={() => setShowHostQrModal(true)}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg border border-amber-300/40 flex items-center gap-1.5 transition active:scale-95 cursor-pointer glow-gold"
            title="Открыть пульт ведущего на смартфоне"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Пульт ведущего 📱</span>
            <span className="sm:hidden">Пульт 📱</span>
          </button>

          {isHost ? (
            party.status === 'not_started' ? (
              <button
                onClick={onStartParty}
                className="px-5 py-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-1.5 animate-pulse cursor-pointer"
              >
                <span>НАЧАТЬ ВЕЧЕР ДАРЕНИЯ 🚀</span>
              </button>
            ) : party.status === 'active' && currentStep !== 'roulette' ? (
              <button
                onClick={onNextStep}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-1.5 glow-emerald cursor-pointer"
              >
                <span>{getNextStepLabel()}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : null
          ) : (
            <div className="text-xs text-amber-300 bg-amber-950/50 border border-amber-800/60 px-3 py-1.5 rounded-xl font-medium">
              👑 Управляет организатор: <strong>{hostName}</strong>
            </div>
          )}
        </div>
      </div>

      {/* --- STEP 0: NOT STARTED / CENTRAL QR LOBBY --- */}
      {party.status === 'not_started' && (
        <div className="my-auto text-center py-6 max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Prominent High-Contrast Central QR Code Card (lg:col-span-5) */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-2xl border-4 border-amber-400/90 max-w-sm w-full glow-gold text-slate-900 transition-all duration-300 hover:scale-[1.02]">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-lg">📱</span>
                  <span className="text-xs uppercase tracking-widest font-black text-slate-800">
                    ВХОД И ПУЛЬТ ИГРОКА
                  </span>
                </div>

                <div className="relative bg-white p-2 rounded-2xl border border-slate-200 shadow-inner flex items-center justify-center">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR код комнаты ${room.code}`}
                      className="w-56 h-56 sm:w-64 sm:h-64 mx-auto rounded-xl block"
                    />
                  ) : (
                    <div className="w-56 h-56 sm:w-64 sm:h-64 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                      <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      <span>Генерация QR-кода...</span>
                    </div>
                  )}
                </div>

                {/* Large Room Code Badge */}
                <div className="mt-4 bg-slate-950 text-amber-300 font-mono font-black text-3xl py-2 px-4 rounded-2xl tracking-widest shadow-lg border border-amber-500/50 flex items-center justify-center gap-2">
                  <span>{room.code}</span>
                </div>

                <p className="text-xs text-slate-600 mt-3 font-bold leading-snug">
                  Отсканируйте камерой смартфона для входа и пульта 🎮
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-1 select-all break-all">
                  {activeBaseUrl}/?code={room.code}
                </p>

                {/* Network IP switch & Host Mobile QR links inside Lobby Card */}
                <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-center gap-3 text-[11px]">
                  <button
                    onClick={() => setShowNetworkModal(true)}
                    className="text-slate-500 hover:text-slate-800 underline underline-offset-2 flex items-center gap-1 cursor-pointer transition font-medium"
                    title="Настроить IP или туннель"
                  >
                    <Wifi className="w-3 h-3 text-emerald-600" />
                    <span>⚙️ Сменить IP / Туннель</span>
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    onClick={() => setShowHostQrModal(true)}
                    className="text-amber-700 hover:text-amber-900 underline underline-offset-2 flex items-center gap-1 cursor-pointer transition font-bold"
                    title="Открыть QR пульта ведущего"
                  >
                    <Smartphone className="w-3 h-3 text-amber-600" />
                    <span>📱 Пульт ведущего</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Information & Presence Column (lg:col-span-7) */}
            <div className="lg:col-span-7 text-left space-y-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/40 text-red-300 text-xs font-bold mb-2">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <span>ИНТЕРАКТИВНЫЙ ТВ-ЗАЛ</span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-extrabold text-white font-festive drop-shadow-md leading-tight">
                  {room.title}
                </h1>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  Подключайтесь со смартфонов! Сканируйте QR-код, чтобы получить личный игровой пульт для викторины, голосований и праздничных реакций.
                </p>
              </div>

              {/* Check-in Presence Stats Summary Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>В зале: <strong className="text-emerald-400">{room.participants.filter((p) => p.checkedIn).length}</strong> из {room.participants.length}</span>
                  </span>
                  <span className="font-semibold text-amber-400">
                    {room.participants.filter((p) => p.isReady).length} подтвердили подарки 🎁
                  </span>
                </div>

                {/* Participants List with Presence Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {room.participants.map((p) => (
                    <div
                      key={p.id}
                      className={`px-3 py-2 rounded-xl flex items-center justify-between gap-2 border transition ${
                        p.checkedIn
                          ? 'bg-emerald-950/40 border-emerald-500/50 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800/80 opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0">{p.avatar}</span>
                        <span className="font-bold text-xs text-slate-200 truncate">{p.name}</span>
                      </div>

                      {p.checkedIn ? (
                        <span className="text-[10px] bg-emerald-950/90 text-emerald-300 border border-emerald-500/70 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-sm shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>В зале 🎮</span>
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 font-medium">
                          <span>Ожидаем 📱</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Host prompt or spectator notification */}
              {isHost ? (
                <button
                  onClick={onStartParty}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-red-600 via-amber-600 to-red-600 hover:from-red-500 hover:to-amber-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-red-950/50 transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] glow-gold cursor-pointer"
                >
                  <span>НАЧАТЬ ВЕЧЕР ДАРЕНИЯ 🚀</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-center text-xs text-amber-200 font-medium">
                  👑 Ожидаем команды организатора (<strong>{hostName}</strong>) для запуска вечеринки...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- COUNTDOWN STEP (5... 4... 3... 2... 1...) --- */}
      {party.status === 'active' && currentStep === 'countdown' && (
        <div className="my-auto text-center py-12 max-w-2xl mx-auto w-full">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-600/30 border border-red-500/50 text-red-300 text-xs font-bold uppercase tracking-widest mb-6 animate-pulse">
            <Sparkles className="w-4 h-4" />
            <span>ВНИМАНИЕ! СТАРТ ШОУ</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-slate-200 mb-8 font-festive">
            Все в сборе! Вечер Тайного Санты начинается через...
          </h2>

          <div className="inline-flex items-center justify-center w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-br from-red-600/20 via-slate-900 to-amber-600/20 border-4 border-amber-400 shadow-2xl glow-gold animate-bounce">
            <span className="text-8xl sm:text-9xl font-black text-amber-300 font-mono tracking-tight drop-shadow-xl">
              {countdown > 0 ? countdown : '🚀'}
            </span>
          </div>

          <p className="text-sm text-slate-400 mt-8">
            Возьмите смартфоны в руки! Прямо сейчас на ваших экранах откроется подготовка вопросов.
          </p>
        </div>
      )}

      {/* --- QUESTION BUILDER STEP (PLAYERS WRITE QUESTIONS) --- */}
      {party.status === 'active' && currentStep === 'question_builder' && (
        <div className="my-auto text-center py-8 max-w-3xl mx-auto w-full space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-700/80 text-indigo-300 text-xs font-bold uppercase tracking-wider shadow">
            <span>💡 СЕКРЕТНЫЙ РАУНД ВОПРОСОВ</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white font-festive drop-shadow-md">
            Игроки готовят свои вопросы!
          </h2>

          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
            Посмотрите на экраны телефонов: прямо сейчас вы можете придумать каверзный новогодний вопрос для друзей с 2–6 вариантами ответов!
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto text-left">
            {room.participants.map((p) => {
              const status = party.builderStatus?.[p.id];
              return (
                <div
                  key={p.id}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between transition ${
                    status === 'submitted'
                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-sm'
                      : status === 'skipped'
                      ? 'bg-slate-950/60 border-slate-800 text-slate-400'
                      : 'bg-slate-900/80 border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{p.avatar}</span>
                    <span className="font-bold text-xs text-white">{p.name}</span>
                  </div>

                  {status === 'submitted' ? (
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/70 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <span>✓ Готов 🎁</span>
                    </span>
                  ) : status === 'skipped' ? (
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                      Пропустил
                    </span>
                  ) : (
                    <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                      Пишет... ✍️
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {isHost && (
            <div className="pt-4">
              <button
                onClick={onNextStep}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-950/50 transition flex items-center gap-2 mx-auto cursor-pointer glow-emerald"
              >
                <span>НАЧАТЬ ВИКТОРИНУ 🚀</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- QUIZ STEP: QUESTION --- */}
      {party.status === 'active' && currentStep === 'quiz_question' && party.quiz && (
        <div className="my-auto text-center py-6 max-w-4xl mx-auto w-full">
          {/* Header pill: Category & Timer */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-700/70 text-indigo-300 text-xs font-bold shadow-md">
              <span>{party.quiz.currentQuestion.category}</span>
            </div>

            {allQuizAnswered ? (
              <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-600 border border-emerald-400 text-white text-xs font-extrabold shadow-lg shadow-emerald-900/50 animate-bounce">
                <Sparkles className="w-4 h-4" />
                <span>ВСЕ ОТВЕТИЛИ! РАСКРЫТИЕ ЧЕРЕЗ {countdown} СЕК</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-950/80 border border-purple-700 text-purple-300 text-xs font-bold shadow">
                <Clock className="w-4 h-4" />
                <span>⏱️ {countdown} сек</span>
              </div>
            )}
          </div>

          {/* Question Text Card */}
          <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-purple-950/50 border-2 border-indigo-500/60 rounded-3xl p-6 sm:p-8 mb-6 shadow-2xl relative">
            <div className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-2">
              Вопрос {party.quiz.questionIndex + 1} из {party.quiz.totalQuestions}
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight font-festive">
              {party.quiz.currentQuestion.question}
            </h2>
          </div>

          {/* 4 Jackbox-style Options Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 text-left">
            {party.quiz.currentQuestion.options.map((opt, idx) => {
              const style = QUIZ_OPTION_STYLES[idx];
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-4 rounded-2xl border bg-slate-900/90 transition shadow-lg ${style.border} ${style.bg}`}
                >
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 ${style.badge}`}>
                    {style.label}
                  </span>
                  <span className="text-sm sm:text-base font-semibold text-white leading-snug">
                    {opt}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Live Responses tracker */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {room.participants.map((p) => {
              const hasAnswered = party.quiz?.answers[p.id] !== undefined;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs transition ${
                    hasAnswered
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 shadow'
                      : 'bg-slate-900 text-slate-500 border border-slate-800'
                  }`}
                >
                  <span>{p.avatar}</span>
                  <span className="font-medium">{p.name}</span>
                  {hasAnswered ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <span className="text-[10px] text-slate-500">думает...</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- QUIZ STEP: REVEAL & EXPLANATION --- */}
      {party.status === 'active' && currentStep === 'quiz_reveal' && party.quiz && (
        <div className="my-auto text-center py-6 max-w-4xl mx-auto w-full">
          {/* Header badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-600 text-white font-extrabold text-xs uppercase tracking-widest shadow-xl animate-tv-pulse mb-4">
            <CheckCircle2 className="w-4 h-4" />
            <span>ПРАВИЛЬНЫЙ ОТВЕТ РАСКРЫТ!</span>
          </div>

          {/* Question Text reminder */}
          <h2 className="text-xl sm:text-2xl font-bold text-slate-300 mb-6 max-w-2xl mx-auto">
            {party.quiz.currentQuestion.question}
          </h2>

          {/* 4 Jackbox Options with highlight on correct */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 text-left">
            {party.quiz.currentQuestion.options.map((opt, idx) => {
              const isCorrect = idx === party.quiz?.currentQuestion.correctIndex;
              const style = QUIZ_OPTION_STYLES[idx];

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-4 rounded-2xl border transition shadow-lg ${
                    isCorrect
                      ? 'border-emerald-400 bg-emerald-950/90 text-white glow-emerald ring-2 ring-emerald-500/50 scale-[1.02]'
                      : 'border-slate-800/80 bg-slate-900/50 opacity-40'
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 ${
                      isCorrect ? 'bg-emerald-500 text-white shadow-lg' : style.badge
                    }`}
                  >
                    {isCorrect ? '✓' : style.label}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-white leading-snug">
                    {opt}
                  </span>
                  {isCorrect && (
                    <span className="ml-auto text-xs font-extrabold text-emerald-300 uppercase tracking-wider px-2 py-0.5 rounded-lg bg-emerald-500/20">
                      Верно!
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* "ПОЧЕМУ ИМЕННО ТАК?" Explanation Card */}
          <div className="bg-gradient-to-br from-amber-950/60 via-slate-900 to-amber-950/40 border-2 border-amber-500/60 rounded-3xl p-6 sm:p-8 mb-6 shadow-2xl text-left relative glow-gold">
            <div className="flex items-center gap-2 mb-2 text-amber-400 font-extrabold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>💡 ПОЧЕМУ ИМЕННО ТАК?</span>
            </div>
            <p className="text-base sm:text-xl text-amber-100 font-serif leading-relaxed italic">
              «{party.quiz.currentQuestion.explanation}»
            </p>
          </div>

          {/* Correct Answerers celebration list */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <span className="text-xs text-slate-300 font-semibold">
                Угадали и получили +100 очков:
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {party.quiz.correctParticipantIds && party.quiz.correctParticipantIds.length > 0 ? (
                party.quiz.correctParticipantIds.map((pId) => {
                  const p = room.participants.find((x) => x.id === pId);
                  if (!p) return null;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-950/80 border border-emerald-600/80 text-emerald-200 text-xs font-bold shadow"
                    >
                      <span>{p.avatar}</span>
                      <span>{p.name}</span>
                      <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.2 rounded font-extrabold">
                        +100
                      </span>
                    </div>
                  );
                })
              ) : (
                <span className="text-xs text-slate-400 italic">
                  Никто не ответил правильно в этот раз 🙈
                </span>
              )}
            </div>

            <div className="text-[11px] font-mono text-amber-400 shrink-0">
              Следующий шаг через {countdown} сек
            </div>
          </div>
        </div>
      )}

      {/* --- STEP 1: ROULETTE (WHO IS RECEIVING?) --- */}
      {party.status === 'active' && currentStep === 'roulette' && (
        <div className="my-auto text-center py-8">
          <div className="text-xs uppercase tracking-widest text-amber-400 font-bold mb-4 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Колесо судьбы крутится...</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-slate-300 mb-8 font-festive">
            Кому сейчас Дедушка Мороз принесет подарок?
          </h2>

          <div className="inline-block bg-slate-900/90 border-4 border-amber-500/80 rounded-3xl px-12 py-8 shadow-2xl glow-gold min-w-[320px]">
            <span className="text-6xl sm:text-8xl block mb-4">
              {rouletteFinished ? receiver?.avatar : '🎁'}
            </span>
            <motion.div
              key={rouletteName}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-4xl sm:text-6xl font-black text-white tracking-tight"
            >
              {rouletteName || '...'}
            </motion.div>
          </div>

          {rouletteFinished && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 space-y-2"
            >
              <p className="text-base sm:text-lg text-emerald-400 font-bold">
                ✨ Внимание! Готовится подарок для {receiverGenitive}!
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs text-slate-300">
                <span>Переход к подсказке через</span>
                <span className="font-mono font-bold text-amber-400">{rouletteCountdown} сек</span>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* --- STEP 2: RIDDLE (THE MYSTERY CLUE) --- */}
      {party.status === 'active' && currentStep === 'riddle' && (
        <div className="my-auto text-center py-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-amber-950/80 border border-amber-700 text-amber-300 text-xs font-bold mb-4">
            <HelpCircle className="w-4 h-4" />
            <span>СЕКРЕТНАЯ ЗАГАДКА ОТ САНТЫ</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-6 font-festive">
            Подарок для {receiver?.avatar} {receiverGenitive}
          </h2>

          <div className="bg-gradient-to-br from-amber-950/50 via-slate-900 to-slate-900 border-2 border-amber-500/60 rounded-3xl p-8 sm:p-10 shadow-2xl relative glow-gold">
            <p className="text-xl sm:text-3xl text-amber-100 font-serif italic leading-relaxed">
              "{riddle || 'Этот подарок окутан строжайшей новогодней тайной...'}"
            </p>
          </div>

          <p className="mt-6 text-sm text-slate-400">
            Гости, внимательно слушайте подсказку! Сейчас на ваших смартфонах откроется голосование: <strong className="text-white">кто Санта?</strong>
          </p>
        </div>
      )}

      {/* --- STEP 3: GUESS (VOTING POLL ON CONTROLLERS) --- */}
      {party.status === 'active' && currentStep === 'guess' && (
        <div className="my-auto text-center py-6 max-w-4xl mx-auto">
          {allVoted ? (
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-600 border border-emerald-400 text-white text-xs font-extrabold mb-4 shadow-lg shadow-emerald-900/50 animate-bounce">
              <Sparkles className="w-4 h-4" />
              <span>🎉 ВСЕ ОТВЕТИЛИ! СЛЕДУЮЩИЙ ШАГ ЧЕРЕЗ {countdown} СЕК</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/80 border border-purple-700 text-purple-300 text-xs font-bold mb-4">
              <Clock className="w-4 h-4" />
              <span>⏱️ {countdown} сек</span>
            </div>
          )}

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-3 font-festive">
            Кто тайный Санта для {receiverGenitive}?
          </h2>
          <p className="text-sm text-slate-300 mb-6">
            Сделайте свой выбор на пульте смартфона!
          </p>

          {/* Riddle reminder */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 mb-6 text-amber-200 text-sm italic font-serif max-w-2xl mx-auto">
            "{riddle}"
          </div>

          {/* Live voting indicators */}
          <div className="inline-flex items-center gap-3 bg-slate-900 border border-slate-700 px-6 py-3 rounded-2xl shadow-xl mb-6">
            <span className="text-2xl">🗳️</span>
            <div className="text-left">
              <span className="block text-xs uppercase text-slate-400 font-bold">
                Собрано догадок
              </span>
              <span className="text-lg font-mono font-extrabold text-purple-400">
                {party.guessesCount} из {eligibleCount} ответов
              </span>
            </div>
          </div>

          {/* Avatars of eligible voters and their voting status */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {eligibleVoters.map((p) => {
              const hasVoted = party.votedParticipantIds?.includes(p.id);
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs transition ${
                    hasVoted
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 shadow'
                      : 'bg-slate-900 text-slate-500 border border-slate-800'
                  }`}
                >
                  <span>{p.avatar}</span>
                  <span className="font-medium">{p.name}</span>
                  {hasVoted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <span className="text-[10px] text-slate-500">голосует...</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- STEP 4: BACKSTAGE PHOTOS --- */}
      {party.status === 'active' && currentStep === 'photos' && (
        <div className="my-auto text-center py-6">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-bold mb-4">
            <Sparkles className="w-4 h-4" />
            <span>СЕКРЕТНЫЙ ФОТО-БЭКСТЕЙДЖ</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-2 font-festive">
            Как покупался подарок для {receiverGenitive}?
          </h2>
          <p className="text-sm text-slate-300 mb-8">
            Санта оставил документальные свидетельства своего нелегкого пути:
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {photos.length > 0 ? (
              photos.map((p, idx) => (
                <PolaroidCard
                  key={p.id}
                  url={p.url}
                  caption={p.caption}
                  rotation={idx === 0 ? -4 : idx === 1 ? 3 : -2}
                  badge={`Улика #${idx + 1}`}
                />
              ))
            ) : (
              <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl max-w-md mx-auto">
                <span className="text-5xl block mb-3">🕵️</span>
                <p className="text-sm text-slate-300">
                  Санта оказался скрытным агентом и не оставил фотографий. Сейчас мы снимем с него маску вживую!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- STEP 5: REVEAL (GRAND FANFARE & UNBOXING) --- */}
      {party.status === 'active' && currentStep === 'reveal' && (
        <div className="my-auto text-center py-6">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 12 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-red-600 text-white font-extrabold text-sm uppercase tracking-widest shadow-xl animate-tv-pulse">
              <span>🎉 ТАЙНЫЙ САНТА РАСКРЫТ!</span>
            </div>

            <div className="bg-gradient-to-br from-red-950/80 via-slate-900 to-amber-950/80 border-4 border-amber-500/80 rounded-3xl p-8 sm:p-12 shadow-2xl max-w-2xl mx-auto glow-gold">
              <span className="text-7xl sm:text-9xl block mb-4 filter drop-shadow-xl">
                {revealedGiver?.avatar || '🎅'}
              </span>

              <h1 className="text-4xl sm:text-6xl font-black text-white mb-3">
                {revealedGiver?.name}
              </h1>

              <p className="text-lg sm:text-2xl text-amber-300 font-semibold mb-6">
                дарит подарок <span className="underline decoration-red-500">{receiverDative}</span>!
              </p>

              <div className="bg-black/40 border border-amber-500/30 p-4 rounded-2xl text-xs sm:text-sm text-slate-200">
                📢 <strong className="text-white">{revealedGiver?.name}</strong>, вставай и торжественно вручай подарок вживую! Гости, взрывайте аплодисменты с пультов!
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* --- STEP 6: FINISHED (JACKBOX PODIUM & FUNNY AWARDS) --- */}
      {party.status === 'finished' && (
        <div className="my-auto text-center py-6 max-w-4xl mx-auto space-y-6">
          <span className="text-6xl sm:text-7xl block mb-2">🏆</span>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-2 font-festive">
            Все подарки подарены!
          </h1>
          <p className="text-sm text-slate-300 max-w-xl mx-auto">
            Это был незабываемый праздничный вечер! Время подвести комедийные итоги нашего детективного расследования:
          </p>

          {/* Jackbox Award Nominations Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-left">
            {/* Sherlock Holmes */}
            {nominations?.sherlock && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/60 via-slate-900 to-slate-900 border border-amber-500/60 shadow-xl">
                <div className="flex items-center gap-2 mb-2 text-amber-400 text-xs font-extrabold uppercase">
                  <Search className="w-4 h-4" />
                  <span>Шерлок Вечера</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{nominations.sherlock.participant.avatar}</span>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {nominations.sherlock.participant.name}
                    </h4>
                    <p className="text-xs text-amber-300">
                      Угадал {nominations.sherlock.count} Сант!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Doctor Watson */}
            {nominations?.watson && (
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
                <div className="flex items-center gap-2 mb-2 text-blue-400 text-xs font-extrabold uppercase">
                  <Eye className="w-4 h-4" />
                  <span>Доктор Ватсон</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{nominations.watson.participant.avatar}</span>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {nominations.watson.participant.name}
                    </h4>
                    <p className="text-xs text-slate-400">
                      Премия за искреннюю веру в людей
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Ninja Santa */}
            {nominations?.ninja && (
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-purple-800/60 shadow-xl">
                <div className="flex items-center gap-2 mb-2 text-purple-400 text-xs font-extrabold uppercase">
                  <span>🎭</span>
                  <span>Мастер Маскировки</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{nominations.ninja.participant.avatar}</span>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {nominations.ninja.participant.name}
                    </h4>
                    <p className="text-xs text-purple-300">
                      Раскусили всего {nominations.ninja.guessedCount} чел.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Open Book */}
            {nominations?.openBook && (
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-800/60 shadow-xl">
                <div className="flex items-center gap-2 mb-2 text-emerald-400 text-xs font-extrabold uppercase">
                  <span>📖</span>
                  <span>Открытая Книга</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{nominations.openBook.participant.avatar}</span>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {nominations.openBook.participant.name}
                    </h4>
                    <p className="text-xs text-emerald-300">
                      Раскусили сразу {nominations.openBook.guessedCount} гостей!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Soundboard King */}
            {nominations?.soundboardKing && (
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-red-800/60 shadow-xl">
                <div className="flex items-center gap-2 mb-2 text-red-400 text-xs font-extrabold uppercase">
                  <Volume2 className="w-4 h-4" />
                  <span>Душа Компании</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{nominations.soundboardKing.participant.avatar}</span>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {nominations.soundboardKing.participant.name}
                    </h4>
                    <p className="text-xs text-red-300">
                      Отправил {nominations.soundboardKing.count} оваций с пульта!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Quiz Master */}
            {nominations?.quizMaster && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/60 shadow-xl">
                <div className="flex items-center gap-2 mb-2 text-indigo-400 text-xs font-extrabold uppercase">
                  <span>🧠</span>
                  <span>Новогодний Эрудит</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{nominations.quizMaster.participant.avatar}</span>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {nominations.quizMaster.participant.name}
                    </h4>
                    <p className="text-xs text-indigo-300">
                      Ответил на {nominations.quizMaster.count} вопросов викторины!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Scores Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center justify-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Таблица очков детективного зачета</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {leaderboard.map((item, idx) => (
                <div
                  key={item.participant.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-xs text-amber-400 w-4">
                      #{idx + 1}
                    </span>
                    <span className="text-xl">{item.participant.avatar}</span>
                    <span className="font-semibold text-white text-xs">
                      {item.participant.name}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-xs">
                    {item.score} очков
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Bar: Instructions for Guests */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>🎮 Управление с телефонов: открывайте страницу или Telegram и жмите вкладку</span>
          <strong className="text-purple-400">«Пульт»</strong>
        </div>
        <div className="font-mono font-bold text-red-400">
          Код комнаты: {room.code}
        </div>
      </div>

      {/* Network Settings & LAN IP switch modal */}
      <NetworkSettingsModal
        isOpen={showNetworkModal}
        onClose={() => setShowNetworkModal(false)}
        networkInfo={networkInfo}
        activeBaseUrl={activeBaseUrl}
        roomCode={room.code}
        onBaseUrlChange={(newUrl) => setActiveBaseUrl(newUrl)}
      />

      {/* Host Mobile QR / Controller claim modal */}
      <HostQrModal
        isOpen={showHostQrModal}
        onClose={() => setShowHostQrModal(false)}
        activeBaseUrl={activeBaseUrl}
        room={room}
      />

      {/* Audio Unlock Floating Banner (if user hasn't clicked anywhere yet) */}
      {!audioUnlocked && (
        <div
          onClick={() => {
            sound.play('bells');
            setAudioUnlocked(true);
          }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-indigo-900/95 to-purple-900/95 hover:from-indigo-800 hover:to-purple-800 border border-indigo-500/60 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 cursor-pointer transition animate-bounce backdrop-blur"
        >
          <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>Нажмите в любом месте, чтобы включить звук вечеринки 🔊</span>
        </div>
      )}
    </div>
  );
};
