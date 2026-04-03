// src/features/GameLog/components/LaunchingAnimation.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameLogStore } from '../../../store/useGameLogStore';
import { useGameProcessService } from '../hooks/useGameProcessService';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreConfirmDialog } from '../../../ui/primitives/OreConfirmDialog';
import { Power } from 'lucide-react';

/* ─── Stage Definitions (ordered by triggerAt %) ────────── */

interface Stage { id: string; label: string; desc: string; color: string; at: number; }

const STAGES: Stage[] = [
  { id: 'PREPARE',  label: '启动游戏',   desc: 'Datafixer',             color: '#60A5FA', at: 10  },
  { id: 'INIT',     label: '初始化游戏', desc: 'Setting user',          color: '#34D399', at: 25  },
  { id: 'CORE',     label: '加载核心',   desc: 'LWJGL / Render',        color: '#FBBF24', at: 40  },
  { id: 'RESOURCE', label: '加载资源',   desc: 'Reloading Resources',   color: '#F97316', at: 50  },
  { id: 'SOUND',    label: '接近完成',   desc: 'OpenAL initialized',    color: '#A78BFA', at: 80  },
  { id: 'ATLAS',    label: '资源细分',   desc: 'Atlas created',         color: '#F472B6', at: 90  },
  { id: 'READY',    label: '主菜单',     desc: '游戏已成功启动',        color: '#4ADE80', at: 100 },
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

    // OpenAL initialized 接近完成 80% (如果它比 Atlas 更早或更晚出现，它都可以保障至少拉到 80)
    if (p < 80 && l.includes('openal initialized'))                                 { p = 80; continue; }
  }

  // 返回最大不能超过 99%，100% 由后面的无日志计时器决定
  return Math.min(Math.floor(p), 99);
}

/* ─── SVG helpers ────────────────────────────────────────── */

const CX = 150, CY = 150, R = 120, SW = 14;
const CIRC = 2 * Math.PI * R;

/** Point on ring at progress pct (0-100), starting from top */
function ringPt(pct: number): [number, number] {
  const a = -Math.PI / 2 + (pct / 100) * 2 * Math.PI;
  return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
}

/* ─── Component ──────────────────────────────────────────── */

export const LaunchingAnimation: React.FC = () => {
  const gameState = useGameLogStore((s) => s.gameState);
  const logs      = useGameLogStore((s) => s.logs);

  const peakRef             = useRef(0);
  const [pct,    setPct]    = useState(0);
  const [hidden, setHidden] = useState(false);
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const { killCurrentGame } = useGameProcessService();
  const lastLogLenRef       = useRef(0);
  const timerRef            = useRef<any>(null);

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

  const stageIdx = useMemo(() => {
    for (let i = STAGES.length - 1; i >= 0; i--) if (pct >= STAGES[i].at) return i;
    return -1;
  }, [pct]);

  const stage     = stageIdx >= 0 ? STAGES[stageIdx] : null;
  const arcColor  = stage?.color ?? '#94A3B8';
  const dashOff   = CIRC - (pct / 100) * CIRC;
  const [tipX, tipY] = ringPt(pct);

  return (
    <>
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="launching-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          data-tauri-drag-region="true"
          className="fixed inset-0 z-[89] flex flex-col items-center justify-center select-none"
          style={{ background: 'rgba(6,6,8,0.88)', backdropFilter: 'blur(14px) saturate(0.7)' }}
        >
          {/* ── SVG Progress Ring ── */}
          <svg width="300" height="300" viewBox="0 0 300 300" style={{ overflow: 'visible' }} aria-hidden="true" data-tauri-drag-region="true">
            <defs>
              <filter id="lc-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="tip-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Background full ring */}
            <circle cx={CX} cy={CY} r={R} fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth={SW} />

            {/* Colored progress arc */}
            <circle cx={CX} cy={CY} r={R} fill="none"
              stroke={arcColor} strokeWidth={SW} strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={dashOff}
              transform={`rotate(-90 ${CX} ${CY})`}
              filter="url(#lc-glow)"
              style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease' }}
            />

            {/* Milestone dots — one per stage at its % position */}
            {STAGES.map((s) => {
              const [mx, my] = ringPt(s.at);
              const reached  = pct >= s.at;
              return (
                <circle key={s.id} cx={mx} cy={my} r={8}
                  fill={reached ? s.color : 'rgba(255,255,255,0.12)'}
                  style={{
                    transition: 'fill 0.5s ease',
                    filter: reached ? `drop-shadow(0 0 6px ${s.color})` : 'none',
                  }}
                  data-tauri-drag-region="true"
                />
              );
            })}

            {/* Bright tip dot that follows the arc leading edge */}
            {pct > 0 && (
              <g transform={`translate(${tipX},${tipY})`}
                style={{ transition: 'transform 0.8s cubic-bezier(0.4,0,0.2,1)' }} data-tauri-drag-region="true">
                <circle r={14} fill="white" opacity={0.12} data-tauri-drag-region="true" />
                <circle r={6} fill="white" opacity={0.95} filter="url(#tip-glow)" data-tauri-drag-region="true" />
              </g>
            )}

            {/* Inner slow-spinning dashed ring */}
            <circle cx={CX} cy={CY} r={R - 34}
              fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={2.5} strokeDasharray="8 20" data-tauri-drag-region="true">
              <animateTransform attributeName="transform" type="rotate"
                from={`0 ${CX} ${CY}`} to={`360 ${CX} ${CY}`} dur="10s" repeatCount="indefinite" />
            </circle>

            {/* Center percentage */}
            <text x={CX} y={CY - 4} textAnchor="middle" data-tauri-drag-region="true"
              fill="white" fontSize="48" fontWeight="bold" fontFamily="'Minecraft', 'Neo Minecraft', monospace">
              {pct}%
            </text>
            <text x={CX} y={CY + 26} textAnchor="middle" data-tauri-drag-region="true"
              fill="rgba(255,255,255,0.3)" fontSize="14" fontFamily="'Minecraft', 'Neo Minecraft', monospace">
              {stage?.id ?? 'PREPARE'}
            </text>
          </svg>

          {/* ── Stage label & description ── */}
          <AnimatePresence mode="wait">
            <motion.div key={stage?.id ?? 'prepare'}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="mt-6 text-center px-8 pointer-events-none" data-tauri-drag-region="true">
              <p className="font-minecraft text-xl tracking-widest font-bold drop-shadow-md"
                style={{ color: stage?.color ?? 'rgba(255,255,255,0.5)' }}>
                {stage?.label ?? '准备启动'}
              </p>
              <p className="font-minecraft text-base mt-2 drop-shadow-md" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {stage?.desc ?? '正在准备游戏环境'}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* ── Stage milestone pills ── */}
          <div className="mt-8 flex items-end gap-2.5 pointer-events-none" data-tauri-drag-region="true">
            {STAGES.map((s, i) => {
              const reached = pct >= s.at;
              const active  = stageIdx === i;
              return (
                <div key={s.id} className="flex flex-col items-center gap-2"
                  style={{ opacity: reached ? 1 : 0.3, transition: 'opacity 0.4s' }}>
                  <div style={{
                    width:        active ? 36 : 10,
                    height:       10,
                    borderRadius: 2, // Less rounded for a more MC feel
                    background:   reached ? s.color : 'rgba(255,255,255,0.15)',
                    boxShadow:    active ? `0 0 12px ${s.color}90` : 'none',
                    transition:   'all 0.5s cubic-bezier(0.4,0,0.2,1)',
                  }} />
                  <span className="font-minecraft"
                    style={{ fontSize: 11, color: reached ? s.color : 'rgba(255,255,255,0.3)', transition: 'color 0.4s' }}>
                    {s.at}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── Action Buttons ── */}
          {pct < 100 && (
            <div className="mt-14 shrink-0 pointer-events-auto">
              <OreButton
                variant="danger"
                size="md"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowKillConfirm(true);
                }}
              >
                <Power size={18} className="mr-2" /> 结束进程
              </OreButton>
            </div>
          )}
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
      title="安全警告"
      headline="确定要强制终止游戏吗？"
      description="强行关闭进程可能导致当前游戏世界的存档损坏，或者造成未保存的数据丢失。仅在游戏完全无响应（卡死）时使用此功能。"
      confirmLabel="强制结束"
      cancelLabel="继续等待"
      confirmVariant="danger"
      tone="danger"
    />
    </>
  );
};
