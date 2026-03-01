// /src/features/InstanceDetail/components/tabs/saves/BackupListModal.tsx
import React, { useEffect } from 'react';
import { OreModal } from '../../../../../ui/primitives/OreModal';
import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Archive, History, RotateCcw, Database } from 'lucide-react';
import type { SaveBackupMetadata } from '../../../logic/saveService';

interface BackupListModalProps {
  isOpen: boolean;
  onClose: () => void;
  backups: SaveBackupMetadata[];
  formatSize: (bytes: number) => string;
  formatDate: (timestamp: number) => string;
  onSelectBackup: (backup: SaveBackupMetadata) => void;
}

export const BackupListModal: React.FC<BackupListModalProps> = ({ 
  isOpen, onClose, backups, formatSize, formatDate, onSelectBackup 
}) => {
  
  useEffect(() => {
    if (isOpen) setTimeout(() => setFocus('backup-list-boundary'), 50);
  }, [isOpen]);

  return (
    <OreModal isOpen={isOpen} onClose={onClose} title="历史备份记录" className="w-full max-w-2xl">
      <FocusBoundary id="backup-list-boundary" className="flex flex-col">
        {backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-ore-text-muted">
            <Archive size={48} className="mb-4 opacity-30" />
            <p className="font-minecraft text-lg">暂无备份记录</p>
            <p className="text-sm mt-2">在存档列表中点击备份按钮创建快照。</p>
          </div>
        ) : (
          <div className="flex flex-col max-h-[60vh] overflow-y-auto custom-scrollbar p-4 space-y-3">
            {backups.map(backup => (
              <FocusItem key={backup.uuid} onEnter={() => onSelectBackup(backup)}>
                {({ref, focused}) => (
                  <div 
                    ref={ref as any}
                    onClick={() => onSelectBackup(backup)}
                    className={`flex items-center justify-between p-4 bg-[#18181B] border-2 outline-none transition-all cursor-pointer ${focused ? 'border-white bg-[#2A2A2C] scale-[1.01] z-10 shadow-lg brightness-110' : 'border-[#1E1E1F] hover:border-[#2A2A2C]'}`}
                  >
                    <div className="flex items-center flex-1 min-w-0 pr-4">
                      <div className="w-12 h-12 bg-[#141415] border border-[#2A2A2C] flex items-center justify-center mr-4 flex-shrink-0">
                        <Database size={24} className={focused ? 'text-white' : 'text-ore-green'} />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className={`font-minecraft text-lg truncate ${focused ? 'text-white' : 'text-gray-200'}`}>
                          {backup.worldName}
                        </span>
                        <div className="text-xs text-ore-text-muted mt-1 space-x-3 flex items-center">
                          <span className="flex items-center"><History size={12} className="mr-1" /> {formatDate(backup.backupTime)}</span>
                          <span>|</span>
                          <span>{formatSize(backup.sizeBytes)}</span>
                          <span>|</span>
                          <span>模组: {backup.modsState.length} 个</span>
                        </div>
                      </div>
                    </div>
                    
                    <button className={`flex items-center px-3 py-1.5 font-minecraft text-sm border-2 transition-colors ${focused ? 'border-white text-white' : 'border-[#2A2A2C] text-gray-400'}`}>
                      <RotateCcw size={16} className="mr-1.5" /> 恢复此备份
                    </button>
                  </div>
                )}
              </FocusItem>
            ))}
          </div>
        )}
      </FocusBoundary>
    </OreModal>
  );
};