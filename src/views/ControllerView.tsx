import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Lock,
  Eye,
  Gift,
  Plus,
  Trash2,
  Send,
  MessageSquarePlus,
  Clock,
} from 'lucide-react';
import { ClientRoomView, PublicParticipant } from '../types';
import { sound } from '../lib/sound';
import { triggerHaptic } from '../lib/tg';
import { getGenitiveName } from '../lib/declension';

interface ControllerProps {
  room: ClientRoomView;
  currentParticipant: PublicParticipant;
  onSendReaction: (emoji: string, soundName: string) => void;
  onNextStep: () => void;
  onSubmitGuess: (guessedId: string) => void;
  onSubmitQuizAnswer?: (optionIndex: number) => void;
  onSubmitCustomQuestion?: (data: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
    category?: string;
  }) => void;
  onSkipCustomQuestion?: () => void;
}

const SOUNDBOARD = [
  { emoji: '👏', name: 'Овации', sound: 'applause', bg: 'bg-emerald-600 hover:bg-emerald-500' },
  { emoji: '🤣', name: 'Смех', sound: 'laugh', bg: 'bg-amber-600 hover:bg-amber-500' },
  { emoji: '🎉', name: 'Салют', sound: 'fanfare', bg: 'bg-red-600 hover:bg-red-500' },
  { emoji: '🔔', name: 'Джингл', sound: 'bells', bg: 'bg-blue-600 hover:bg-blue-500' },
  { emoji: '😱', name: 'Шок!', sound: 'shock', bg: 'bg-purple-600 hover:bg-purple-500' },
  { emoji: '🦗', name: 'Сверчки', sound: 'cricket', bg: 'bg-slate-700 hover:bg-slate-600' },
  { emoji: '🥂', name: 'Тост', sound: 'chime', bg: 'bg-yellow-600 hover:bg-yellow-500' },
  { emoji: '❄️', name: 'Снежок', sound: 'pop', bg: 'bg-teal-600 hover:bg-teal-500' },
];

const QUIZ_CONTROLLER_BUTTONS = [
  { label: 'A', bg: 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 border-rose-400/40 shadow-rose-900/40' },
  { label: 'B', bg: 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 border-blue-400/40 shadow-blue-900/40' },
  { label: 'C', bg: 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 border-amber-400/40 shadow-amber-900/40' },
  { label: 'D', bg: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 border-emerald-400/40 shadow-emerald-900/40' },
  { label: 'E', bg: 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700 border-purple-400/40 shadow-purple-900/40' },
  { label: 'F', bg: 'bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 border-cyan-400/40 shadow-cyan-900/40' },
];

export const ControllerView: React.FC<ControllerProps> = ({
  room,
  currentParticipant,
  onSendReaction,
  onNextStep,
  onSubmitGuess,
  onSubmitQuizAnswer,
  onSubmitCustomQuestion,
  onSkipCustomQuestion,
}) => {
  const party = room.party;
  const isHost = currentParticipant.isHost;
  const currentStep = party.currentStep;
  const receiver = party.currentReceiver;
  const currentGiverId = party.currentGiverId;

  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);

  // Reset selected candidate and quiz option when round or step advances
  useEffect(() => {
    setSelectedCandidate(null);
    setSelectedQuizOption(null);
  }, [party.currentPairIndex, party.currentStep, party.quiz?.questionIndex]);

  // Screen Wake Lock API to prevent mobile controller screen from going dark
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        // unsupported or denied
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

  // Timed step and countdown state synchronized from server
  const isTimedStep = currentStep === 'guess' || currentStep === 'quiz_question' || currentStep === 'quiz_reveal' || currentStep === 'countdown';

  const computeRemainingSeconds = () => {
    if (!isTimedStep) return 0;
    const duration = party.timerDuration || (currentStep === 'countdown' ? 5 : currentStep === 'quiz_reveal' ? 10 : currentStep === 'quiz_question' ? 20 : 25);
    const startTime = party.stepStartTime || Date.now();
    const elapsed = (Date.now() - startTime) / 1000;
    return Math.max(0, Math.ceil(duration - elapsed));
  };

  const [countdown, setCountdown] = useState<number>(computeRemainingSeconds);

  useEffect(() => {
    if (isTimedStep) {
      setCountdown(computeRemainingSeconds());
      const timer = setInterval(() => {
        setCountdown(computeRemainingSeconds());
      }, 500);
      return () => clearInterval(timer);
    }
  }, [currentStep, party.stepStartTime, party.timerDuration, isTimedStep]);

  // Custom question builder state
  const [customQuestion, setCustomQuestion] = useState('');
  const [customOptions, setCustomOptions] = useState<string[]>(['', '']);
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number>(0);
  const [customExplanation, setCustomExplanation] = useState('');
  const [isBuilderSubmitted, setIsBuilderSubmitted] = useState(false);
  const [isBuilderSkipped, setIsBuilderSkipped] = useState(false);

  const builderStatus = party.builderStatus?.[currentParticipant.id];
  const hasSubmittedQuestion = isBuilderSubmitted || builderStatus === 'submitted';
  const hasSkippedQuestion = isBuilderSkipped || builderStatus === 'skipped';

  const handleAddOption = () => {
    if (customOptions.length < 6) {
      triggerHaptic('light');
      setCustomOptions((prev) => [...prev, '']);
    }
  };

  const handleRemoveOption = (indexToRemove: number) => {
    if (customOptions.length > 2) {
      triggerHaptic('light');
      setCustomOptions((prev) => prev.filter((_, idx) => idx !== indexToRemove));
      if (correctOptionIndex >= customOptions.length - 1) {
        setCorrectOptionIndex(0);
      }
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    setCustomOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmitCustomQuestion = () => {
    const trimmedQuestion = customQuestion.trim();
    const validOptions = customOptions.map((opt) => opt.trim()).filter(Boolean);

    if (!trimmedQuestion) {
      alert('Пожалуйста, напишите текст вопроса');
      return;
    }

    if (validOptions.length < 2) {
      alert('Пожалуйста, заполните минимум 2 варианта ответа');
      return;
    }

    triggerHaptic('heavy');
    sound.play('fanfare');
    setIsBuilderSubmitted(true);
    if (onSubmitCustomQuestion) {
      onSubmitCustomQuestion({
        question: trimmedQuestion,
        options: customOptions.map((opt, i) => opt.trim() || `Вариант ${i + 1}`),
        correctIndex: Math.min(correctOptionIndex, customOptions.length - 1),
        explanation: customExplanation.trim() || `Вопрос от игрока ${currentParticipant.name}`,
        category: 'Вопрос от друзей 👥',
      });
    }
  };

  const handleSkipCustomQuestion = () => {
    triggerHaptic('light');
    sound.play('pop');
    setIsBuilderSkipped(true);
    if (onSkipCustomQuestion) {
      onSkipCustomQuestion();
    }
  };

  // Contextual step label for host
  const getHostButtonLabel = () => {
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
        return 'СЛЕДУЮЩИЙ ШАГ НА ТВ';
    }
  };

  // Quiz state checks
  const existingQuizAnswer = party.quiz?.answers[currentParticipant.id];
  const myQuizChoice = selectedQuizOption !== null ? selectedQuizOption : existingQuizAnswer;
  const hasAnsweredQuiz = myQuizChoice !== undefined;

  const handleSelectQuizOption = (index: number) => {
    if (hasAnsweredQuiz) return;
    setSelectedQuizOption(index);
    triggerHaptic('heavy');
    sound.play('pop');
    if (onSubmitQuizAnswer) {
      onSubmitQuizAnswer(index);
    }
  };

  // Voting restriction checks
  const isReceiver = currentParticipant.id === receiver?.id;
  const isGiver = currentParticipant.id === currentGiverId;
  const hasVoted =
    (party.votedParticipantIds && party.votedParticipantIds.includes(currentParticipant.id)) ||
    selectedCandidate !== null;

  const handleTapSoundboard = (emoji: string, soundName: string) => {
    triggerHaptic('medium');
    sound.play(soundName);
    onSendReaction(emoji, soundName);
  };

  const handleSendGuess = (participantId: string) => {
    if (hasVoted || isReceiver || isGiver) return;

    setSelectedCandidate(participantId);
    triggerHaptic('heavy');
    onSubmitGuess(participantId);
  };

  // Full list of candidates (all room participants except the receiver themselves)
  const candidateParticipants = room.participants.filter(
    (p) => p.id !== receiver?.id
  );

  const receiverGenitive = receiver ? getGenitiveName(receiver.name) : '';

  return (
    <div className="max-w-md mx-auto p-4 space-y-6 relative z-10 pb-32">
      {/* Controller Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-xl">
            🎮
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Пульт вечеринки</h3>
            <p className="text-[11px] text-slate-400">
              Вы играете как: <strong className="text-purple-300">{currentParticipant.name}</strong>
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-500 uppercase block font-bold">
            Очки
          </span>
          <span className="font-mono font-bold text-emerald-400 text-sm">
            {party.scores[currentParticipant.id] || 0}
          </span>
        </div>
      </div>

      {/* --- COUNTDOWN STEP ON CONTROLLER --- */}
      {party.status === 'active' && currentStep === 'countdown' && (
        <div className="bg-gradient-to-br from-red-950/80 via-slate-900 to-amber-950/70 border-2 border-red-500/60 rounded-3xl p-6 shadow-2xl text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/90 border border-red-700/80 text-red-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Шоу начинается!</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white font-festive">
            Все собрались у экрана!
          </h3>

          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-red-600/30 via-slate-900 to-amber-600/30 border-4 border-amber-400 flex items-center justify-center shadow-xl glow-gold animate-bounce">
            <span className="text-5xl font-black text-amber-300 font-mono">
              {countdown > 0 ? countdown : '🚀'}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Смотрите на ТВ — через пару секунд на ваших телефонах откроется подготовка каверзных вопросов!
          </p>
        </div>
      )}

      {/* --- QUESTION BUILDER STEP ON CONTROLLER --- */}
      {party.status === 'active' && currentStep === 'question_builder' && (
        <div className="bg-gradient-to-br from-indigo-950/80 via-slate-900 to-purple-950/80 border-2 border-indigo-500/60 rounded-3xl p-5 shadow-2xl space-y-4">
          {hasSubmittedQuestion ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-3xl mx-auto">
                ✨
              </div>
              <h4 className="text-lg font-bold text-white font-festive">
                Ваш вопрос готов!
              </h4>
              <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                Вопрос успешно добавлен в базу викторины вечера. Скоро друзья увидят его на ТВ-экране!
              </p>
              <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Ожидаем остальных игроков...</span>
              </div>
            </div>
          ) : hasSkippedQuestion ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-3xl mx-auto">
                ⏭️
              </div>
              <h4 className="text-base font-bold text-white">
                Вы пропустили создание вопроса
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Ничего страшного! Вы будете угадывать новогодние вопросы от друзей и зарабатывать очки викторины.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-lg">
                    ✍️
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white">
                      Не хочешь ли подготовить свой вопрос?
                    </h4>
                    <p className="text-[11px] text-indigo-300">
                      Придумай вопрос и варианты — он попадет в игру на ТВ!
                    </p>
                  </div>
                </div>
              </div>

              {/* Question Text */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1">
                  <span>Текст вопроса</span>
                  <span className="text-amber-400">*</span>
                </label>
                <textarea
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="Например: Какая самая нелепая покупка Олега в этом году?"
                  rows={2}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 resize-none"
                />
              </div>

              {/* Options Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1">
                    <span>Варианты ответов</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      (отметьте верный кружком, 2–6 вариантов)
                    </span>
                  </label>
                  <span className="text-[10px] font-mono text-indigo-400 font-bold">
                    {customOptions.length}/6
                  </span>
                </div>

                <div className="space-y-2">
                  {customOptions.map((opt, idx) => {
                    const style = QUIZ_CONTROLLER_BUTTONS[idx] || QUIZ_CONTROLLER_BUTTONS[0];
                    const isCorrect = correctOptionIndex === idx;

                    return (
                      <div key={idx} className="flex items-center gap-2">
                        {/* Radio selector for correct option */}
                        <button
                          type="button"
                          onClick={() => setCorrectOptionIndex(idx)}
                          title="Нажмите, чтобы сделать этот ответ правильным"
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border transition ${
                            isCorrect
                              ? 'bg-emerald-600 border-emerald-400 text-white shadow-md ring-2 ring-emerald-400/50'
                              : `${style.bg} text-white/80 opacity-70 hover:opacity-100`
                          }`}
                        >
                          {isCorrect ? '✓' : style.label}
                        </button>

                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          placeholder={`Вариант ${style.label} ${isCorrect ? '(Правильный ответ)' : ''}`}
                          className={`flex-1 bg-slate-950/80 border rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none transition ${
                            isCorrect
                              ? 'border-emerald-500/80 ring-1 ring-emerald-500/30'
                              : 'border-slate-700 focus:border-indigo-400'
                          }`}
                        />

                        {/* Delete button (only if > 2 options) */}
                        {customOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            title="Удалить вариант"
                            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-950/80 hover:text-rose-400 text-slate-400 flex items-center justify-center text-xs transition shrink-0 border border-slate-700"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Option Button (capped at 6) */}
                {customOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-700/60 text-indigo-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <span>+ Добавить вариант ответа</span>
                    <span className="text-[10px] text-indigo-400">({customOptions.length}/6)</span>
                  </button>
                )}
              </div>

              {/* Optional Explanation */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                  Почему именно так? (пояснение для экрана ТВ)
                </label>
                <input
                  type="text"
                  value={customExplanation}
                  onChange={(e) => setCustomExplanation(e.target.value)}
                  placeholder="Например: Потому что на прошлой неделе он заказал надувного динозавра!"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
                />
              </div>

              {/* Submit & Skip Actions */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleSubmitCustomQuestion}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 glow-emerald active:scale-[0.98]"
                >
                  <span>Готово! Отправить вопрос 🚀</span>
                </button>

                <button
                  type="button"
                  onClick={handleSkipCustomQuestion}
                  className="w-full py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-700"
                >
                  <span>Не сейчас / Отказаться ⏭️</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* --- QUIZ QUESTION MODE ON CONTROLLER --- */}
      {party.status === 'active' && currentStep === 'quiz_question' && party.quiz && (
        <div className="bg-gradient-to-br from-indigo-950/80 via-slate-900 to-purple-950/70 border-2 border-indigo-500/60 rounded-3xl p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-400 bg-indigo-950/80 border border-indigo-700/60 px-2.5 py-1 rounded-full">
              Вопрос {party.quiz.questionIndex + 1} из {party.quiz.totalQuestions}
            </span>
            <span className="text-[11px] text-slate-300 font-semibold">
              {party.quiz.currentQuestion.category}
            </span>
          </div>

          <h4 className="text-base sm:text-lg font-bold text-white mb-4 leading-snug font-festive">
            {party.quiz.currentQuestion.question}
          </h4>

          {/* Dynamic 2 to 6 Big Touch Buttons */}
          <div className="grid grid-cols-1 gap-2.5">
            {party.quiz.currentQuestion.options.map((opt, idx) => {
              const style = QUIZ_CONTROLLER_BUTTONS[idx] || QUIZ_CONTROLLER_BUTTONS[0];
              const isSelected = myQuizChoice === idx;

              return (
                <button
                  key={idx}
                  disabled={hasAnsweredQuiz}
                  onClick={() => handleSelectQuizOption(idx)}
                  className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition active:scale-[0.98] ${
                    isSelected
                      ? `${style.bg} border-white ring-2 ring-white/60 shadow-xl scale-[1.01]`
                      : hasAnsweredQuiz
                      ? 'bg-slate-950/40 border-slate-800/60 text-slate-500 opacity-50 cursor-not-allowed'
                      : `${style.bg} hover:brightness-110 shadow-lg`
                  }`}
                >
                  <span className="w-8 h-8 rounded-xl bg-black/30 flex items-center justify-center font-extrabold text-sm shrink-0 border border-white/20">
                    {isSelected ? '✓' : style.label}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white leading-snug">
                    {opt}
                  </span>
                </button>
              );
            })}
          </div>

          {hasAnsweredQuiz && (
            <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-200 text-xs flex items-center justify-center gap-2 font-semibold">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ваш ответ принят! Ждем раскрытия на экране ТВ...</span>
            </div>
          )}
        </div>
      )}

      {/* --- QUIZ REVEAL MODE ON CONTROLLER --- */}
      {party.status === 'active' && currentStep === 'quiz_reveal' && party.quiz && (
        <div className="space-y-4">
          {/* Result Banner */}
          {myQuizChoice === party.quiz.currentQuestion.correctIndex ? (
            <div className="bg-gradient-to-br from-emerald-950/90 via-slate-900 to-emerald-950/80 border-2 border-emerald-500 rounded-3xl p-5 text-center shadow-xl">
              <span className="text-4xl block mb-2">🎉</span>
              <h4 className="text-lg font-black text-emerald-300 uppercase tracking-wide">
                В точку! +100 очков
              </h4>
              <p className="text-xs text-emerald-200 mt-1">
                Правильный ответ:{' '}
                <strong>
                  {party.quiz.currentQuestion.options[party.quiz.currentQuestion.correctIndex]}
                </strong>
              </p>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-rose-950/90 via-slate-900 to-slate-900 border-2 border-rose-500/60 rounded-3xl p-5 text-center shadow-xl">
              <span className="text-4xl block mb-2">😅</span>
              <h4 className="text-lg font-black text-rose-300 uppercase tracking-wide">
                {myQuizChoice !== undefined ? 'Не угадали!' : 'Время вышло!'}
              </h4>
              <p className="text-xs text-slate-300 mt-1">
                Правильный ответ:{' '}
                <strong className="text-emerald-400">
                  {party.quiz.currentQuestion.options[party.quiz.currentQuestion.correctIndex]}
                </strong>
              </p>
            </div>
          )}

          {/* Explanation on phone */}
          <div className="bg-gradient-to-br from-amber-950/50 via-slate-900 to-amber-950/40 border border-amber-500/50 rounded-2xl p-4 text-left shadow-lg">
            <div className="flex items-center gap-1.5 mb-1.5 text-amber-400 text-xs font-bold uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>💡 ПОЧЕМУ ИМЕННО ТАК?</span>
            </div>
            <p className="text-xs sm:text-sm text-amber-100 font-serif leading-relaxed italic">
              «{party.quiz.currentQuestion.explanation}»
            </p>
          </div>
        </div>
      )}

      {/* --- VOTING / GUESSING MODE --- */}
      {party.status === 'active' && currentStep === 'guess' && (
        <div className="bg-gradient-to-br from-purple-950/70 via-slate-900 to-slate-900 border-2 border-purple-500/60 rounded-3xl p-5 shadow-2xl">
          {/* Case 1: Recipient cannot vote */}
          {isReceiver ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-3xl mx-auto">
                🎁
              </div>
              <h4 className="text-base font-bold text-white font-festive">
                Это ваш раунд подарка!
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                Вы в центре внимания! Расслабьтесь и смотрите на экран ТВ — прямо сейчас друзья пытаются угадать, кто подготовил вам этот сюрприз.
              </p>
            </div>
          ) : isGiver ? (
            /* Case 2: Secret Santa cannot vote for themselves */
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-3xl mx-auto">
                🤫
              </div>
              <h4 className="text-base font-bold text-white font-festive">
                Тссс! Вы тайный Санта в этом раунде!
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                Не выдавайте себя ни словом, ни жестом! Смотрите на экран ТВ и наблюдайте за догадками друзей.
              </p>
            </div>
          ) : (
            /* Case 3: Regular voter */
            <div>
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="w-5 h-5 text-purple-400" />
                <h4 className="text-base font-bold text-white font-festive">
                  Кто Санта для {receiverGenitive}?
                </h4>
              </div>
              <p className="text-xs text-slate-300 mb-4">
                Сделайте выбор один раз. За верную догадку вы получите +100 очков в копилку сыщика!
              </p>

              {/* Full Candidate Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {candidateParticipants.map((candidate) => {
                  const isSelected = selectedCandidate === candidate.id;
                  return (
                    <button
                      key={candidate.id}
                      disabled={hasVoted}
                      onClick={() => handleSendGuess(candidate.id)}
                      className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition active:scale-95 ${
                        isSelected
                          ? 'bg-purple-600 border-purple-400 text-white shadow-lg ring-2 ring-white/50'
                          : hasVoted
                          ? 'bg-slate-950/40 border-slate-800/60 text-slate-500 opacity-60 cursor-not-allowed'
                          : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-purple-500/50'
                      }`}
                    >
                      <span className="text-2xl flex-shrink-0">{candidate.avatar}</span>
                      <span className="text-xs font-bold truncate flex-1 min-w-0">
                        {candidate.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {hasVoted && (
                <div className="mt-4 p-2.5 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-200 text-xs flex items-center justify-center gap-2 font-semibold">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ваш выбор зафиксирован и не может быть изменен</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- LIVE SOUNDBOARD & REACTIONS --- */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Живые реакции на экран ТВ</span>
          </h4>
          <span className="text-[10px] text-slate-500">
            Жми во время шоу!
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mb-4">
          Тапайте кнопки — смайлы взлетают на ТВ, а зал наполняется аплодисментами и смехом!
        </p>

        <div className="grid grid-cols-4 gap-2.5">
          {SOUNDBOARD.map((btn) => (
            <button
              key={btn.name}
              onClick={() => handleTapSoundboard(btn.emoji, btn.sound)}
              className={`${btn.bg} text-white p-3 rounded-2xl flex flex-col items-center justify-center gap-1 shadow-md transition active:scale-90 select-none`}
            >
              <span className="text-2xl">{btn.emoji}</span>
              <span className="text-[10px] font-bold tracking-tight">
                {btn.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* --- HOST MASTER CONTROL (STICKY AT BOTTOM) --- */}
      {isHost && party.status === 'active' && currentStep === 'roulette' ? (
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl text-center text-xs text-amber-300">
          🎰 Колесо Санты крутится... следующий шаг начнется автоматически!
        </div>
      ) : isHost && party.status === 'active' ? (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40">
          <button
            onClick={() => {
              triggerHaptic('heavy');
              onNextStep();
            }}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm rounded-2xl shadow-2xl flex items-center justify-center gap-2 border border-emerald-400/50 glow-emerald"
          >
            <span>{getHostButtonLabel()}</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      ) : party.status === 'active' ? (
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl text-center text-xs text-slate-400">
          👑 Ход игры переключает организатор (
          <strong className="text-amber-300">
            {room.participants.find((p) => p.isHost)?.name || 'Хост'}
          </strong>
          )
        </div>
      ) : null}
    </div>
  );
};
