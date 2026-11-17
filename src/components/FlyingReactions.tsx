import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactionEvent } from '../types';

interface FloatingReaction extends ReactionEvent {
  leftPos: number;
}

interface Props {
  lastReaction: ReactionEvent | null;
}

export const FlyingReactions: React.FC<Props> = ({ lastReaction }) => {
  const [items, setItems] = useState<FloatingReaction[]>([]);

  useEffect(() => {
    if (!lastReaction) return;

    const newItem: FloatingReaction = {
      ...lastReaction,
      leftPos: Math.floor(15 + Math.random() * 70), // Random percentage horizontal position
    };

    setItems((prev) => [...prev.slice(-15), newItem]);

    const timer = setTimeout(() => {
      setItems((prev) => prev.filter((it) => it.id !== newItem.id));
    }, 2800);

    return () => clearTimeout(timer);
  }, [lastReaction]);

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 100, scale: 0.5 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: -450,
              scale: [0.5, 1.4, 1.2, 0.9],
              x: (Math.random() - 0.5) * 60,
            }}
            transition={{ duration: 2.6, ease: 'easeOut' }}
            style={{ left: `${item.leftPos}%`, bottom: '40px' }}
            className="absolute flex flex-col items-center"
          >
            <span className="text-4xl sm:text-5xl filter drop-shadow-lg">
              {item.emoji}
            </span>
            <span className="text-[10px] sm:text-xs font-bold text-white/90 bg-slate-900/80 px-2 py-0.5 rounded-full mt-1 border border-white/20 whitespace-nowrap">
              {item.senderName}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
