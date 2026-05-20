import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

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

export const useJavaRuntimeTestDialog = () => {
  const { t } = useTranslation();
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [dialog, setDialog] = useState<JavaTestDialogState>(() => ({
    isOpen: false,
    tone: 'info',
    title: t('settings.java.testDialog.title'),
    headline: '',
    description: '',
    detail: ''
  }));

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
          title: t('settings.java.testDialog.title'),
          headline: t('settings.java.testDialog.missingPathHeadline', { target: params.label }),
          description: t('settings.java.testDialog.missingPathDesc'),
          detail: ''
        });
        return;
      }

      setTestingKey(params.key);
      try {
        const result = await testJavaRuntime(path);
        openDialog({
          tone: 'info',
          title: t('settings.java.testDialog.successTitle'),
          headline: t('settings.java.testDialog.successHeadline', { target: params.label }),
          description: t('settings.java.testDialog.successDesc', { version: result.version }),
          detail: t('settings.java.testDialog.pathLabel', { path: result.path })
        });
      } catch (error: any) {
        openDialog({
          tone: 'danger',
          title: t('settings.java.testDialog.failedTitle'),
          headline: t('settings.java.testDialog.failedHeadline', { target: params.label }),
          description: t('settings.java.testDialog.failedDesc'),
          detail: String(error)
        });
      } finally {
        setTestingKey(null);
      }
    },
    [openDialog, t]
  );

  return {
    testingKey,
    dialog,
    closeDialog,
    runJavaTest
  };
};
