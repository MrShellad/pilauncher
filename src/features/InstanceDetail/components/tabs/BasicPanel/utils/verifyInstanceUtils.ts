import type {
  VerifyDialogState,
  VerifyInstanceRuntimeResult,
  VerifyProgress,
} from '../schemas/basicPanelSchemas';

export const createInitialVerifyProgress = (): VerifyProgress => ({
  current: 0,
  total: 1,
  message: '',
});

export const createPreparingVerifyProgress = (): VerifyProgress => ({
  current: 0,
  total: 1,
  message: '正在准备校验...',
});

export const normalizeVerifyProgress = (
  current?: number,
  total?: number,
  message?: string,
): VerifyProgress => ({
  current: current ?? 0,
  total: Math.max(total ?? 1, 1),
  message: message || '正在校验文件...',
});

export const canCloseVerifyState = (state: VerifyDialogState) =>
  state !== 'verifying' && state !== 'repairing';

export const isVerifyStateBusy = (state: VerifyDialogState) =>
  state === 'verifying' || state === 'repairing';

export const getVerifyPercent = (progress: VerifyProgress) =>
  Math.max(0, Math.min(100, Math.round((progress.current / Math.max(progress.total, 1)) * 100)));

export const getVerifyIssues = (result: VerifyInstanceRuntimeResult | null) => result?.issues ?? [];
