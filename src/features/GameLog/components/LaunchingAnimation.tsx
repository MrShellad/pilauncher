// src/features/GameLog/components/LaunchingAnimation.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameLogStore } from '../../../store/useGameLogStore';
import { useGameProcessService } from '../hooks/useGameProcessService';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreConfirmDialog } from '../../../ui/primitives/OreConfirmDialog';
import { Power } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HeroLogo } from '../../home/components/HeroLogo';

/* ─── Stage Definitions (ordered by triggerAt %) ────────── */

interface Stage { id: string; label: string; desc: string; color: string; at: number; }

const getStages = (t: any): Stage[] => [
  { id: 'PREPARE',  label: t('gameLog.launchAnimation.prepare', '启动游戏'),   desc: 'Datafixer',             color: '#60A5FA', at: 10  },
  { id: 'INIT',     label: t('gameLog.launchAnimation.init', '初始化游戏'), desc: 'Setting user',          color: '#34D399', at: 25  },
  { id: 'CORE',     label: t('gameLog.launchAnimation.core', '加载核心'),   desc: 'LWJGL / Render',        color: '#FBBF24', at: 40  },
  { id: 'RESOURCE', label: t('gameLog.launchAnimation.resource', '加载资源'),   desc: 'Reloading Resources',   color: '#F97316', at: 50  },
  { id: 'SOUND',    label: t('gameLog.launchAnimation.sound', '接近完成'),   desc: 'OpenAL initialized',    color: '#A78BFA', at: 80  },
  { id: 'ATLAS',    label: t('gameLog.launchAnimation.atlas', '资源细分'),   desc: 'Atlas created',         color: '#F472B6', at: 90  },
  { id: 'READY',    label: t('gameLog.launchAnimation.ready', '主菜单'),     desc: t('gameLog.launchAnimation.readyDesc', '游戏已成功启动'), color: '#4ADE80', at: 100 },
];

const ATLAS_MAX = 15;

/* ─── Progress Computation ───────────────────────────────── */

function computeProgress(logs: string[]): number {
  if (logs.length === 0) return 0;

  let p = 3;       // 初始启动
  let atlas = 0;

  for (const line of logs) {
    const l = line.toLowerCase();

    if (p < 10 && l.includes('datafixer'))                                          { p = 10; continue; }
    if (p < 25 && l.includes('setting user'))                                       { p = 25; continue; }
    if (p < 40 && (l.includes('lwjgl') || l.includes('backend library')))           { p = 40; continue; }
    if (p < 50 && l.includes('reloading resourcemanager'))                          { p = 50; continue; }
    
    // Atlas created 资源细分 50% → 90%
    if (l.includes('created:') && l.includes('atlas')) {
      atlas++;
      const ap = 50 + (Math.min(atlas, ATLAS_MAX) / ATLAS_MAX) * 40; // up to 90
      if (ap > p) p = ap;
    }

    // OpenAL initialized 接近完成 80%
    if (p < 80 && l.includes('openal initialized'))                                 { p = 80; continue; }
  }

  return Math.min(Math.floor(p), 99);
}

/* ─── Component ──────────────────────────────────────────── */

export const LaunchingAnimation: React.FC = () => {
  const { t } = useTranslation();
  const STAGES = useMemo(() => getStages(t), [t]);
  
  const gameState = useGameLogStore((s) => s.gameState);
  const logs      = useGameLogStore((s) => s.logs);
  const currentInstanceId = useGameLogStore((s) => s.currentInstanceId);

  const peakRef             = useRef(0);
  const [pct,    setPct]    = useState(0);
  const [hidden, setHidden] = useState(false);
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const { killCurrentGame } = useGameProcessService();
  const lastLogLenRef       = useRef(0);
  const timerRef            = useRef<any>(null);
  const overlayRef          = useRef<HTMLDivElement>(null);
  const prevFocusRef        = useRef<HTMLElement | null>(null);

  // Advance progress based on logs — never regress
  useEffect(() => {
    if (gameState === 'idle' || gameState === 'crashed') {
      peakRef.current = 0; setPct(0); setHidden(false); 
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    const next = computeProgress(logs);
    if (next > peakRef.current) { peakRef.current = next; setPct(next); }
  }, [logs, gameState]);

  // Log heartbeat: If we haven't seen a new log in 1.8 seconds and we are somewhat loaded, assume main menu is ready
  useEffect(() => {
    if ((gameState === 'launching' || gameState === 'running') && pct < 100) {
      if (logs.length !== lastLogLenRef.current) {
        lastLogLenRef.current = logs.length;
        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(() => {
          // No logs for 1.8s
          if (peakRef.current >= 80) {
            peakRef.current = 100;
            setPct(100);
          }
        }, 1800);
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [logs.length, gameState, pct]);

  // Hide 2.5s after 100%
  useEffect(() => {
    if (pct === 100) {
      const t = setTimeout(() => setHidden(true), 2500);
      return () => clearTimeout(t);
    }
  }, [pct]);

  const isVisible = (gameState === 'launching' || gameState === 'running') && !hidden;

  // Focus trap: move focus into overlay when visible, restore when hidden
  useEffect(() => {
    if (isVisible) {
      prevFocusRef.current = document.activeElement as HTMLElement;
      const raf = requestAnimationFrame(() => {
        overlayRef.current?.focus();
      });
      return () => cancelAnimationFrame(raf);
    } else {
      prevFocusRef.current?.focus();
      prevFocusRef.current = null;
    }
  }, [isVisible]);

  const stageIdx = useMemo(() => {
    for (let i = STAGES.length - 1; i >= 0; i--) if (pct >= STAGES[i].at) return i;
    return -1;
  }, [pct]);

  const stage = stageIdx >= 0 ? STAGES[stageIdx] : null;

  return (
    <>
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="launching-overlay"
          ref={overlayRef}
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          data-tauri-drag-region="true"
          className="fixed inset-0 z-[89] flex flex-col items-center justify-center select-none"
          style={{ background: 'rgba(6, 6, 8, 0.90)', backdropFilter: 'blur(16px) saturate(0.75)' }}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={t('gameLog.launchAnimation.ariaLabel', '游戏启动中')}
        >
          {/* ── 1. HeroLogo Center Motion (线性加速位移至水平及垂直居中偏上位置，并降低亮度) ── */}
          <motion.div
            initial={{ y: -120, opacity: 1, filter: 'brightness(1)' }}
            animate={{ y: 0, opacity: 0.8, filter: 'brightness(0.65)' }}
            transition={{ duration: 0.55, ease: 'easeIn' }}
            className="mb-8 flex items-center justify-center"
          >
            <HeroLogo instanceId={currentInstanceId} />
          </motion.div>

          {/* ── 2. Loading Content Area (协调延迟淡入，暂时隐藏其它元素) ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.35, ease: 'easeOut' }}
            className="flex flex-col items-center w-full max-w-[28rem] px-4"
          >
            {/* 提示性文字：像素对齐，完全使用 rem 替代 px 硬编码 */}
            <div className="flex justify-between items-end w-full mb-[0.625rem] font-minecraft text-[0.875rem] tracking-widest text-white/90">
              <span className="font-bold uppercase tracking-[0.08em]">
                {stage?.label ?? t('gameLog.launchAnimation.prepareFallback', '准备启动')}
              </span>
              <span className="font-mono font-bold">{pct}%</span>
            </div>

            {/* ── 3. Horizontal Loading Progress Bar (从左到右逐渐改变亮度) ── */}
            <div className="w-full h-5 border-[2px] border-[var(--ore-border-color)] bg-[#1a1a1c] relative overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] mb-3">
              <motion.div 
                className="h-full relative"
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 90, damping: 16 }}
                style={{
                  // 渐变色：从左到右由暗变亮逐渐过渡
                  background: 'linear-gradient(90deg, rgba(74, 222, 128, 0.35) 0%, rgba(74, 222, 128, 1) 100%)',
                  boxShadow: '0 0 8px rgba(74, 222, 128, 0.4), inset 0 2px 2px rgba(255, 255, 255, 0.2)'
                }}
              />
            </div>

            {/* 详细描述：完全使用 rem 替代 px，提升小屏幕可读性 */}
            <p className="font-minecraft text-[0.75rem] text-white/50 tracking-wider text-center h-[1.125rem] truncate select-text w-full mb-6">
              {stage?.desc ?? t('gameLog.launchAnimation.envFallback', '正在准备游戏环境')}
            </p>

            {/* ── 4. Stage Milestone Indicators ── */}
            <div className="flex items-center justify-between w-full gap-1 mb-8">
              {STAGES.map((s, i) => {
                const reached = pct >= s.at;
                const active  = stageIdx === i;
                return (
                  <div 
                    key={s.id} 
                    className="flex flex-col items-center flex-1"
                    style={{ opacity: reached ? 1 : 0.25, transition: 'opacity 0.3s' }}
                  >
                    <div 
                      className="w-full h-2 rounded-[1px] border border-black/40"
                      style={{
                        background: reached ? s.color : 'rgba(255,255,255,0.12)',
                        boxShadow: active ? `0 0 8px ${s.color}` : 'none',
                        transition: 'all 0.3s'
                      }}
                    />
                    <span 
                      className="font-minecraft mt-1.5 uppercase font-bold text-[0.625rem] tracking-wider"
                      style={{ color: reached ? s.color : 'rgba(255,255,255,0.3)' }}
                    >
                      {s.at}%
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── 5. Action Buttons ── */}
            {pct < 100 && (
              <div className="shrink-0 pointer-events-auto">
                <OreButton
                  variant="danger"
                  size="md"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowKillConfirm(true);
                  }}
                  className="font-minecraft text-[0.75rem] tracking-widest !h-9"
                >
                  <Power size={14} className="mr-2" /> {t('gameLog.launchAnimation.killProcess', '结束进程')}
                </OreButton>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <OreConfirmDialog
      isOpen={showKillConfirm}
      onClose={() => setShowKillConfirm(false)}
      onConfirm={() => {
        killCurrentGame();
        setShowKillConfirm(false);
      }}
      title={t('gameLog.launchAnimation.killWarnTitle', '安全警告')}
      headline={t('gameLog.launchAnimation.killWarnHeadline', '确定要强制终止游戏吗？')}
      description={t('gameLog.launchAnimation.killWarnDesc', '强行关闭进程可能导致当前游戏世界的存档损坏，或者造成未保存的数据丢失。仅在游戏完全无响应（卡死）时使用此功能。')}
      confirmLabel={t('gameLog.launchAnimation.killConfirm', '强制结束')}
      cancelLabel={t('gameLog.launchAnimation.killCancel', '继续等待')}
      confirmVariant="danger"
      tone="danger"
    />
    </>
  );
};
