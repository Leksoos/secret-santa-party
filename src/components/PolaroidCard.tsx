import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, X } from 'lucide-react';

interface PolaroidProps {
  url: string;
  caption: string;
  rotation?: number;
  badge?: string;
}

export const PolaroidCard: React.FC<PolaroidProps> = ({
  url,
  caption,
  rotation = 0,
  badge,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.05, rotate: 0, zIndex: 20 }}
        style={{ rotate: `${rotation}deg` }}
        className="relative bg-white text-slate-900 p-3 pb-6 rounded shadow-xl border border-amber-100/40 cursor-pointer transition-shadow hover:shadow-2xl group w-64 max-w-full"
        onClick={() => setIsOpen(true)}
      >
        {/* Tape artifact on top */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 tape rounded-sm -rotate-2 opacity-80 z-10" />

        {badge && (
          <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow z-10">
            {badge}
          </div>
        )}

        {/* Photo area */}
        <div className="w-full aspect-[4/3] bg-slate-100 overflow-hidden rounded-sm relative">
          <img
            src={url}
            alt={caption || 'Улика Тайного Санты'}
            className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <span className="bg-black/60 text-white p-2 rounded-full">
              <ZoomIn className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* Handwritten style caption */}
        <p className="mt-3 text-center text-xs font-semibold text-slate-700 tracking-tight line-clamp-2 italic font-mono">
          "{caption || 'Секретная операция покупки'}"
        </p>
      </motion.div>

      {/* Lightbox popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-md"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="relative max-w-2xl w-full bg-white text-slate-900 p-4 pb-8 rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-3 right-3 bg-slate-900/80 text-white p-2 rounded-full hover:bg-slate-900 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <img
                src={url}
                alt={caption}
                className="w-full max-h-[70vh] object-contain rounded"
              />
              <p className="mt-4 text-center text-base font-semibold text-slate-800 italic font-mono">
                {caption}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
