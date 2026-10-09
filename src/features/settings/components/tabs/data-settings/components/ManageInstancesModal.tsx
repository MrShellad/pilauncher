import React, { useEffect, useState, useMemo } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { Trash2, Search, Loader2 } from 'lucide-react';

import { useLauncherStore } from '@/app/stores/useLauncherStore';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../../../ui/primitives/OreModal';
import { OreInput } from '../../../../../../ui/primitives/OreInput';
import { OreConfirmDialog } from '../../../../../../ui/primitives/OreConfirmDialog';

import defaultImg1 from '../../../../../../assets/instances/default-1.jpg';
import defaultImg2 from '../../../../../../assets/instances/default-2.jpg';
import defaultImg3 from '../../../../../../assets/instances/default-3.png';

const DEFAULT_IMAGES = [defaultImg1, defaultImg2, defaultImg3];

interface ManageInstancesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RawInstanceItem {
  id: string;
  name: string;
  version: string;
  loader: string;
  play_time: number;
  last_played: string;
  cover_path?: string;
  tags?: string[];
  is_favorite?: boolean;
  created_at: string;
}

export const ManageInstancesModal: React.FC<ManageInstancesModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [instances, setInstances] = useState<RawInstanceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadInstances = async () => {
    setIsLoading(true);
    try {
      const data = await invoke<RawInstanceItem[]>('get_all_instances', { forceRefresh: true });
      setInstances(data || []);
    } catch (err) {
      console.error('Failed to load instances in management modal:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setDeletingId(null);
      setIsDeleting(false);
      void loadInstances();
    }
  }, [isOpen]);

  const filteredInstances = useMemo(() => {
    if (!searchQuery.trim()) return instances;
    const lowerQuery = searchQuery.toLowerCase();
    return instances.filter(
      (inst) =>
        inst.name.toLowerCase().includes(lowerQuery) ||
        inst.id.toLowerCase().includes(lowerQuery) ||
        (inst.version && inst.version.toLowerCase().includes(lowerQuery)) ||
        (inst.loader && inst.loader.toLowerCase().includes(lowerQuery))
    );
  }, [instances, searchQuery]);

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await invoke('delete_instance', { id: deletingId });

      // Synchronize the main launcher store
      const currentInstances = useLauncherStore.getState().instances;
      const updatedInstances = currentInstances.filter((item: any) => item.id !== deletingId);
      useLauncherStore.getState().setInstances(updatedInstances);

      const currentSelectedId = useLauncherStore.getState().selectedInstanceId;
      if (currentSelectedId === deletingId) {
        useLauncherStore.getState().setSelectedInstanceId(null);
      }

      setDeletingId(null);
      void loadInstances();
    } catch (err) {
      console.error('Failed to delete instance:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const resolveCover = (item: RawInstanceItem) => {
    if (item.cover_path) {
      return convertFileSrc(item.cover_path);
    }
    const hash = item.id
      .split('')
      .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
    return DEFAULT_IMAGES[hash % DEFAULT_IMAGES.length];
  };

  const selectedDeleteInstanceName = useMemo(() => {
    if (!deletingId) return '';
    return instances.find(inst => inst.id === deletingId)?.name || deletingId;
  }, [deletingId, instances]);

  return (
    <>
      <OreConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDeleteConfirm}
        isConfirming={isDeleting}
        title={t('settings.data.manageInstances.deleteConfirmTitle', '删除实例')}
        headline={t('settings.data.manageInstances.deleteConfirmHeadline', '确定要彻底删除该实例吗？')}
        description={
          <div className="space-y-2">
            <p className="font-bold text-red-400 font-mono text-sm break-all bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded">{selectedDeleteInstanceName}</p>
            <p>{t('settings.data.manageInstances.deleteConfirmDesc', '该操作不可逆！实例的全部配置文件、MOD 以及单人存档都将被永久清除。')}</p>
          </div>
        }
        confirmLabel={t('settings.data.remoteLogs.delete', '删除')}
        cancelLabel={t('settings.data.btnCancel', '取消')}
        confirmVariant="danger"
        tone="danger"
      />

      <OreModal
        isOpen={isOpen}
        onClose={onClose}
        title={t('settings.data.manageInstances.modalTitle', '本地实例管理')}
        className="w-[600px] h-[550px] flex flex-col"
      >
        <div className="flex flex-col h-full gap-4 relative">
          <div className="flex-shrink-0 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ore-text-muted">
              <Search size={16} />
            </div>
            <OreInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('settings.data.manageInstances.searchPlaceholder', '搜索实例名称、版本、加载器或 ID...')}
              className="pl-9 w-full"
            />
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-2 min-h-[300px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center flex-1 h-[250px] text-ore-text-muted gap-2">
                <Loader2 className="animate-spin" size={24} />
                <span>{t('settings.data.remoteLogs.loading', '正在加载...')}</span>
              </div>
            ) : filteredInstances.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 h-[250px] text-ore-text-muted">
                <span>{t('settings.data.remoteLogs.empty', '暂无匹配的实例')}</span>
              </div>
            ) : (
              filteredInstances.map((inst) => (
                <div
                  key={inst.id}
                  className="flex flex-row items-center justify-between p-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded transition-colors gap-4"
                >
                  <div className="flex flex-row items-center gap-3 min-w-0">
                    <img
                      src={resolveCover(inst)}
                      className="w-10 h-14 object-cover bg-black/40 border border-white/10 rounded flex-shrink-0"
                      alt=""
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = defaultImg1;
                      }}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-white text-sm truncate">{inst.name}</span>
                      <span className="text-xs text-ore-text-muted mt-0.5 truncate">
                        {inst.version || 'Vanilla'} / {inst.loader || 'vanilla'}
                      </span>
                      <span className="text-[10px] text-ore-text-muted font-mono truncate opacity-60 mt-0.5">
                        ID: {inst.id}
                      </span>
                    </div>
                  </div>
                  <OreButton
                    variant="danger"
                    onClick={() => setDeletingId(inst.id)}
                    className="min-w-[80px] h-8 justify-center flex-shrink-0"
                  >
                    <Trash2 size={14} className="mr-1.5" />
                    {t('settings.data.remoteLogs.delete', '删除')}
                  </OreButton>
                </div>
              ))
            )}
          </div>
        </div>
      </OreModal>
    </>
  );
};
