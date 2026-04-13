import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { Gauge, Loader2, ShieldAlert, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { OreMotionTokens } from '../../../style/tokens/motion';
import type { MemoryAllocationMode, SystemMemoryStats } from '../../../types/memory';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../ui/primitives/OreDropdown';
import { OreSlider } from '../../../ui/primitives/OreSlider';
import {
  MIN_MEMORY_MB,
  resolveMemoryAllocationPlan,
} from '../logic/memoryAllocation';

export interface MemorySliderValue {
  memoryAllocationMode: MemoryAllocationMode;
  maxMemory: number;
  minMemory: number;
}

interface MemorySliderProps {
  value: MemorySliderValue;
  onChange: (value: MemorySliderValue) => void;
  disabled?: boolean;
  onArrowPress?: (direction: string) => boolean;
}

const formatMemoryGb = (memoryMb: number) => `${(memoryMb / 1024).toFixed(1)} GB`;

const buildNextValue = (
  current: MemorySliderValue,
  updates: Partial<MemorySliderValue>,
): MemorySliderValue => {
  const next = { ...current, ...updates };
  return {
    ...next,
    minMemory: Math.min(Math.max(next.minMemory || MIN_MEMORY_MB, MIN_MEMORY_MB), next.maxMemory),
  };
};

export const MemorySlider: React.FC<MemorySliderProps> = ({
  value,
  onChange,
  disabled,
  onArrowPress,
}) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<SystemMemoryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchMemory = async () => {
      try {
        const result = await invoke<SystemMemoryStats>('get_system_memory');
        if (!cancelled) {
          setStats(result);
        }
      } catch (error) {
        console.error('Failed to read system memory stats:', error);
        if (!cancelled) {
          setStats({ total: 8192, available: 4096 });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchMemory();

    return () => {
      cancelled = true;
    };
  }, []);

  const plan = useMemo(() => {
    if (!stats) {
      return null;
    }

    return resolveMemoryAllocationPlan(stats, {
      mode: value.memoryAllocationMode,
      requestedMaxMemory: value.maxMemory,
      requestedMinMemory: value.minMemory,
    });
  }, [stats, value.maxMemory, value.memoryAllocationMode, value.minMemory]);

  const modeOptions = useMemo(
    () => [
      { label: t('settings.java.memoryModes.auto'), value: 'auto' },
      { label: t('settings.java.memoryModes.manual'), value: 'manual' },
      { label: t('settings.java.memoryModes.force'), value: 'force' },
    ],
    [t],
  );

  const modeDescription = useMemo(() => {
    return t(`settings.java.memoryModeDescriptions.${value.memoryAllocationMode}`);
  }, [t, value.memoryAllocationMode]);

  if (loading || !plan) {
    return (
      <div className="flex items-center gap-2 font-minecraft text-ore-text-muted">
        <Loader2 size={16} className="animate-spin" />
        <span>{t('settings.java.memoryLoading')}</span>
      </div>
    );
  }

  const isAutoMode = value.memoryAllocationMode === 'auto';
  const modeIsForce = value.memoryAllocationMode === 'force';
  const targetMemory = isAutoMode ? plan.effectiveMaxMemory : plan.requestedMaxMemory;
  const statusColor =
    plan.pressureLevel === 'danger'
      ? 'text-red-400'
      : plan.pressureLevel === 'warning'
        ? 'text-yellow-400'
        : 'text-ore-green';
  const fillColor =
    plan.pressureLevel === 'danger'
      ? 'bg-red-500'
      : plan.pressureLevel === 'warning'
        ? 'bg-yellow-500'
        : 'bg-ore-green';
  const thumbColor =
    plan.pressureLevel === 'danger'
      ? 'bg-red-500'
      : plan.pressureLevel === 'warning'
        ? 'bg-yellow-500'
        : 'bg-ore-green';

  return (
    <div className="flex w-full max-w-[36rem] flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-[13rem_minmax(0,1fr)] md:items-start">
        <div className="w-full [&>button]:w-full [&>div]:w-full">
          <OreDropdown
            focusKey="java-memory-mode"
            onArrowPress={onArrowPress}
            options={modeOptions}
            value={value.memoryAllocationMode}
            onChange={(nextMode) =>
              onChange(
                buildNextValue(value, {
                  memoryAllocationMode: nextMode as MemoryAllocationMode,
                }),
              )
            }
            disabled={disabled}
          />
        </div>

        <div className="rounded-sm border border-white/8 bg-black/30 px-3 py-2">
          <div className="mb-1 flex items-center gap-2 text-sm font-minecraft text-white">
            <Gauge size={14} className="text-ore-green" />
            {t('settings.java.memoryMode')}
          </div>
          <p className="text-xs leading-relaxed text-ore-text-muted">{modeDescription}</p>
        </div>
      </div>

      <div className="rounded-sm border-2 border-[#1E1E1F] bg-[#141415] p-4 shadow-inner">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-1 text-xs font-minecraft text-ore-text-muted">
              {t('settings.java.memoryEffective')}
            </div>
            <div className={`font-minecraft text-3xl transition-colors ${statusColor}`}>
              {formatMemoryGb(plan.effectiveMaxMemory)}
            </div>
            <div className="mt-2 text-xs font-minecraft text-[#B1B2B5]">
              Xms {formatMemoryGb(plan.effectiveMinMemory)} / Xmx {formatMemoryGb(plan.effectiveMaxMemory)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs font-minecraft text-ore-text-muted">
            <span>{t('settings.java.memoryTarget')}</span>
            <span className="text-right text-white">{formatMemoryGb(targetMemory)}</span>
            <span>{t('settings.java.memoryRecommended')}</span>
            <span className="text-right text-ore-green">{formatMemoryGb(plan.recommended)}</span>
            <span>{t('settings.java.memorySafeLimit')}</span>
            <span className="text-right text-white">{formatMemoryGb(plan.safeLimit)}</span>
            <span>{t('settings.java.memoryHardLimit')}</span>
            <span className="text-right text-white">{formatMemoryGb(plan.hardLimit)}</span>
            <span>{t('settings.java.memoryAvailable')}</span>
            <span className="text-right text-white">{formatMemoryGb(plan.available)}</span>
            <span>{t('settings.java.memoryTotal')}</span>
            <span className="text-right text-white">{formatMemoryGb(plan.total)}</span>
            <span>{t('settings.java.memoryProfile')}</span>
            <span className="text-right text-white">
              {t(`settings.java.memoryProfiles.${plan.profile}`)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <OreSlider
            focusKey="java-slider-memory"
            onArrowPress={onArrowPress}
            value={plan.requestedMaxMemory}
            min={MIN_MEMORY_MB}
            max={plan.sliderMax}
            step={512}
            onChange={(nextMaxMemory) =>
              onChange(
                buildNextValue(value, {
                  maxMemory: nextMaxMemory,
                }),
              )
            }
            disabled={disabled || isAutoMode}
            fillColorClass={fillColor}
            thumbColorClass={thumbColor}
          />
        </div>

        <OreButton
          focusKey="java-btn-recommend"
          onArrowPress={onArrowPress}
          size="sm"
          variant="secondary"
          onClick={() =>
            onChange(
              buildNextValue(value, {
                maxMemory: plan.recommended,
              }),
            )
          }
          disabled={disabled || isAutoMode || plan.requestedMaxMemory === plan.recommended}
        >
          <Zap size={15} className="mr-1.5" />
          {t('settings.java.memoryApplyRecommended')}
        </OreButton>
      </div>

      <AnimatePresence mode="wait">
        {!disabled && plan.hardLimited ? (
          <motion.div
            key="hard-limit"
            initial={OreMotionTokens.collapseInitial}
            animate={OreMotionTokens.collapseAnimate}
            exit={OreMotionTokens.collapseExit}
            className="rounded-sm border-l-2 border-red-500 bg-[#2a1717] p-3 text-xs leading-relaxed text-red-400 shadow-sm"
          >
            <div className="mb-1 flex items-center gap-2 font-minecraft text-sm text-red-300">
              <ShieldAlert size={14} />
              {t('settings.java.memoryWarnings.hardLimitTitle')}
            </div>
            <p className="font-minecraft">
              {t('settings.java.memoryWarnings.hardLimitBody', {
                requested: formatMemoryGb(plan.requestedMaxMemory),
                effective: formatMemoryGb(plan.effectiveMaxMemory),
                limit: formatMemoryGb(plan.hardLimit),
              })}
            </p>
          </motion.div>
        ) : !disabled && plan.safeLimited ? (
          <motion.div
            key="safe-limit"
            initial={OreMotionTokens.collapseInitial}
            animate={OreMotionTokens.collapseAnimate}
            exit={OreMotionTokens.collapseExit}
            className="rounded-sm border-l-2 border-yellow-500 bg-yellow-500/10 p-3 text-xs leading-relaxed text-yellow-300 shadow-sm"
          >
            <div className="mb-1 flex items-center gap-2 font-minecraft text-sm text-yellow-200">
              <ShieldAlert size={14} />
              {t('settings.java.memoryWarnings.safeLimitTitle')}
            </div>
            <p className="font-minecraft">
              {t('settings.java.memoryWarnings.safeLimitBody', {
                requested: formatMemoryGb(plan.requestedMaxMemory),
                effective: formatMemoryGb(plan.effectiveMaxMemory),
                limit: formatMemoryGb(plan.safeLimit),
              })}
            </p>
          </motion.div>
        ) : !disabled && modeIsForce ? (
          <motion.div
            key="force-mode"
            initial={OreMotionTokens.collapseInitial}
            animate={OreMotionTokens.collapseAnimate}
            exit={OreMotionTokens.collapseExit}
            className="rounded-sm border-l-2 border-orange-500 bg-orange-500/10 p-3 text-xs leading-relaxed text-orange-200 shadow-sm"
          >
            <p className="font-minecraft">
              {t('settings.java.memoryWarnings.forceModeBody', {
                limit: formatMemoryGb(plan.hardLimit),
              })}
            </p>
          </motion.div>
        ) : !disabled && isAutoMode ? (
          <motion.div
            key="auto-mode"
            initial={OreMotionTokens.collapseInitial}
            animate={OreMotionTokens.collapseAnimate}
            exit={OreMotionTokens.collapseExit}
            className="rounded-sm border-l-2 border-ore-green bg-ore-green/10 p-3 text-xs leading-relaxed text-ore-green shadow-sm"
          >
            <p className="font-minecraft">
              {t('settings.java.memoryWarnings.autoModeBody', {
                recommended: formatMemoryGb(plan.recommended),
                safeLimit: formatMemoryGb(plan.safeLimit),
                effective: formatMemoryGb(plan.effectiveMaxMemory),
              })}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
