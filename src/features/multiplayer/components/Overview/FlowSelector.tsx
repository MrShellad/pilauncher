import React from 'react';
import { ArrowRight, Server, Users } from 'lucide-react';
import type { SessionFlow } from '../../hooks/useMultiplayerViewModel';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';

interface FlowSelectorProps {
  onSelect: (flow: SessionFlow) => void;
}

const FOCUS_ORDER = ['flow-host', 'flow-client'];

export const FlowSelector: React.FC<FlowSelectorProps> = ({ onSelect }) => {
  const { handleLinearArrow } = useLinearNavigation(FOCUS_ORDER, 'flow-host');

  return (
    <div className="ore-multiplayer-mode-grid">
      <FocusItem focusKey="flow-host" onArrowPress={handleLinearArrow} onEnter={() => onSelect('host')}>
        {({ ref, focused }) => (
          <button
            ref={ref as React.RefObject<HTMLButtonElement>}
            type="button"
            className={`ore-multiplayer-mode-card ${focused ? 'outline outline-[3px] outline-offset-[2px] outline-white' : ''}`}
            data-tone="host"
            onClick={() => onSelect('host')}
            tabIndex={-1}
          >
            <div className="ore-multiplayer-mode-topline">
              <span className="ore-multiplayer-mode-kicker">Host Flow</span>
              <span className="ore-multiplayer-mode-pill">创建邀请码</span>
            </div>

            <div className="ore-multiplayer-mode-head">
              <span className="ore-multiplayer-mode-icon"><Server size={22} /></span>
              <div className="ore-multiplayer-mode-body">
                <h3 className="ore-multiplayer-mode-title">我要开房</h3>
                <p className="ore-multiplayer-mode-copy">把本地世界分享给朋友，由你来做房主。</p>
              </div>
              <span className="ore-multiplayer-mode-arrow">
                <ArrowRight size={18} />
              </span>
            </div>

            <div className="ore-multiplayer-mode-tags">
              {['本地服务端', '创建邀请码', '导入应答码'].map((tag) => (
                <span key={tag} className="ore-multiplayer-mode-tag">{tag}</span>
              ))}
            </div>

            <div className="ore-multiplayer-mode-cta">进入开房流程</div>
          </button>
        )}
      </FocusItem>

      <FocusItem focusKey="flow-client" onArrowPress={handleLinearArrow} onEnter={() => onSelect('client')}>
        {({ ref, focused }) => (
          <button
            ref={ref as React.RefObject<HTMLButtonElement>}
            type="button"
            className={`ore-multiplayer-mode-card ${focused ? 'outline outline-[3px] outline-offset-[2px] outline-white' : ''}`}
            data-tone="client"
            onClick={() => onSelect('client')}
            tabIndex={-1}
          >
            <div className="ore-multiplayer-mode-topline">
              <span className="ore-multiplayer-mode-kicker">Join Flow</span>
              <span className="ore-multiplayer-mode-pill">填写邀请码</span>
            </div>

            <div className="ore-multiplayer-mode-head">
              <span className="ore-multiplayer-mode-icon"><Users size={22} /></span>
              <div className="ore-multiplayer-mode-body">
                <h3 className="ore-multiplayer-mode-title">我要加入房间</h3>
                <p className="ore-multiplayer-mode-copy">拿到邀请码后，在本地建立一个可直连的代理端口。</p>
              </div>
              <span className="ore-multiplayer-mode-arrow">
                <ArrowRight size={18} />
              </span>
            </div>

            <div className="ore-multiplayer-mode-tags">
              {['填写邀请码', '返回应答码', '连接本机端口'].map((tag) => (
                <span key={tag} className="ore-multiplayer-mode-tag">{tag}</span>
              ))}
            </div>

            <div className="ore-multiplayer-mode-cta">进入加入流程</div>
          </button>
        )}
      </FocusItem>
    </div>
  );
};
