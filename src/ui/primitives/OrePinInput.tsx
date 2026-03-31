import React, { useRef, useState, useEffect } from 'react';
import type { KeyboardEvent, ClipboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OrePinInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  isAnimating?: boolean; // Rapid cycling state
  isAlive?: boolean;     // Idle pulse state
}

export const OrePinInput: React.FC<OrePinInputProps> = ({ 
  value, 
  onChange, 
  length = 6, 
  disabled = false,
  isAnimating = false,
  isAlive = false
}) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [animatedDigits, setAnimatedDigits] = useState<string[]>([]);
  const [lockedIndices, setLockedIndices] = useState<Set<number>>(new Set());

  // Handle slot machine animation
  useEffect(() => {
    if (!isAnimating) {
      setAnimatedDigits([]);
      setLockedIndices(new Set());
      return;
    }

    const startTime = Date.now();
    const durations = Array.from({ length }, (_, i) => 800 + i * 150 + Math.random() * 200);
    const maxDuration = Math.max(...durations);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;

      setAnimatedDigits((prevDigits) => {
        // Essential: start with base digits or random ones if first tick
        const currentArr = prevDigits.length === length ? prevDigits : Array(length).fill('');
        const nextDigits = [...currentArr];
        
        for (let i = 0; i < length; i++) {
          if (elapsed >= durations[i]) {
            nextDigits[i] = value[i] || '';
            setLockedIndices((prev) => {
              if (prev.has(i)) return prev;
              const next = new Set(prev);
              next.add(i);
              return next;
            });
          } else {
            // Rapid cycle digits (0-9)
            nextDigits[i] = Math.floor(Math.random() * 10).toString();
          }
        }
        return nextDigits;
      });

      if (elapsed >= maxDuration + 100) {
        clearInterval(interval);
      }
    }, 60);

    return () => clearInterval(interval);
  }, [isAnimating, value, length]);

  const handleChange = (index: number, val: string) => {
    if (disabled || isAnimating) return;
    const digit = val.replace(/\D/g, '').slice(0, 1);
    const chars = value.split('');
    
    while (chars.length < length) chars.push('');
    chars[index] = digit;
    
    const newVal = chars.join('').slice(0, length);
    onChange(newVal);

    if (digit && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled || isAnimating) return;
    
    if (e.key === 'Backspace') {
      const chars = value.split('');
      if (!chars[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (disabled || isAnimating) return;
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    
    const match = pastedText.match(new RegExp(`\\d{${length}}`));
    if (match) {
      onChange(match[0]);
    } else {
      const digits = pastedText.replace(/\D/g, '').slice(0, length);
      if (digits) {
        onChange(digits);
      }
    }
  };

  const splitValue = Array.from({ length }, (_, i) => value[i] || '');
  const displayDigits = isAnimating && animatedDigits.length === length ? animatedDigits : splitValue;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 w-full justify-between sm:justify-start">
        {displayDigits.map((digit, index) => (
          <motion.div
            key={index}
            animate={isAlive && !isAnimating ? {
              y: [0, -3, 0],
              opacity: [0.7, 1, 0.7],
              scale: [1, 1.02, 1],
              borderColor: ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']
            } : { y: 0, opacity: 1, scale: 1, borderColor: 'rgba(255,255,255,0.1)' }}
            transition={{
              duration: 2.0 + Math.random(),
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 0.2
            }}
            className="relative"
          >
            <div className="relative overflow-visible">
              <input
                key={index}
                ref={(el) => { inputsRef.current[index] = el; }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                placeholder="-"
                disabled={disabled || isAnimating}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                onFocus={(e) => e.target.select()}
                className={`w-10 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-mono font-bold border-[2px] transition-all focus:outline-none placeholder:text-white/10
                  ${disabled 
                    ? (isAlive ? 'bg-black/40 border-white/10 text-[#58585A]' : 'bg-[#1E1E1F]/50 border-[#1E1E1F]/50 text-[#58585A]')
                    : (isAnimating && !lockedIndices.has(index))
                      ? 'bg-[#1B293A] border-[#78C6FF]/60 text-[#78C6FF] shadow-[0_0_15px_rgba(120,198,255,0.2)]'
                      : 'bg-black/60 border-white/10 text-white hover:border-white/30 focus:border-[#78C6FF] focus:bg-[#1B293A]/80 focus:shadow-[0_0_20px_rgba(120,198,255,0.25)]'
                  }`}
              />
              
              {/* Optional: Char-specific jumping animation if value changes rapidly during animation */}
              {isAnimating && !lockedIndices.has(index) && (
                <motion.div
                  key={`char-jump-${digit}-${index}`}
                  initial={{ y: 5, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none text-xl sm:text-2xl font-mono font-bold text-[#78C6FF]"
                >
                  {digit}
                </motion.div>
              )}
            </div>
            
            {/* Rapid switch animation feedback */}
            <AnimatePresence>
              {isAnimating && !lockedIndices.has(index) && (
                <motion.div
                  key={`glow-${digit}-${index}`}
                  initial={{ opacity: 0.5, scale: 0.8 }}
                  animate={{ opacity: 0, scale: 1.2 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="absolute inset-0 bg-[#78C6FF]/10 pointer-events-none"
                />
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
