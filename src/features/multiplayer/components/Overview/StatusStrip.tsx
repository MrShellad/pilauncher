import React from 'react';


interface StatusStripProps {
  lifecycle: string;
  busyLabel: string | null;
  peerConnectionState: string | null;
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
}) => {
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
        <span className="ore-multiplayer-stat-label">直连状态</span>
        <span className="ore-multiplayer-stat-value" data-tone={resolvePeerTone(peerConnectionState)}>
          {peerConnectionState || '等待连接'}
        </span>
      </div>
    </div>
  );
};
