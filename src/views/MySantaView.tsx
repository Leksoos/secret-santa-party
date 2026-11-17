import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gift,
  Lock,
  Upload,
  Trash2,
  Camera,
  HelpCircle,
  Heart,
  Ban,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Shirt,
  Tag,
} from 'lucide-react';
import { ClientRoomView, PublicParticipant, BackstagePhoto } from '../types';
import { PolaroidCard } from '../components/PolaroidCard';
import { sound } from '../lib/sound';
import { triggerHaptic } from '../lib/tg';
import { triggerConfetti } from '../lib/confetti';

interface MySantaProps {
  room: ClientRoomView;
  currentParticipant: PublicParticipant;
  onRefresh: () => void;
}

export const MySantaView: React.FC<MySantaProps> = ({
  room,
  currentParticipant,
  onRefresh,
}) => {
  const myRecipientData = room.myRecipient;
  const [envelopeOpened, setEnvelopeOpened] = useState(
    () => localStorage.getItem(`opened_${room.code}_${currentParticipant.id}`) === 'true'
  );

  const [hintRiddle, setHintRiddle] = useState(myRecipientData?.hintRiddle || '');
  const [photos, setPhotos] = useState<BackstagePhoto[]>(
    myRecipientData?.backstagePhotos || []
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isReadyLoading, setIsReadyLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isParticipantReady = Boolean(
    room.participants.find((p) => p.id === currentParticipant.id)?.isReady ?? currentParticipant.isReady
  );

  const handleToggleReady = async () => {
    const nextReady = !isParticipantReady;
    setIsReadyLoading(true);
    triggerHaptic('medium');

    if (nextReady) {
      sound.play('bells');
      triggerConfetti();
    } else {
      sound.play('pop');
    }

    try {
      const res = await fetch(`/api/rooms/${room.code}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: currentParticipant.id,
          isReady: nextReady,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка обновления готовности');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsReadyLoading(false);
    }
  };


  const handleOpenEnvelope = () => {
    sound.play('mystery');
    triggerHaptic('heavy');
    setEnvelopeOpened(true);
    localStorage.setItem(`opened_${room.code}_${currentParticipant.id}`, 'true');
    setTimeout(() => {
      sound.play('fanfare');
      triggerConfetti();
    }, 400);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (photos.length >= 3) {
      alert('Максимум 3 фото для вечеринки!');
      return;
    }

    setUploading(true);
    triggerHaptic('light');

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки фото');

      sound.play('camera');
      const newPhoto: BackstagePhoto = {
        id: `photo-${Date.now()}`,
        url: data.url,
        caption: `Операция «Подарок» #${photos.length + 1}`,
      };

      setPhotos((prev) => [...prev, newPhoto]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpdateCaption = (index: number, caption: string) => {
    setPhotos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, caption } : p))
    );
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveClues = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    triggerHaptic('medium');

    try {
      const res = await fetch(`/api/rooms/${room.code}/santa-clues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          giverId: currentParticipant.id,
          hintRiddle,
          backstagePhotos: photos,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сохранения данных');

      sound.play('pop');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!myRecipientData) {
    return (
      <div className="max-w-md mx-auto p-6 text-center bg-slate-900 border border-slate-800 rounded-3xl mt-10">
        <Lock className="w-12 h-12 text-amber-400 mx-auto mb-3 animate-pulse" />
        <h3 className="text-lg font-bold text-white mb-2">
          Жеребьевка еще не проведена
        </h3>
        <p className="text-xs text-slate-400">
          Организатор комнаты еще не запустил распределение пар. Подождите, пока соберутся все гости!
        </p>
      </div>
    );
  }

  const recipient = myRecipientData.participant;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 relative z-10">
      {/* Secret Envelope Presentation */}
      <AnimatePresence mode="wait">
        {!envelopeOpened ? (
          <motion.div
            key="envelope"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="bg-gradient-to-br from-amber-950/70 via-slate-900 to-red-950/70 border-2 border-amber-600/50 rounded-3xl p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden backdrop-blur-xl cursor-pointer group"
            onClick={handleOpenEnvelope}
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-red-600 flex items-center justify-center text-3xl shadow-xl shadow-red-950 ring-4 ring-amber-500/80 group-hover:scale-110 transition duration-300 mb-4">
              🎅
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-amber-200 mb-2 font-festive">
              Секретный свиток Санты
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto mb-6">
              Жеребьевка состоялась! Нажмите, чтобы сорвать сургучную печать и увидеть секретный вишлист вашего подопечного.
            </p>
            <button className="px-6 py-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-xl shadow-red-900/40 transition">
              Вскрыть конверт 📜
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="revealed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Recipient Profile Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/50 border border-red-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-52 h-52 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
                <div className="w-24 h-24 rounded-2xl bg-red-600/20 border-2 border-red-500/60 flex items-center justify-center text-5xl shadow-xl shrink-0">
                  {recipient.avatar}
                </div>
                <div className="space-y-1 flex-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/80 border border-red-800 text-red-300 text-xs font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Твой подопечный</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                    {recipient.name}
                  </h2>
                  <p className="text-xs text-slate-400">
                    🔒 Храните эту тайну до самого вечера вручения!
                  </p>

                  {/* Public details (Hobbies & Size) */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    {recipient.clothingSize && (
                      <span className="text-xs bg-amber-950/80 text-amber-300 border border-amber-800/80 px-2.5 py-0.5 rounded-lg flex items-center gap-1 font-semibold">
                        <Shirt className="w-3.5 h-3.5" />
                        <span>Размер: {recipient.clothingSize}</span>
                      </span>
                    )}

                    {recipient.hobbies && recipient.hobbies.map((h) => (
                      <span
                        key={h}
                        className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-lg border border-slate-700"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Wishlist & Anti-Wishlist */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-800">
                {/* Structured Wishlist */}
                <div className="bg-slate-950/80 border border-emerald-900/60 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Heart className="w-4 h-4" />
                    <span>Вишлист подопечного</span>
                  </h4>

                  {/* Wishlist items list */}
                  {recipient.wishlistItems && recipient.wishlistItems.length > 0 ? (
                    <div className="space-y-2">
                      {recipient.wishlistItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start justify-between gap-2"
                        >
                          <div className="text-xs">
                            <span className="font-semibold text-white block">
                              {item.title}
                            </span>
                            {item.price && (
                              <span className="text-[11px] text-amber-400 font-mono">
                                ~{item.price}
                              </span>
                            )}
                          </div>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded text-[10px] font-semibold flex items-center gap-1 shrink-0"
                            >
                              <span>Открыть</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {recipient.wishlist ? (
                    <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/80">
                      {recipient.wishlist}
                    </p>
                  ) : !recipient.wishlistItems || recipient.wishlistItems.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      Пожелания еще не заполнены.
                    </p>
                  ) : null}
                </div>

                {/* Anti-Wishlist (Stop-List) */}
                <div className="bg-slate-950/80 border border-red-900/60 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Ban className="w-4 h-4" />
                    <span>Стоп-лист: Что точно НЕ дарить</span>
                  </h4>

                  {/* Stop-list tags */}
                  {recipient.antiWishlistTags && recipient.antiWishlistTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {recipient.antiWishlistTags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] bg-red-950/80 text-red-300 border border-red-800 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1"
                        >
                          <span>🚫</span>
                          <span>{tag}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {recipient.antiWishlist ? (
                    <p className="text-xs text-red-200 whitespace-pre-wrap leading-relaxed bg-red-950/20 p-2.5 rounded-xl border border-red-900/30">
                      {recipient.antiWishlist}
                    </p>
                  ) : !recipient.antiWishlistTags || recipient.antiWishlistTags.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      Стоп-лист не указан (дарить можно всё в рамках приличия).
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Prominent Festive Gift Readiness Card (R1) */}
            <div
              className={`border rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl transition-all duration-300 ${
                isParticipantReady
                  ? 'bg-gradient-to-br from-emerald-950/70 via-slate-900 to-teal-950/60 border-emerald-500/60 ring-1 ring-emerald-500/30'
                  : 'bg-gradient-to-br from-amber-950/50 via-slate-900 to-red-950/40 border-amber-500/40'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg transition-transform duration-300 ${
                      isParticipantReady
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 scale-105'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {isParticipantReady ? '🎁' : '⏳'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg sm:text-xl font-bold text-white font-festive">
                        Готовность к вечеринке
                      </h3>
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                          isParticipantReady
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700/80'
                            : 'bg-amber-950 text-amber-300 border-amber-700/80'
                        }`}
                      >
                        {isParticipantReady ? 'Готов(а) к шоу 🎄' : 'В процессе ⏳'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {isParticipantReady
                        ? 'Отлично! Вы подтвердили наличие подарка. Организатор видит вашу готовность в общем лобби.'
                        : 'Купили или упаковали подарок? Подтвердите готовность, чтобы хост знал, что можно начинать вечер!'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleToggleReady}
                  disabled={isReadyLoading}
                  className={`w-full py-4 px-6 rounded-2xl font-bold text-sm sm:text-base shadow-xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2.5 ${
                    isParticipantReady
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50 border border-emerald-400/40'
                      : 'bg-gradient-to-r from-red-600 via-amber-600 to-red-500 hover:from-red-500 hover:via-amber-500 hover:to-red-400 text-white shadow-red-950/50 border border-amber-400/30 animate-pulse'
                  }`}
                >
                  <Gift className="w-5 h-5 shrink-0" />
                  <span>
                    {isReadyLoading
                      ? 'Обновляем статус...'
                      : 'Я приготовил(а) подарок и готов(а) к вечеринке! 🎁'}
                  </span>
                  {isParticipantReady && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
                  )}
                </button>

                {isParticipantReady && (
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400 px-1">
                    <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Готовность зафиксирована на сервере</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleReady}
                      disabled={isReadyLoading}
                      className="text-slate-400 hover:text-amber-300 underline transition text-[11px]"
                    >
                      Отозвать готовность (еще готовлюсь)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Jackbox Secret Backstage Mission Form */}

            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-3">
                <Camera className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white font-festive">
                  Подготовка к шоу на ТВ (Jackbox Режим)
                </h3>
              </div>
              <p className="text-xs text-slate-300 mb-6">
                Чтобы вечер вручения подарков превратился в уморительную игру, загрузите загадку и секретные фото процесса покупки или упаковки. Они будут показаны на большом экране перед тем, как вы раскроетесь!
              </p>

              <form onSubmit={handleSaveClues} className="space-y-6">
                {/* Riddle / Hint */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Юмористическая загадка / Подсказка для экрана</span>
                  </label>
                  <textarea
                    rows={3}
                    value={hintRiddle}
                    onChange={(e) => setHintRiddle(e.target.value)}
                    placeholder="Придумай смешную загадку или намек на подарок. Например: «Этот подарок спасет тебя в понедельник утром, но упакован в газету за 2014 год...»"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl p-3 text-white text-xs placeholder-slate-600 outline-none transition resize-none leading-relaxed"
                    required
                  />
                </div>

                {/* Backstage Photos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Фото-улики бэкстейджа ({photos.length}/3)</span>
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Как покупался / упаковывался подарок
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map((p, idx) => (
                      <div
                        key={p.id}
                        className="relative bg-slate-950 border border-slate-800 rounded-2xl p-2.5 flex flex-col items-center"
                      >
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-2 right-2 bg-red-600/90 text-white p-1 rounded-full z-10 hover:bg-red-500 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <img
                          src={p.url}
                          alt="Улика"
                          className="w-full aspect-[4/3] object-cover rounded-xl mb-2"
                        />
                        <input
                          type="text"
                          value={p.caption}
                          onChange={(e) => handleUpdateCaption(idx, e.target.value)}
                          placeholder="Подпись к фото..."
                          className="w-full bg-slate-900 border border-slate-700 text-white text-[11px] px-2 py-1 rounded outline-none"
                        />
                      </div>
                    ))}

                    {photos.length < 3 && (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-[4/3] border-2 border-dashed border-slate-700 hover:border-amber-500/80 rounded-2xl flex flex-col items-center justify-center p-4 cursor-pointer text-slate-400 hover:text-amber-300 transition bg-slate-950/40"
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <Upload className="w-6 h-6 mb-1.5 text-amber-400" />
                        <span className="text-xs font-semibold">
                          {uploading ? 'Загрузка...' : 'Добавить фото улику'}
                        </span>
                        <span className="text-[10px] text-slate-500 text-center mt-1">
                          Селфи в магазине, коробка, скотч
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving || uploading}
                  className={`w-full py-3.5 font-bold rounded-xl text-white transition flex items-center justify-center gap-2 text-sm shadow-xl ${
                    saveSuccess
                      ? 'bg-emerald-600'
                      : 'bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 shadow-red-950/40'
                  }`}
                >
                  {saveSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Улики для шоу сохранены!</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{saving ? 'Сохраняем...' : 'Сохранить улики для шоу вечеринки'}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
