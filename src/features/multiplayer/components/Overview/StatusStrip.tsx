import React from 'react';
import type { PiHubTunnelInfo } from '../../types';
import type { SessionFlow } from '../../hooks/useMultiplayerViewModel';

interface StatusStripProps {
  lifecycle: string;
  busyLabel: string | null;
  peerConnectionState: string | null;
  tunnelInfo: PiHubTunnelInfo | null;
  localProxyPort: number | null;
  role: string | null;
  selectedFlow: SessionFlow | null;
}

const resolvePeerTone = (state: string | null) => {
  if (!state) return undefined;
  if (state === 'connected') return 'accent';
  if (state === 'connecting' || state === 'new') return 'warning';
  if (state === 'failed' || state === 'closed' || state === 'disconnected') return 'danger';
  return undefined;
};

export const StatusStrip: React.FC<StatusStripProps> = ({
  lifecycle,
  busyLabel,
  peerConnectionState,
  tunnelInfo,
  localProxyPort,
  role,
  selectedFlow
}) => {
  const currentRoleLabel =
    role === 'host'
      ? '房主'
      : role === 'client'
        ? '加入者'
        : selectedFlow === 'host'
          ? '待开房'
          : selectedFlow === 'client'
            ? '待加入'
            : '未分配';

  return (
    <div className="ore-multiplayer-status-strip">
      <div className="ore-multiplayer-stat">
        <span className="ore-multiplayer-stat-label">PiHub 状态</span>
        <span
          className="ore-multiplayer-stat-value"
          data-tone={
            lifecycle === 'ready'
              ? 'accent'
              : lifecycle === 'starting'
                ? 'warning'
                : lifecycle === 'error'
                  ? 'danger'
                  : undefined
          }
        >
          {busyLabel ||
            {
              idle: '未启动',
              starting: '启动中',
              ready: '已就绪',
              stopped: '已停止',
              error: '启动失败'
            }[lifecycle as string]}
        </span>
      </div>

      <div className="ore-multiplayer-stat">
        <span className="ore-multiplayer-stat-label">当前角色</span>
        <span className="ore-multiplayer-stat-value">{currentRoleLabel}</span>
      </div>

      <div className="ore-multiplayer-stat">
        <span className="ore-multiplayer-stat-label">直连状态</span>
        <span className="ore-multiplayer-stat-value" data-tone={resolvePeerTone(peerConnectionState)}>
          {peerConnectionState || '等待连接'}
        </span>
      </div>

      <div className="ore-multiplayer-stat">
        <span className="ore-multiplayer-stat-label">本地代理端口</span>
        <span className="ore-multiplayer-stat-value" data-tone={tunnelInfo ? 'accent' : undefined}>
          {tunnelInfo
            ? `127.0.0.1:${tunnelInfo.proxyPort}`
            : localProxyPort
              ? `127.0.0.1:${localProxyPort}`
              : '尚未分配'}
        </span>
      </div>
    </div>
  );
};
