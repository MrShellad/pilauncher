import React from 'react';
import { AlertTriangle, TerminalSquare } from 'lucide-react';
import type { PiHubLogEntry } from '../../types';

interface LogViewerProps {
  logs: PiHubLogEntry[];
  lastError: string | null;
}

const formatLogTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(value));

export const LogViewer: React.FC<LogViewerProps> = ({ logs, lastError }) => {
  return (
    <div className="ore-multiplayer-card flex-1 min-h-0">
      <div className="ore-multiplayer-card-heading">
        <div>
          <h3 className="ore-multiplayer-card-title">
            <span className="inline-flex items-center gap-2">
              <TerminalSquare size={18} />
              实时日志
            </span>
          </h3>
        </div>
      </div>

      <div className="ore-multiplayer-log-list">
        {lastError && (
          <div className="ore-multiplayer-log-entry bg-[#c33636]/10 border-l-[3px] border-[#c33636] p-3 mb-2 shrink-0">
            <div className="flex items-center gap-2 text-[#ff6b6b] font-bold text-sm mb-1">
              <AlertTriangle size={16} />
              发生错误
            </div>
            <div className="text-[#ffb3b3] text-[13px] leading-relaxed break-all font-mono">{lastError}</div>
          </div>
        )}
        
        {logs.length === 0 && !lastError ? (
          <div className="ore-multiplayer-empty-state">
            <TerminalSquare size={24} />
            <div>PiHub 启动后，日志会实时显示在这里。</div>
          </div>
        ) : (
          logs
            .slice()
            .reverse()
            .map((log) => (
              <div key={log.id} className="ore-multiplayer-log-entry" data-level={log.level}>
                <div className="ore-multiplayer-log-meta">
                  <span className="ore-multiplayer-log-level">{log.level}</span>
                  <span>{formatLogTime(log.timestamp)}</span>
                </div>
                <div className="ore-multiplayer-log-message">{log.message}</div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};
