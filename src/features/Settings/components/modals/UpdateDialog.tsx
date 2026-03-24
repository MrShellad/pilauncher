// src/features/Settings/components/modals/UpdateDialog.tsx
import React from 'react';
import { Loader2, Download, Bell, Sparkles } from 'lucide-react';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../ui/primitives/OreButton';

export interface UpdateInfo {
  available: boolean;
  version: string;
  body: string;
  url: string;
  signature: string;
}

interface UpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo | null;
  isInstalling: boolean;
  onConfirm: () => void;
}

const INSTALL_FOCUS_KEY = 'update-dialog-install';
const LATER_FOCUS_KEY = 'update-dialog-later';

export const UpdateDialog: React.FC<UpdateDialogProps> = ({
  isOpen,
  onClose,
  updateInfo,
  isInstalling,
  onConfirm,
}) => {
  if (!updateInfo) return null;

  // 解析 Markdown-like changelog —— 简单渲染，无需外部依赖
  const renderChangelog = (body: string) => {
    if (!body) {
      return (
        <p className="text-ore-text-muted text-sm font-minecraft">
          暂无更新日志。
        </p>
      );
    }

    const lines = body.split('\n');
    return (
      <div className="space-y-1">
        {lines.map((line, i) => {
          if (line.startsWith('### ')) {
            return (
              <h3 key={i} className="text-white font-minecraft text-sm font-bold mt-3 mb-1 first:mt-0">
                {line.replace('### ', '')}
              </h3>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h2 key={i} className="text-ore-green font-minecraft text-base font-bold mt-3 mb-1 first:mt-0">
                {line.replace('## ', '')}
              </h2>
            );
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <div key={i} className="flex items-start gap-2 text-ore-text-muted text-sm font-minecraft">
                <span className="text-ore-green mt-0.5 flex-shrink-0">▸</span>
                <span>{line.replace(/^[-*] /, '')}</span>
              </div>
            );
          }
          if (line.trim() === '') {
            return <div key={i} className="h-1" />;
          }
          return (
            <p key={i} className="text-ore-text-muted text-sm font-minecraft">
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title="发现新版本"
      className="w-[520px]"
      defaultFocusKey={INSTALL_FOCUS_KEY}
      closeOnOutsideClick={!isInstalling}
      actions={
        <div className="flex items-center gap-3 w-full">
          <OreButton
            focusKey={LATER_FOCUS_KEY}
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isInstalling}
            className="flex items-center gap-1.5"
          >
            <Bell size={14} />
            稍后提醒
          </OreButton>

          <OreButton
            focusKey={INSTALL_FOCUS_KEY}
            variant="primary"
            size="sm"
            onClick={onConfirm}
            disabled={isInstalling}
            className="flex-1 flex items-center justify-center gap-1.5"
          >
            {isInstalling ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                正在下载并安装...
              </>
            ) : (
              <>
                <Download size={14} />
                立即更新
              </>
            )}
          </OreButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* 版本号徽章 */}
        <div className="flex items-center gap-3 p-4 bg-ore-green/10 border border-ore-green/20 rounded-sm">
          <div className="flex-shrink-0 w-10 h-10 rounded-sm bg-ore-green/20 flex items-center justify-center">
            <Sparkles size={20} className="text-ore-green" />
          </div>
          <div>
            <p className="text-xs text-ore-text-muted font-minecraft mb-0.5">最新版本</p>
            <p className="text-ore-green font-minecraft text-xl font-bold tracking-wider">
              v{updateInfo.version}
            </p>
          </div>
        </div>

        {/* 更新日志 */}
        <div>
          <p className="text-xs text-ore-text-muted font-minecraft mb-2 uppercase tracking-wider">
            更新日志
          </p>
          <div className="max-h-56 overflow-y-auto custom-scrollbar bg-black/30 border border-white/5 rounded-sm p-4">
            {renderChangelog(updateInfo.body)}
          </div>
        </div>

        {/* 提示文字 */}
        <p className="text-xs text-ore-text-muted font-minecraft text-center leading-relaxed">
          点击「立即更新」将自动下载并安装，安装完成后启动器会自动重启。
        </p>
      </div>
    </OreModal>
  );
};
