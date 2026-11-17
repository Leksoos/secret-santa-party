import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Tv, Gamepad2, Gift, Users, Copy, Check, QrCode } from 'lucide-react';
import { AudioToggle } from './AudioToggle';
import { ClientRoomView, PublicParticipant } from '../types';
import QRCode from 'qrcode';
import { computeBaseUrl, fetchNetworkInfo, getNetworkOverride } from '../lib/network';

interface HeaderProps {
  room: ClientRoomView;
  currentParticipant?: PublicParticipant | null;
  activeTab: 'lobby' | 'my-santa' | 'tv' | 'controller';
  onTabChange: (tab: 'lobby' | 'my-santa' | 'tv' | 'controller') => void;
}

export const Header: React.FC<HeaderProps> = ({
  room,
  currentParticipant,
  activeTab,
  onTabChange,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [qrTargetUrl, setQrTargetUrl] = useState<string>('');

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openQrModal = async () => {
    let baseUrl = computeBaseUrl(null, getNetworkOverride());
    try {
      const netInfo = await fetchNetworkInfo();
      if (netInfo) {
        baseUrl = computeBaseUrl(netInfo, getNetworkOverride());
      }
    } catch {
      // Fallback to computed base URL
    }
    const url = `${baseUrl}/?code=${room.code}&checkin=true`;
    setQrTargetUrl(url);
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrUrl(dataUrl);
      setShowQr(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-md">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Logo and Room Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center text-xl shadow-lg shadow-red-900/30">
            🎅
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-100 text-sm sm:text-base leading-tight">
                {room.title}
              </h1>
              <button
                onClick={copyCode}
                className="flex items-center gap-1 bg-red-950/60 hover:bg-red-900/60 border border-red-800/80 text-red-300 font-mono text-xs font-bold px-2 py-0.5 rounded transition"
                title="Скопировать код комнаты"
              >
                <span>{room.code}</span>
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={openQrModal}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title="Показать QR-код для гостей"
              >
                <QrCode className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Бюджет: <span className="text-amber-400 font-medium">{room.budget}</span> • Участников: {room.participants.length}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <button
            onClick={() => onTabChange('lobby')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'lobby'
                ? 'bg-red-600 text-white shadow-md shadow-red-900/40'
                : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Лобби</span>
          </button>

          {room.status !== 'lobby' && (
            <button
              onClick={() => onTabChange('my-santa')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                activeTab === 'my-santa'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Мой подарок</span>
            </button>
          )}

          <button
            onClick={() => onTabChange('tv')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'tv'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40 glow-emerald'
                : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-emerald-900/50'
            }`}
          >
            <Tv className="w-3.5 h-3.5 text-emerald-300" />
            <span>Экран ТВ</span>
          </button>

          <button
            onClick={() => onTabChange('controller')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'controller'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Пульт</span>
          </button>
        </div>

        {/* Right side controls & user */}
        <div className="flex items-center gap-2">
          <AudioToggle />
          {currentParticipant && (
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700 text-xs">
              <span className="text-base">{currentParticipant.avatar}</span>
              <span className="font-semibold text-slate-200 max-w-[80px] truncate">
                {currentParticipant.name}
              </span>
              {currentParticipant.isHost && (
                <span className="text-[10px] bg-red-600/80 text-white px-1.5 rounded-full font-bold">
                  Хост
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal strictly centered via Portal */}
      {showQr &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => setShowQr(false)}
          >
            <div
              className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-sm w-full text-center shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-1 font-festive">
                Сканируй для входа!
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Открой камеру смартфона или отсканируй в Telegram
              </p>

              <div className="bg-white p-3 rounded-2xl inline-block shadow-lg mb-4">
                <img src={qrUrl} alt="QR Code" className="w-52 h-52 mx-auto" />
              </div>

              <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700 flex items-center justify-between mb-3">
                <span className="text-sm font-mono font-bold text-red-400">
                  {room.code}
                </span>
                <button
                  onClick={copyCode}
                  className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-white font-medium"
                >
                  {copied ? 'Скопировано!' : 'Копировать'}
                </button>
              </div>

              {qrTargetUrl && (
                <p className="text-[11px] text-slate-400 font-mono select-all break-all mb-4 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  {qrTargetUrl}
                </p>
              )}

              <button
                onClick={() => setShowQr(false)}
                className="w-full py-2.5 bg-red-600 hover:bg-red-500 font-bold rounded-xl text-white transition text-xs uppercase tracking-wider"
              >
                Закрыть
              </button>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
};
