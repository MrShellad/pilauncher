// /src/features/InstanceDetail/components/tabs/saves/SaveRestoreModal.tsx
import React, { useState, useEffect } from 'react';
import { OreModal } from '../../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { AlertTriangle, ShieldCheck, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { saveService, type SaveBackupMetadata } from '../../../logic/saveService';

interface SaveRestoreModalProps {
  instanceId: string;
  backupMeta: SaveBackupMetadata | null; // 传入要恢复的备份元数据
  onClose: () => void;
  onConfirmRestore: (uuid: string) => void;
}

export const SaveRestoreModal: React.FC<SaveRestoreModalProps> = ({ instanceId, backupMeta, onClose, onConfirmRestore }) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [hasVerified, setHasVerified] = useState(false);

  useEffect(() => {
    if (backupMeta) {
      setIsVerifying(true);
      setHasVerified(false);
      setWarnings([]);
      
      // 触发 Rust 端的极速 Hash 校验
      saveService.verifyRestore(instanceId, backupMeta.uuid)
        .then(diffs => {
          setWarnings(diffs);
          setHasVerified(true);
          // 校验完成后，将焦点移交到底部按钮
          setTimeout(() => setFocus(diffs.length > 0 ? 'btn-cancel-restore' : 'btn-confirm-restore'), 50);
        })
        .catch(err => {
          setWarnings([`校验引擎出错: ${err}`]);
          setHasVerified(true);
        })
        .finally(() => setIsVerifying(false));
    }
  }, [backupMeta, instanceId]);

  if (!backupMeta) return null;

  const isSafe = warnings.length === 0;

  return (
    <OreModal isOpen={!!backupMeta} onClose={onClose} hideTitleBar={true} className="w-full max-w-2xl">
      <FocusBoundary id="save-restore-boundary" className="flex flex-col">
        
        {/* 顶部校验状态表现 */}
        <div className={`flex flex-col items-center justify-center p-8 pt-10 border-b-2 border-[#1E1E1F] transition-colors ${isSafe ? 'bg-ore-green/10' : 'bg-red-500/10'}`}>
          {isVerifying ? (
            <Loader2 size={48} className="animate-spin text-ore-green mb-4" />
          ) : isSafe ? (
            <ShieldCheck size={48} className="text-ore-green mb-4 drop-shadow-md" />
          ) : (
            <AlertTriangle size={48} className="text-red-400 mb-4 drop-shadow-md" />
          )}
          
          <h2 className={`text-2xl font-minecraft drop-shadow-md ${isSafe ? 'text-ore-green' : 'text-red-400'}`}>
            {isVerifying ? '正在进行快照一致性校验...' : isSafe ? '环境校验通过' : '危险：模组环境不一致！'}
          </h2>
          
          <p className="mt-2 text-sm text-gray-400 text-center max-w-md">
            {isVerifying ? '正在对比当前实例与备份时的文件 Hash...' : 
             isSafe ? '当前实例的模组与备份时完全一致，可以安全恢复存档。' : 
             '当前实例的模组发生了增删或版本变化。强行恢复此存档可能导致方块丢失或存档彻底损坏！'}
          </p>
        </div>

        {/* 差异列表区 */}
        {!isVerifying && !isSafe && (
          <div className="bg-[#141415] border-b-2 border-[#1E1E1F] p-6 max-h-[30vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-gray-400 font-minecraft text-sm mb-3">检测到的环境变动：</h3>
            <ul className="space-y-2">
              {warnings.map((warn, idx) => (
                <li key={idx} className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded">
                  • {warn}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 底部操作区 */}
        <div className="flex items-center justify-center space-x-6 py-6 bg-[#18181B]">
          <OreButton focusKey="btn-cancel-restore" variant="secondary" onClick={onClose} className="w-40">
            <XCircle size={18} className="mr-2" /> 取消恢复
          </OreButton>

          <OreButton 
            focusKey="btn-confirm-restore" 
            variant={isSafe ? 'primary' : 'danger'} 
            disabled={isVerifying}
            onClick={() => onConfirmRestore(backupMeta.uuid)}
            className="w-48"
          >
            <RotateCcw size={18} className="mr-2" />
            {isSafe ? '安全恢复' : '强制恢复 (风险自负)'}
          </OreButton>
        </div>

      </FocusBoundary>
    </OreModal>
  );
};