import React from 'react';
import { ArrowRight, Server, Users } from 'lucide-react';
import type { SessionFlow } from '../../hooks/useMultiplayerViewModel';

interface FlowSelectorProps {
  onSelect: (flow: SessionFlow) => void;
}

const renderModeCard = (
  flow: SessionFlow,
  kicker: string,
  title: string,
  summary: string,
  icon: React.ReactNode,
  tags: string[],
  cta: string,
  onSelect: (flow: SessionFlow) => void
) => (
  <button
    type="button"
    className="ore-multiplayer-mode-card"
    data-tone={flow}
    onClick={() => onSelect(flow)}
  >
    <div className="ore-multiplayer-mode-topline">
      <span className="ore-multiplayer-mode-kicker">{kicker}</span>
      <span className="ore-multiplayer-mode-pill">{flow === 'host' ? '创建邀请码' : '填写邀请码'}</span>
    </div>

    <div className="ore-multiplayer-mode-head">
      <span className="ore-multiplayer-mode-icon">{icon}</span>
      <div className="ore-multiplayer-mode-body">
        <h3 className="ore-multiplayer-mode-title">{title}</h3>
        <p className="ore-multiplayer-mode-copy">{summary}</p>
      </div>
      <span className="ore-multiplayer-mode-arrow">
        <ArrowRight size={18} />
      </span>
    </div>

    <div className="ore-multiplayer-mode-tags">
      {tags.map((tag) => (
        <span key={tag} className="ore-multiplayer-mode-tag">
          {tag}
        </span>
      ))}
    </div>

    <div className="ore-multiplayer-mode-cta">{cta}</div>
  </button>
);

export const FlowSelector: React.FC<FlowSelectorProps> = ({ onSelect }) => {
  return (
    <div className="ore-multiplayer-mode-grid">
      {renderModeCard(
        'host',
        'Host Flow',
        '我要开房',
        '把本地世界分享给朋友，由你来做房主。',
        <Server size={22} />,
        ['本地服务端', '创建邀请码', '导入应答码'],
        '进入开房流程',
        onSelect
      )}
      {renderModeCard(
        'client',
        'Join Flow',
        '我要加入房间',
        '拿到邀请码后，在本地建立一个可直连的代理端口。',
        <Users size={22} />,
        ['填写邀请码', '返回应答码', '连接本机端口'],
        '进入加入流程',
        onSelect
      )}
    </div>
  );
};
