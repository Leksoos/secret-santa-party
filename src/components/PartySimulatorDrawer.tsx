import React, { useState } from 'react';
import { Gamepad2, X, ChevronUp, ChevronDown, Sparkles, Send, CheckCircle2, Lock } from 'lucide-react';
import { ClientRoomView, PublicParticipant } from '../types';
import { getSocket } from '../lib/socket';
import { sound } from '../lib/sound';

interface PartySimulatorDrawerProps {
  room: ClientRoomView;
  onRoomUpdated?: () => void;
}

const SIMULATOR_REACTIONS = [
  { emoji: '👏', sound: 'applause' },
  { emoji: '🎉', sound: 'fanfare' },
  { emoji: '🤣', sound: 'laugh' },
  { emoji: '🔔', sound: 'bells' },
];

export const PartySimulatorDrawer: React.FC<PartySimulatorDrawerProps> = ({
  room,
  onRoomUpdated,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const party = room.party;
  const currentStep = party.currentStep;

  // Pick up to 3 non-host participants for the simulation phones
  const simParticipants = room.participants
    .filter((p) => !p.isHost)
    .slice(0, 3);

  // If no non-host participants, pick other available participants
  const participantsToSimulate =
    simParticipants.length > 0
      ? simParticipants
      : room.participants.slice(0, 3);

  if (participantsToSimulate.length === 0) {
    return null;
  }

  const handleSimReaction = (p: PublicParticipant, emoji: string, soundName: string) => {
    sound.play(soundName);
    const s = getSocket();
    s.emit('party:reaction', {
      code: room.code,
      emoji,
      sound: soundName,
      senderName: p.name,
    });
  };

  const handleSimQuizAnswer = (p: PublicParticipant, optionIndex: number) => {
    sound.play('pop');
    const s = getSocket();
    s.emit('party:quiz_answer', {
      code: room.code,
      participantId: p.id,
      optionIndex,
    });
  };

  const handleSimGuess = (p: PublicParticipant, candidateId: string) => {
    sound.play('pop');
    const s = getSocket();
    s.emit('party:guess', {
      code: room.code,
      voterId: p.id,
      guessedId: candidateId,
    });
  };

  const handleSimCustomQuestion = (p: PublicParticipant) => {
    sound.play('fanfare');
    const s = getSocket();
    s.emit('party:submit_custom_question', {
      code: room.code,
      participantId: p.id,
      question: `Новогодний вопрос от игрока ${p.name}?`,
      options: ['Мандарины', 'Оливье', 'Селедка под шубой', 'Бутерброд с икрой'],
      correctIndex: 1,
      explanation: `Потому что ${p.name} обожает традиционный новогодний стол!`,
      category: 'Вопрос от друзей 👥',
    });
  };

  const handleSimSkipQuestion = (p: PublicParticipant) => {
    sound.play('pop');
    const s = getSocket();
    s.emit('party:skip_custom_question', {
      code: room.code,
      participantId: p.id,
    });
  };

  return (
    <div className="fixed bottom-3 right-3 z-50 select-none font-sans">
      {/* Drawer Toggle Button */}
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-2xl border border-purple-400/50 flex items-center gap-2 glow-purple transition active:scale-95 cursor-pointer backdrop-blur-md"
        >
          <Gamepad2 className="w-4 h-4 text-amber-300 animate-pulse" />
          <span>Симулятор пультов</span>
          <span className="bg-purple-950/80 px-2 py-0.5 rounded-full text-[10px] font-mono text-purple-200 border border-purple-400/40">
            {participantsToSimulate.length} тел.
          </span>
          <ChevronUp className="w-4 h-4" />
        </button>
      ) : (
        <div className="bg-slate-950/95 border-2 border-purple-500/70 rounded-3xl p-4 shadow-2xl backdrop-blur-xl max-w-4xl w-[95vw] sm:w-auto overflow-hidden text-slate-100">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-lg">
                🎮
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Симулятор пультов игроков</span>
                  <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-700/80 px-2 py-0.5 rounded-full">
                    Для локального теста
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Нажимайте кнопки за участников, чтобы протестировать реакцию ТВ в реальном времени
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition border border-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Virtual Phone Cards Grid */}
          <div className="flex flex-col sm:flex-row gap-3 overflow-x-auto pb-1 max-h-[60vh] sm:max-h-none">
            {participantsToSimulate.map((p) => {
              const quizAnswer = party.quiz?.answers[p.id];
              const hasAnswered = quizAnswer !== undefined;
              const hasVoted = party.votedParticipantIds?.includes(p.id);
              const builderStatus = party.builderStatus?.[p.id];

              return (
                <div
                  key={p.id}
                  className="w-full sm:w-64 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between space-y-3 shadow-lg shrink-0"
                >
                  {/* Phone Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{p.avatar}</span>
                      <div className="min-w-0">
                        <span className="block font-bold text-xs text-white truncate max-w-[110px]">
                          {p.name}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                          Очки: {party.scores[p.id] || 0}
                        </span>
                      </div>
                    </div>

                    <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-700 px-1.5 py-0.5 rounded-full font-bold">
                      В зале 🎮
                    </span>
                  </div>

                  {/* Contextual Interaction per Party Step */}
                  <div className="space-y-2 flex-1 text-xs">
                    {/* Step: Question Builder */}
                    {party.status === 'active' && currentStep === 'question_builder' && (
                      <div className="space-y-1.5 bg-slate-950/70 p-2.5 rounded-xl border border-indigo-900/50 text-center">
                        <span className="text-[10px] text-indigo-300 font-bold block">
                          Конструктор вопроса
                        </span>
                        {builderStatus === 'submitted' ? (
                          <div className="text-[10px] text-emerald-300 flex items-center justify-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Вопрос отправлен!</span>
                          </div>
                        ) : builderStatus === 'skipped' ? (
                          <span className="text-[10px] text-slate-400 block">Пропустил</span>
                        ) : (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleSimCustomQuestion(p)}
                              className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-[10px] transition"
                            >
                              💡 Свой вопрос
                            </button>
                            <button
                              onClick={() => handleSimSkipQuestion(p)}
                              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] transition"
                            >
                              Пропуск
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step: Quiz Question */}
                    {party.status === 'active' && currentStep === 'quiz_question' && party.quiz && (
                      <div className="space-y-1.5 bg-slate-950/70 p-2.5 rounded-xl border border-indigo-900/50">
                        <div className="flex items-center justify-between text-[10px] text-indigo-300 font-bold">
                          <span>Ответ на вопрос:</span>
                          {hasAnswered && <span className="text-emerald-400">✓ Принят</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {party.quiz.currentQuestion.options.map((_, idx) => (
                            <button
                              key={idx}
                              disabled={hasAnswered}
                              onClick={() => handleSimQuizAnswer(p, idx)}
                              className={`py-1.5 px-2 rounded-lg font-bold text-[10px] transition ${
                                quizAnswer === idx
                                  ? 'bg-emerald-600 text-white shadow ring-1 ring-white/50'
                                  : hasAnswered
                                  ? 'bg-slate-800/40 text-slate-500 cursor-not-allowed'
                                  : 'bg-slate-800 hover:bg-indigo-600 text-white'
                              }`}
                            >
                              {String.fromCharCode(65 + idx)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Step: Guessing Santa */}
                    {party.status === 'active' && currentStep === 'guess' && (
                      <div className="space-y-1.5 bg-slate-950/70 p-2.5 rounded-xl border border-purple-900/50">
                        <span className="text-[10px] text-purple-300 font-bold block">
                          Голос за Санту:
                        </span>
                        {hasVoted ? (
                          <div className="text-[10px] text-emerald-300 flex items-center justify-center gap-1 font-semibold py-1">
                            <Lock className="w-3.5 h-3.5" />
                            <span>Голос зафиксирован</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto pr-1">
                            {room.participants
                              .filter((cand) => cand.id !== p.id)
                              .map((cand) => (
                                <button
                                  key={cand.id}
                                  onClick={() => handleSimGuess(p, cand.id)}
                                  className="py-1 px-1.5 rounded-lg bg-slate-800 hover:bg-purple-600 text-white text-[10px] truncate text-left transition"
                                >
                                  {cand.avatar} {cand.name}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step: Idle / Other steps notification */}
                    {(party.status !== 'active' || (currentStep !== 'quiz_question' && currentStep !== 'guess' && currentStep !== 'question_builder')) && (
                      <div className="text-[10px] text-slate-400 bg-slate-950/40 p-2 rounded-xl text-center">
                        Смотрит на экран ТВ 👀
                      </div>
                    )}
                  </div>

                  {/* Reaction Soundboard */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">
                      Реакции на ТВ:
                    </span>
                    <div className="flex gap-1.5 justify-between">
                      {SIMULATOR_REACTIONS.map((r) => (
                        <button
                          key={r.emoji}
                          onClick={() => handleSimReaction(p, r.emoji, r.sound)}
                          className="flex-1 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm transition active:scale-90"
                          title={`Отправить реакцию ${r.emoji}`}
                        >
                          {r.emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
