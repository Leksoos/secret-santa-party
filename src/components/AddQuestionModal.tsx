import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, PlusCircle, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { triggerHaptic } from '../lib/tg';
import { sound } from '../lib/sound';
import { QuizQuestion } from '../types';

interface AddQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuestionAdded?: (question: QuizQuestion) => void;
}

const CATEGORIES = [
  '🌍 Традиции мира',
  '🎬 Кино и Мультфильмы',
  '🍽️ Праздничный стол',
  '📜 История и мифы',
  '⚡ Курьезы и рекорды',
  '💡 Вопрос от гостей',
];

const OPTION_STYLES = [
  { label: 'A', bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400', badge: 'bg-rose-500 text-white' },
  { label: 'B', bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400', badge: 'bg-blue-500 text-white' },
  { label: 'C', bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400', badge: 'bg-amber-500 text-white' },
  { label: 'D', bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', badge: 'bg-emerald-500 text-white' },
];

export const AddQuestionModal: React.FC<AddQuestionModalProps> = ({
  isOpen,
  onClose,
  onQuestionAdded,
}) => {
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState(CATEGORIES[5]);
  const [options, setOptions] = useState<[string, string, string, string]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState<number>(0);
  const [explanation, setExplanation] = useState('');
  const [author, setAuthor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleOptionChange = (idx: number, val: string) => {
    const updated = [...options] as [string, string, string, string];
    updated[idx] = val;
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!question.trim()) {
      setError('Пожалуйста, введите текст вопроса');
      return;
    }

    if (options.some((opt) => !opt.trim())) {
      setError('Пожалуйста, заполните все 4 варианта ответов');
      return;
    }

    if (!explanation.trim()) {
      setError('Пожалуйста, добавьте объяснение («Почему именно так?»)');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/quiz/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          category,
          options: options.map((o) => o.trim()),
          correctIndex,
          explanation: explanation.trim(),
          author: author.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Ошибка при сохранении вопроса');
      }

      const saved = await res.json();
      setSuccess(true);
      triggerHaptic('success');
      sound.play('bells');

      if (onQuestionAdded) {
        onQuestionAdded(saved);
      }

      setTimeout(() => {
        setSuccess(false);
        setQuestion('');
        setOptions(['', '', '', '']);
        setCorrectIndex(0);
        setExplanation('');
        setAuthor('');
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Сетевая ошибка при добавлении вопроса');
      triggerHaptic('error');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-xl shadow-lg shadow-amber-900/30">
              💡
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white leading-tight">
                Добавить вопрос в викторину
              </h3>
              <p className="text-xs text-slate-400">
                Пополни базу вопросов праздничной викторины
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-bold text-emerald-400">Вопрос добавлен!</h4>
            <p className="text-sm text-slate-300">
              Он появится в викторине для всех участников вечеринки!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Категория
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Question Text */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Текст вопроса
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={2}
                placeholder="Например: В какой стране традиционно встречают Новый год поеданием 12 виноградин?"
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition resize-none"
              />
            </div>

            {/* Options */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  4 варианта ответа
                </label>
                <span className="text-[11px] text-amber-400 font-medium">
                  Отметь правильный вариант круглым значком
                </span>
              </div>
              <div className="space-y-2">
                {options.map((opt, idx) => {
                  const style = OPTION_STYLES[idx];
                  const isCorrect = correctIndex === idx;

                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 p-2 rounded-xl border transition ${
                        isCorrect
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-800 bg-slate-800/50 hover:border-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setCorrectIndex(idx)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition ${
                          isCorrect
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-900/50 scale-105'
                            : style.badge
                        }`}
                        title="Нажмите, чтобы сделать этот ответ правильным"
                      >
                        {isCorrect ? '✓' : style.label}
                      </button>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`Вариант ${style.label}`}
                        className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                      />
                      {isCorrect && (
                        <span className="text-[11px] font-semibold text-emerald-400 shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/20">
                          Правильный
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Explanation */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Почему именно так? (Объяснение)
                </label>
              </div>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={2}
                placeholder="Этот факт увидят все игроки на экране после ответа! Например: В Испании эта традиция называется «las doce uvas de la suerte»..."
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition resize-none"
              />
            </div>

            {/* Author */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Ваше имя / Автор (необязательно)
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Олег"
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            {/* Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold uppercase tracking-wider transition"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-900/30 transition disabled:opacity-50"
              >
                {submitting ? (
                  <span>Сохранение...</span>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>Добавить вопрос</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};
