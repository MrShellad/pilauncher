// src/features/Settings/components/modals/OfflineAuthModal.tsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../ui/primitives/OreInput';

interface OfflineAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  offlineForm: { name: string; isEdit: boolean; oldUuid: string };
  setOfflineForm: React.Dispatch<React.SetStateAction<{ name: string; isEdit: boolean; oldUuid: string }>>;
  offlineError: string;
  handleSaveOffline: () => void;
}

export const OfflineAuthModal: React.FC<OfflineAuthModalProps> = ({
  isOpen, 
  onClose, 
  offlineForm, 
  setOfflineForm, 
  offlineError, 
  handleSaveOffline
}) => {
  return (
    <OreModal isOpen={isOpen} onClose={onClose} title={offlineForm.isEdit ? "配置离线账号" : "创建离线账号"}>
      <div className="flex flex-col p-6 sm:p-8">
        <label className="text-sm text-ore-text-muted font-bold tracking-wider mb-2">玩家名称 (ID)</label>
        <OreInput 
          focusKey="input-offline-name"
          value={offlineForm.name} 
          onChange={(e) => setOfflineForm({ ...offlineForm, name: e.target.value })} 
          placeholder="例如: Steve_123" 
          className="font-minecraft text-lg mb-2"
          maxLength={16}
        />
        <div className="text-xs text-gray-500 font-minecraft mb-6">
          规则：长度 3~16 位，只允许英文字母、数字及下划线。
        </div>

        {offlineForm.isEdit && (
          <div className="bg-yellow-500/10 border-[2px] border-yellow-500/50 p-4 flex items-start mb-6 rounded-sm">
            <AlertTriangle size={18} className="text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-500/90 leading-relaxed font-minecraft">
              <strong className="text-yellow-400">警告：</strong> 修改名称会导致联机 UUID 强制变更。<br/>
              您的单机世界存档和离线服务器将会把您识别为一个<strong className="text-yellow-400">全新的玩家</strong>，旧角色的物品栏和进度将无法直接继承！
            </p>
          </div>
        )}

        {offlineError && <div className="text-red-400 text-xs font-minecraft mb-4">{offlineError}</div>}

        <div className="flex justify-end space-x-3 mt-4">
          <OreButton focusKey="btn-offline-cancel" variant="secondary" onClick={onClose}>取消</OreButton>
          <OreButton focusKey="btn-offline-confirm" variant="primary" onClick={handleSaveOffline}>{offlineForm.isEdit ? '确认修改' : '确认创建'}</OreButton>
        </div>
      </div>
    </OreModal>
  );
};