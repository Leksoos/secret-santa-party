import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, Crown, Copy, Check, X, ShieldCheck, Sparkles } from 'lucide-react';
import QRCode from 'qrcode';
import { ClientRoomView } from '../types';

interface HostQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBaseUrl: string;
  room: ClientRoomView;
}

export const HostQrModal: React.FC<HostQrModalProps> = ({
  isOpen,
  onClose,
  activeBaseUrl,
  room,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const hostClaimUrl = `${activeBaseUrl}/?code=${room.code}&role=host&hostId=${room.hostId}&tab=controller`;

  const hostParticipant = room.participants.find(
    (p) => p.id === room.hostId || p.isHost
  );
  const hostName = hostParticipant ? hostParticipant.name : 'Организатор';
  const hostAvatar = hostParticipant ? hostParticipant.avatar : '👑';

  // Generate QR code whenever modal opens or hostClaimUrl changes
  useEffect(() => {
    if (!isOpen) return;

    QRCode.toDataURL(hostClaimUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate Host QR code:', err));
  }, [isOpen, hostClaimUrl]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyHostUrl = () => {
    navigator.clipboard.writeText(hostClaimUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 sm:p-8 max-w-md w-full text-slate-100 shadow-2xl relative my-8 glow-gold text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          title="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-wider mb-3">
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span>Пульт ведущего на смартфон</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-black text-white font-festive">
          Управляйте шоу с телефона 📱
        </h3>
        <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
          Отсканируйте камерой, чтобы переключать раунды, включать аплодисменты и запускать вопросы прямо со смартфона.
        </p>

        {/* Host Identity Tag */}
        <div className="mt-4 mb-4 inline-flex items-center gap-2 bg-slate-950/80 border border-amber-500/40 px-3.5 py-1.5 rounded-2xl shadow-inner">
          <span className="text-xl">{hostAvatar}</span>
          <span className="text-xs font-bold text-amber-300">
            Хост: {hostName}
          </span>
          <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-1.5 py-0.5 rounded border border-amber-500/30">
            {room.code}
          </span>
        </div>

        {/* QR Code Container */}
        <div className="relative bg-white p-3 rounded-2xl border-2 border-amber-400 shadow-xl inline-block mx-auto mb-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR-код пульта ведущего"
              className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl block"
            />
          ) : (
            <div className="w-56 h-56 sm:w-64 sm:h-64 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>Генерация пульта...</span>
            </div>
          )}
        </div>

        {/* Status / Dual-screen guidance */}
        <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl text-[11px] text-slate-300 text-left space-y-1.5 mb-4">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Двухэкранный режим без конфликтов</span>
          </div>
          <p className="text-slate-400 pl-6 leading-relaxed">
            Экран ТВ останется чистым для гостей и зрителей, а ваш телефон получит мастер-кнопки управления вечеринкой.
          </p>
        </div>

        {/* Copy Link & Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={copyHostUrl}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Ссылка скопирована!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-amber-400" />
                <span>Скопировать прямую ссылку на пульт</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition cursor-pointer uppercase tracking-wider"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
