import React, { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { sound } from '../lib/sound';

export const AudioToggle: React.FC = () => {
  const [muted, setMuted] = useState(sound.getMuted());

  const toggle = () => {
    const nextState = sound.toggleMute();
    setMuted(nextState);
    if (!nextState) {
      sound.play('bells');
    }
  };

  return (
    <button
      onClick={toggle}
      title={muted ? 'Включить праздничные звуки' : 'Выключить звук'}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-medium transition shadow-sm backdrop-blur-sm"
    >
      {muted ? (
        <>
          <VolumeX className="w-3.5 h-3.5 text-red-400" />
          <span>Звук выкл</span>
        </>
      ) : (
        <>
          <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>Звук вкл</span>
        </>
      )}
    </button>
  );
};
