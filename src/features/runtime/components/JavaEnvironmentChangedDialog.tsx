import React from 'react';
import { AlertTriangle } from 'lucide-react';

import { OreConfirmDialog } from '../../../ui/primitives/OreConfirmDialog';

export const JavaEnvironmentChangedDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  return (
    <OreConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onClose}
      title="Java 环境变更"
      headline="检测到 Java 环境有变更"
      description="启动器在本次启动时检测到 Java 路径与上次记录不一致，请检查 Java 设置中的版本路径映射是否仍然正确。"
      confirmationNote="建议前往 设置 > Java，确认 Java 8 / 16 / 17 / 21 / 25 对应路径。"
      confirmationNoteTone="warning"
      tone="warning"
      confirmLabel="知道了"
      cancelLabel="关闭"
      confirmVariant="primary"
      confirmFocusKey="startup-java-changed-confirm"
      cancelFocusKey="startup-java-changed-cancel"
      dialogIcon={<AlertTriangle size={28} className="text-yellow-400" />}
    />
  );
};
