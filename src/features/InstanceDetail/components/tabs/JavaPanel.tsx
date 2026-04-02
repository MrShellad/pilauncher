import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { FocusItem } from '../../../../ui/focus/FocusItem';
import { focusManager } from '../../../../ui/focus/FocusManager';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { RuntimeSettingsForm } from '../../../runtime/components/RuntimeSettingsForm';
import type { RuntimeConfig } from '../../../runtime/types';

interface RawInstanceDetail {
  game_version?: string;
  gameVersion?: string;
  mcVersion?: string;
  mc_version?: string;
  version?: string;
}

export const JavaPanel: React.FC<{ instanceId: string; isActive?: boolean }> = ({
  instanceId,
  isActive = false
}) => {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [mcVersion, setMcVersion] = useState('');
  const [recommendedJavaMajor, setRecommendedJavaMajor] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const [runtimeConfig, detail] = await Promise.all([
          invoke<RuntimeConfig>('get_instance_runtime', { id: instanceId }),
          invoke<RawInstanceDetail>('get_instance_detail', { id: instanceId }).catch(() => null)
        ]);
        setConfig(runtimeConfig);

        const resolvedMcVersion =
          detail?.game_version ||
          detail?.gameVersion ||
          detail?.mcVersion ||
          detail?.mc_version ||
          detail?.version ||
          '';
        setMcVersion(resolvedMcVersion);

        if (resolvedMcVersion) {
          const major = await invoke<string>('get_required_java_major', {
            mcVersion: resolvedMcVersion
          }).catch(() => '');
          setRecommendedJavaMajor(major || '');
        } else {
          setRecommendedJavaMajor('');
        }
      } catch (error) {
        console.error(`读取实例 ${instanceId} 运行时配置失败:`, error);
      }
    };
    void loadConfig();
  }, [instanceId]);

  useEffect(() => {
    if (!isActive || !config) return;
    const timer = setTimeout(() => {
      focusManager.restoreFocus('tab-boundary-java', 'java-entry-point');
    }, 80);
    return () => clearTimeout(timer);
  }, [isActive, config]);

  const handleConfigChange = async (newConfig: RuntimeConfig) => {
    setConfig(newConfig);
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await invoke('save_instance_runtime', { id: instanceId, config: newConfig });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error(`保存实例 ${instanceId} 运行时配置失败:`, error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!config) {
    return (
      <FocusItem focusKey="java-entry-point">
        {({ ref, focused }) => (
          <div
            ref={ref as any}
            className={`w-full h-full flex items-center justify-center text-ore-green font-minecraft outline-none ${
              focused ? 'ring-2 ring-white/50 rounded-lg scale-105 transition-all' : ''
            }`}
          >
            <Loader2 size={32} className="animate-spin" />
          </div>
        )}
      </FocusItem>
    );
  }

  return (
    <SettingsPageLayout>
      <div className="relative flex flex-col w-full h-full overflow-x-hidden">
        <FocusItem focusKey="java-guard-top" onFocus={() => setFocus('java-entry-point')}>
          {({ ref }) => (
            <div
              ref={ref as any}
              className="absolute top-0 left-0 w-full h-[1px] opacity-0 pointer-events-none"
              tabIndex={-1}
            />
          )}
        </FocusItem>
        <FocusItem focusKey="java-guard-left" onFocus={() => setFocus('java-entry-point')}>
          {({ ref }) => (
            <div
              ref={ref as any}
              className="absolute top-0 left-0 w-[1px] h-full opacity-0 pointer-events-none"
              tabIndex={-1}
            />
          )}
        </FocusItem>
        <FocusItem focusKey="java-guard-right" onFocus={() => setFocus('java-entry-point')}>
          {({ ref }) => (
            <div
              ref={ref as any}
              className="absolute top-0 right-0 w-[1px] h-full opacity-0 pointer-events-none"
              tabIndex={-1}
            />
          )}
        </FocusItem>
        <FocusItem focusKey="java-guard-bottom" onFocus={() => setFocus('java-entry-point')}>
          {({ ref }) => (
            <div
              ref={ref as any}
              className="absolute bottom-0 left-0 w-full h-[1px] opacity-0 pointer-events-none"
              tabIndex={-1}
            />
          )}
        </FocusItem>

        <div className="flex justify-end h-6 mb-2 pr-6 font-minecraft transition-opacity duration-300">
          {isSaving && (
            <span className="text-ore-text-muted text-sm flex items-center">
              <Loader2 size={14} className="animate-spin mr-1.5" /> 正在保存到本地...
            </span>
          )}
          {saveSuccess && !isSaving && (
            <span className="text-ore-green text-sm flex items-center drop-shadow-[0_0_5px_rgba(56,133,39,0.5)]">
              <CheckCircle2 size={14} className="mr-1.5" /> 自动保存成功
            </span>
          )}
        </div>

        <RuntimeSettingsForm
          mode="instance"
          config={config}
          onChange={handleConfigChange}
          mcVersion={mcVersion}
          recommendedJavaMajor={recommendedJavaMajor}
        />
      </div>
    </SettingsPageLayout>
  );
};
