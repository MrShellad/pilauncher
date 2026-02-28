// src/features/InstanceDetail/components/tabs/JavaPanel.tsx
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { RuntimeSettingsForm } from '../../../runtime/components/RuntimeSettingsForm';
import type { RuntimeConfig } from '../../../runtime/types';
import { Loader2, CheckCircle2 } from 'lucide-react';

export const JavaPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  
  // 用于 UI 的保存状态反馈
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 初始化：从 Rust 后端读取真实的 instance.json
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await invoke<RuntimeConfig>('get_instance_runtime', { id: instanceId });
        setConfig(data);
      } catch (error) {
        console.error(`读取实例 ${instanceId} 配置失败:`, error);
      }
    };
    loadConfig();
  }, [instanceId]);

  // 修改：用户每次更改表单，自动触发无感保存
  const handleConfigChange = async (newConfig: RuntimeConfig) => {
    setConfig(newConfig); // 乐观更新 UI，保证滑块/开关没有延迟感
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await invoke('save_instance_runtime', { id: instanceId, config: newConfig });
      setSaveSuccess(true);
      // 2秒后清除“已保存”的绿字提示
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error(`保存实例 ${instanceId} 配置失败:`, error);
    } finally {
      setIsSaving(false);
    }
  };

  // 如果数据还没回来，显示一个居中的加载动画
  if (!config) {
    return (
      <div className="w-full h-full flex items-center justify-center text-ore-green font-minecraft">
        <Loader2 size={32} className="animate-spin mb-4" />
      </div>
    );
  }

  return (
    <SettingsPageLayout title="Java 与内存" subtitle="Java & Memory">
      
      {/* 顶部右侧的动态保存状态栏 */}
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

      {/* 核心配置表单 */}
      <RuntimeSettingsForm 
        mode="instance" 
        config={config} 
        onChange={handleConfigChange} 
      />
      
    </SettingsPageLayout>
  );
};