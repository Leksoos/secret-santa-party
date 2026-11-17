import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Wifi,
  Globe,
  Check,
  Copy,
  X,
  RotateCcw,
  Sparkles,
  Radio,
  ExternalLink,
  Info,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  NetworkInfoResponse,
  computeBaseUrl,
  getNetworkOverride,
  setNetworkOverride,
  clearNetworkOverride,
} from '../lib/network';

interface NetworkSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  networkInfo: NetworkInfoResponse | null;
  activeBaseUrl: string;
  roomCode: string;
  onBaseUrlChange: (newBaseUrl: string) => void;
}

export const NetworkSettingsModal: React.FC<NetworkSettingsModalProps> = ({
  isOpen,
  onClose,
  networkInfo,
  activeBaseUrl,
  roomCode,
  onBaseUrlChange,
}) => {
  const [customInput, setCustomInput] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [previewQr, setPreviewQr] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Sync initial custom override value when modal opens
  useEffect(() => {
    if (isOpen) {
      const savedOverride = getNetworkOverride() || '';
      setCustomInput(savedOverride);
      setFeedback(null);
    }
  }, [isOpen]);

  // Generate live preview QR code whenever activeBaseUrl or roomCode changes
  useEffect(() => {
    if (!isOpen) return;
    const targetUrl = `${activeBaseUrl}/?code=${roomCode}&checkin=true`;
    QRCode.toDataURL(targetUrl, {
      width: 180,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setPreviewQr(url))
      .catch((err) => console.error('Failed to generate preview QR:', err));
  }, [isOpen, activeBaseUrl, roomCode]);

  // Close on Escape key
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

  const currentFullUrl = `${activeBaseUrl}/?code=${roomCode}`;
  const clientPort =
    typeof window !== 'undefined' && window.location.port
      ? window.location.port
      : networkInfo?.port
      ? String(networkInfo.port)
      : '5173';

  const copyUrl = () => {
    navigator.clipboard.writeText(currentFullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectInterface = (ip: string) => {
    const newUrl = `http://${ip}${clientPort ? `:${clientPort}` : ''}`;
    setNetworkOverride(newUrl);
    setCustomInput(newUrl);
    onBaseUrlChange(newUrl);
    setFeedback(`Выбран IP интерфейса: ${ip}`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleApplyCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) {
      handleResetAuto();
      return;
    }
    const computed = computeBaseUrl(networkInfo, trimmed);
    setNetworkOverride(computed);
    onBaseUrlChange(computed);
    setFeedback(`Применен адрес: ${computed}`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleResetAuto = () => {
    clearNetworkOverride();
    setCustomInput('');
    const autoUrl = computeBaseUrl(networkInfo, null);
    onBaseUrlChange(autoUrl);
    setFeedback('Сброшено на автоопределение Wi-Fi');
    setTimeout(() => setFeedback(null), 3000);
  };

  // Determine if a given IP is currently the active base URL
  const isSelectedAddress = (addr: string) => {
    try {
      const activeObj = new URL(activeBaseUrl);
      return activeObj.hostname === addr;
    } catch {
      return activeBaseUrl.includes(addr);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-7 max-w-xl w-full text-slate-100 shadow-2xl relative my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>Настройки сети и QR-кода</span>
                <span className="text-[10px] uppercase font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                  Wi-Fi / LAN
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Адрес, который кодируется в QR-кодах для смартфонов гостей
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback message banner if triggered */}
        {feedback && (
          <div className="mb-4 px-3.5 py-2 rounded-xl bg-emerald-950/60 border border-emerald-700/80 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Current Active Base URL + Copy Box */}
        <div className="mb-5 bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1.5 flex items-center justify-between">
            <span>Текущий активный адрес для QR-кода:</span>
            <span className="text-emerald-400 font-mono text-[10px]">● Онлайн</span>
          </div>
          <div className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-700/70 p-2.5 rounded-xl">
            <span className="text-xs sm:text-sm font-mono font-bold text-amber-300 truncate select-all">
              {currentFullUrl}
            </span>
            <button
              onClick={copyUrl}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer"
              title="Скопировать ссылку"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Скопировано!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Копировать</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Two-Column Area: Interfaces / Custom Input on Left, Live QR Preview on Right */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 mb-5 items-start">
          {/* Interfaces and Custom Input (sm:col-span-8) */}
          <div className="sm:col-span-8 space-y-4">
            {/* Detected Interfaces List */}
            <div>
              <div className="text-xs font-bold text-slate-300 mb-2 flex items-center justify-between">
                <span>Обнаруженные сетевые интерфейсы:</span>
                {networkInfo?.ip && (
                  <span className="text-[10px] text-slate-400">
                    Авто-IP: <strong className="text-emerald-400 font-mono">{networkInfo.ip}</strong>
                  </span>
                )}
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {networkInfo?.interfaces && networkInfo.interfaces.length > 0 ? (
                  networkInfo.interfaces.map((iface) => {
                    const selected = isSelectedAddress(iface.address);
                    const isHigh = (iface.score || 0) >= 100;
                    return (
                      <div
                        key={`${iface.name}-${iface.address}`}
                        onClick={() => handleSelectInterface(iface.address)}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition ${
                          selected
                            ? 'bg-emerald-950/40 border-emerald-500/80 text-white shadow-md'
                            : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/60 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Radio
                            className={`w-4 h-4 shrink-0 ${
                              selected ? 'text-emerald-400' : 'text-slate-500'
                            }`}
                          />
                          <div className="truncate">
                            <span className="font-bold text-white mr-1.5">{iface.name}:</span>
                            <span className="font-mono text-amber-300">{iface.address}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isHigh && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              Wi-Fi ⭐
                            </span>
                          )}
                          {selected && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                              Выбран
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-slate-500 italic p-2 bg-slate-950/40 rounded-xl">
                    Интерфейсы загружаются или не обнаружены...
                  </div>
                )}
              </div>
            </div>

            {/* Custom Tunnel or IP Override Form */}
            <form onSubmit={handleApplyCustom} className="pt-2 border-t border-slate-800">
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Свой адрес или туннель (ngrok / Cloudflare):</span>
                </span>
                {getNetworkOverride() && (
                  <button
                    type="button"
                    onClick={handleResetAuto}
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Сброс на авто</span>
                  </button>
                )}
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="https://xxx.ngrok-free.app или 192.168.1.50"
                  className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition shrink-0 cursor-pointer"
                >
                  Применить
                </button>
              </div>
            </form>
          </div>

          {/* Live QR Preview (sm:col-span-4) */}
          <div className="sm:col-span-4 bg-slate-950/70 border border-slate-800 p-3.5 rounded-2xl flex flex-col items-center justify-center text-center">
            <span className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
              Текущий QR-код
            </span>
            <div className="bg-white p-2 rounded-xl border border-slate-300 shadow-lg">
              {previewQr ? (
                <img
                  src={previewQr}
                  alt="Live QR Preview"
                  className="w-28 h-28 sm:w-32 sm:h-32 object-contain"
                />
              ) : (
                <div className="w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center text-slate-400 text-xs">
                  Загрузка...
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 leading-tight">
              Отсканируйте с телефона для быстрой проверки связи
            </p>
          </div>
        </div>

        {/* Bottom Help Tips */}
        <div className="bg-slate-950/50 border border-slate-800/80 p-3 rounded-2xl text-[11px] text-slate-400 space-y-1">
          <div className="flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Локальный Wi-Fi:</strong> Все телефоны гостей должны быть подключены к той же Wi-Fi сети.
            </span>
          </div>
          <div className="flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
            <span>
              <strong>Удаленные гости:</strong> Для доступа через Интернет запустите{' '}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-indigo-300">ngrok http 5173</code> и
              вставьте полученный URL в поле выше.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
          >
            Готово / Закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
