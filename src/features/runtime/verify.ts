export interface VerifyProgressEventPayload {
  instance_id: string
  stage: string
  current: number
  total: number
  message?: string
}

export type VerifyDialogState =
  | 'idle'
  | 'verifying'
  | 'repair'
  | 'repairing'
  | 'clean'
  | 'queued'
  | 'error'

export interface VerifyProgress {
  current: number
  total: number
  message: string
}

export const getVerifyDialogTone = (verifyState: VerifyDialogState) =>
  verifyState === 'repair' || verifyState === 'repairing'
    ? 'warning'
    : verifyState === 'error'
      ? 'danger'
      : 'info'

export const getVerifyDialogTitle = (verifyState: VerifyDialogState) =>
  verifyState === 'repair'
    ? '校验发现异常'
    : verifyState === 'repairing'
      ? '正在补全文件'
      : verifyState === 'clean'
        ? '校验完成'
        : verifyState === 'queued'
          ? '已加入下载队列'
          : verifyState === 'error'
            ? '校验失败'
            : '正在校验文件'

export const getVerifyDialogHeadline = (verifyState: VerifyDialogState) =>
  verifyState === 'repair'
    ? '检测到文件缺失或哈希不一致。'
    : verifyState === 'repairing'
      ? '正在调用下载管理补全运行时文件。'
      : verifyState === 'clean'
        ? '当前实例运行时文件完整。'
        : verifyState === 'queued'
          ? '补全任务已加入下载管理。'
          : verifyState === 'error'
            ? '校验过程出现错误。'
            : '请稍候，正在逐项校验。'

export const getVerifyDialogDescription = (
  verifyState: VerifyDialogState,
  verifyError: string,
  verifyMessage: string,
) =>
  verifyState === 'repair'
    ? '确认后将自动打开下载管理并开始补全。'
    : verifyState === 'queued'
      ? '你可以在下载管理中查看实时进度。'
      : verifyState === 'error'
        ? verifyError || '未知错误'
        : verifyState === 'clean'
          ? '未发现需要补全的运行时文件。'
          : verifyMessage || '正在校验运行时...'

export const getVerifyConfirmLabel = (verifyState: VerifyDialogState) =>
  verifyState === 'repair'
    ? '开始补全'
    : verifyState === 'repairing'
      ? '补全中'
      : verifyState === 'verifying'
        ? '校验中'
        : '关闭'

export const shouldUseSingleVerifyClose = (verifyState: VerifyDialogState) =>
  verifyState === 'clean'

export const createInitialVerifyProgress = (): VerifyProgress => ({
  current: 0,
  total: 1,
  message: '',
})

export const createPreparingVerifyProgress = (): VerifyProgress => ({
  current: 0,
  total: 1,
  message: '正在准备校验...',
})

export const normalizeVerifyProgress = (
  current?: number,
  total?: number,
  message?: string,
): VerifyProgress => ({
  current: current ?? 0,
  total: Math.max(total ?? 1, 1),
  message: message || '正在校验文件...',
})

export const canCloseVerifyState = (state: VerifyDialogState) =>
  state !== 'verifying' && state !== 'repairing'

export const isVerifyStateBusy = (state: VerifyDialogState) =>
  state === 'verifying' || state === 'repairing'

export const getVerifyPercent = (progress: VerifyProgress) =>
  Math.max(0, Math.min(100, Math.round((progress.current / Math.max(progress.total, 1)) * 100)))

export const getVerifyIssues = (result: { issues?: string[] } | null) => result?.issues ?? []
