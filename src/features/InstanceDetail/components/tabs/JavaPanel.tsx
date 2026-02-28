// src/features/InstanceDetail/components/tabs/JavaPanel.tsx
import React, { useState, useEffect } from 'react';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { RuntimeSettingsForm } from '../../../runtime/components/RuntimeSettingsForm';
import type { RuntimeConfig } from '../../../runtime/types';

export const JavaPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const [config, setConfig] = useState<RuntimeConfig>({
    useGlobalJava: true,     // ✅ 拆分了开关
    useGlobalMemory: true,   // ✅ 拆分了开关
    javaPath: '',
    maxMemory: 4096,
    minMemory: 1024,
    jvmArgs: '-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions',
  });

  useEffect(() => {
    // TODO: 从后端读取配置
  }, [instanceId]);

  return (
    <SettingsPageLayout title="Java 与内存" subtitle="Java & Memory">
      <RuntimeSettingsForm mode="instance" config={config} onChange={setConfig} />
    </SettingsPageLayout>
  );
};