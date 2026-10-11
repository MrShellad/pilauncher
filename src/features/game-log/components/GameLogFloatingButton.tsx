import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bug, Loader2, Terminal } from 'lucide-react';

import { FocusItem } from '../../../ui/focus/FocusItem';
import type { GameState } from '../stores/useGameLogStore';

interface GameLogFloatingButtonProps {
  isVisible: boolean;
  hasDownloadTasks: boolean;
  gameState: GameState;
  logCount: number;
  title: string;
  onClick: () => void;
}

export const GameLogFloatingButton: React.FC<GameLogFloatingButtonProps> = ({
  isVisible,
  hasDownloadTasks,
  gameState,
  logCount,
  title,
  onClick,
}) => {
  const bottomOffset = hasDownloadTasks
    ? 'calc(clamp(1rem, 2vw, 1.5rem) + clamp(4.75rem, 5vw, 5.75rem))'
    : 'clamp(1rem, 2vw, 1.5rem)';
  const stateClass =
    gameState === 'crashed'
      ? 'border-red-500 text-red-100 hover:border-red-400'
      : gameState === 'launching'
        ? 'border-blue-500 text-blue-100 hover:border-blue-400'
        : 'border-ore-green text-white hover:border-ore-green';
  const badgeClass =
    gameState === 'crashed'
      ? 'bg-red-500 text-white'
      : gameState === 'launching'
        ? 'bg-blue-500 text-white'
        : 'bg-ore-green text-[#1E1E1F]';

  return (
    <AnimatePresence>
      {isVisible && (
        <FocusItem focusKey="btn-floating-game-log" onEnter={onClick} autoScroll={false}>
          {({ ref, focused }) => (
            <motion.button
              ref={ref as React.RefObject<HTMLButtonElement>}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              aria-label={title}
              title={title}
              onClick={onClick}
              className={`fixed right-[clamp(1rem,2vw,1.5rem)] z-[998] flex h-[clamp(3.5rem,4vw,4.5rem)] w-[clamp(3.5rem,4vw,4.5rem)] items-center justify-center rounded-full border-[0.125rem] bg-[#1E1E1F] shadow-lg outline-none transition-all ${stateClass} ${
                focused ? 'scale-105 ring-4 ring-white shadow-[0_0_20px_rgba(255,255,255,0.28)]' : ''
              }`}
              style={{ bottom: bottomOffset }}
            >
              {gameState === 'crashed' ? (
                <Bug className="h-[1.5rem] w-[1.5rem] sm:h-[1.625rem] sm:w-[1.625rem]" />
              ) : gameState === 'launching' ? (
                <Loader2 className="h-[1.5rem] w-[1.5rem] animate-spin sm:h-[1.625rem] sm:w-[1.625rem]" />
              ) : (
                <Terminal className="h-[1.5rem] w-[1.5rem] sm:h-[1.625rem] sm:w-[1.625rem]" />
              )}

              {logCount > 0 && (
                <span className={`absolute -right-[0.25rem] -top-[0.25rem] flex min-h-[1.375rem] min-w-[1.375rem] items-center justify-center rounded-full px-[0.25rem] text-[0.6875rem] font-bold ${badgeClass}`}>
                  {logCount > 999 ? '999+' : logCount}
                </span>
              )}
            </motion.button>
          )}
        </FocusItem>
      )}
    </AnimatePresence>
  );
};
