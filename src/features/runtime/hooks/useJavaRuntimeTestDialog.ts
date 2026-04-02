import { useCallback, useState } from 'react';

import { testJavaRuntime } from '../logic/javaDetector';

export type JavaTestTone = 'info' | 'warning' | 'danger';

export interface JavaTestDialogState {
  isOpen: boolean;
  tone: JavaTestTone;
  title: string;
  headline: string;
  description: string;
  detail?: string;
}

const INITIAL_DIALOG_STATE: JavaTestDialogState = {
  isOpen: false,
  tone: 'info',
  title: 'Java 测试',
  headline: '',
  description: '',
  detail: ''
};

export const useJavaRuntimeTestDialog = () => {
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [dialog, setDialog] = useState<JavaTestDialogState>(INITIAL_DIALOG_STATE);

  const closeDialog = useCallback(() => {
    setDialog((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const openDialog = useCallback((payload: Omit<JavaTestDialogState, 'isOpen'>) => {
    setDialog({ ...payload, isOpen: true });
  }, []);

  const runJavaTest = useCallback(
    async (params: { key: string; label: string; javaPath?: string }) => {
      const path = (params.javaPath || '').trim();

      if (!path) {
        openDialog({
          tone: 'warning',
          title: 'Java 测试',
          headline: `${params.label} 未配置路径`,
          description: '请先选择一个可执行的 Java 路径，再进行测试。',
          detail: ''
        });
        return;
      }

      setTestingKey(params.key);
      try {
        const result = await testJavaRuntime(path);
        openDialog({
          tone: 'info',
          title: 'Java 测试通过',
          headline: `${params.label} 可用`,
          description: `版本: ${result.version}`,
          detail: `路径: ${result.path}`
        });
      } catch (error: any) {
        openDialog({
          tone: 'danger',
          title: 'Java 测试失败',
          headline: `${params.label} 不可用`,
          description: '当前路径无法作为 Java 运行时。',
          detail: String(error)
        });
      } finally {
        setTestingKey(null);
      }
    },
    [openDialog]
  );

  return {
    testingKey,
    dialog,
    closeDialog,
    runJavaTest
  };
};
