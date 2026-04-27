import { invoke } from '@tauri-apps/api/core';

export interface LogShareUploadResult {
  success: boolean;
  message?: string | null;
  id: string;
  url: string;
  raw?: string | null;
  token?: string | null;
}

export interface LogShareHistoryRecord {
  uuid: string;
  logId: string;
  logType: string;
  url: string;
  rawUrl?: string | null;
  token: string;
  createdAt: number;
  expiresAt: number;
}

export interface LogShareReport {
  upload: LogShareUploadResult;
  insights?: unknown | null;
  aiAnalysis?: unknown | null;
  insightsError?: string | null;
  aiAnalysisError?: string | null;
  sanitized: boolean;
  lineCount: number;
  byteCount: number;
  history?: LogShareHistoryRecord | null;
  historyError?: string | null;
}

export interface LogShareOptions {
  sanitize?: boolean;
  includeInsights?: boolean;
  includeAiAnalysis?: boolean;
  logType?: string;
}

export class LogShareError extends Error {
  readonly code: string;

  constructor(message: string, code = 'LOGSHARE_ERROR') {
    super(message);
    this.name = 'LogShareError';
    this.code = code;
  }
}

export class LogShareSDK {
  async paste(content: string, options: Pick<LogShareOptions, 'sanitize'> = {}): Promise<LogShareUploadResult> {
    const report = await this.shareLog(content, {
      sanitize: options.sanitize,
      includeInsights: false,
      includeAiAnalysis: false
    });

    return report.upload;
  }

  async shareLog(content: string, options: LogShareOptions = {}): Promise<LogShareReport> {
    return invoke<LogShareReport>('share_minecraft_log', {
      content,
      sanitize: options.sanitize ?? true,
      includeInsights: options.includeInsights ?? true,
      includeAiAnalysis: options.includeAiAnalysis ?? false,
      logType: options.logType ?? 'game'
    });
  }

  async analyse(content: string, options: Pick<LogShareOptions, 'sanitize'> = {}): Promise<unknown> {
    return invoke('analyse_minecraft_log', {
      content,
      sanitize: options.sanitize ?? true
    });
  }

  async getInsights(id: string): Promise<unknown> {
    return invoke('get_logshare_insights', { id });
  }

  async getAIAnalysis(id: string): Promise<unknown> {
    return invoke('get_logshare_ai_analysis', { id });
  }

  async getRaw(id: string): Promise<string> {
    return invoke('get_logshare_raw', { id });
  }
}

export const mclogsService = new LogShareSDK();

export default LogShareSDK;
