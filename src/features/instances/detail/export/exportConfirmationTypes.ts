export type ExportStatus = 'idle' | 'exporting' | 'success' | 'error';

export interface ExportProgress {
  taskId: string;
  current: number;
  total: number;
  message: string;
  stage: string;
}

export interface ExportResult {
  outputPath: string;
  packedFiles: number;
  referencedModFiles: number;
  bundledModFiles: number;
  warnings: string[];
}

export const getExportPathBasename = (path: string) => path.split(/[/\\]/).pop() || path;
