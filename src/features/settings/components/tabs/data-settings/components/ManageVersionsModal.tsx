import React, { useEffect, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { Trash2, Search, Loader2, Package, Cpu } from 'lucide-react';

import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../../../ui/primitives/OreModal';
import { OreInput } from '../../../../../../ui/primitives/OreInput';
import { OreConfirmDialog } from '../../../../../../ui/primitives/OreConfirmDialog';
import { OreToggleButton } from '../../../../../../ui/primitives/OreToggleButton';
import { OreOverlayScrollArea } from '../../../../../../ui/primitives/OreOverlayScrollArea';

interface ManageVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AssociatedInstanceInfo {
  id: string;
  name: string;
}

interface LocalVersionItem {
  id: string;
  name: string;
  mcVersion: string;
  loaderType: string;
  loaderVersion: string;
  sizeBytes: number;
  associatedInstances: AssociatedInstanceInfo[];
}

export const ManageVersionsModal: React.FC<ManageVersionsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [versions, setVersions] = useState<LocalVersionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'mc' | 'loader'>('mc');
  const [isLoading, setIsLoading] = useState(false);
  const [deletingItem, setDeletingItem] = useState<LocalVersionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadVersions = async () => {
    setIsLoading(true);
    try {
      const data = await invoke<LocalVersionItem[]>('get_local_versions');
      setVersions(data || []);
    } catch (err) {
      console.error('Failed to load local versions in management modal:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setDeletingItem(null);
      setIsDeleting(false);
      void loadVersions();
    }
  }, [isOpen]);

  const toggleOptions = useMemo(() => [
    { label: t('settings.data.manageVersions.minecraftTab', 'Minecraft 核心'), value: 'mc' },
    { label: t('settings.data.manageVersions.loaderTab', '加载器核心'), value: 'loader' }
  ], [t]);

  const filteredVersions = useMemo(() => {
    const isMcTab = activeTab === 'mc';
    const tabFiltered = versions.filter(ver => {
      const isVanilla = ver.loaderType === 'vanilla';
      return isMcTab ? isVanilla : !isVanilla;
    });

    if (!searchQuery.trim()) return tabFiltered;
    const lowerQuery = searchQuery.toLowerCase();
    return tabFiltered.filter(
      (ver) =>
        ver.name.toLowerCase().includes(lowerQuery) ||
        ver.id.toLowerCase().includes(lowerQuery) ||
        ver.mcVersion.toLowerCase().includes(lowerQuery) ||
        ver.loaderType.toLowerCase().includes(lowerQuery)
    );
  }, [versions, searchQuery, activeTab]);

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      await invoke('delete_local_version', { id: deletingItem.id });
      setDeletingItem(null);
      void loadVersions();
    } catch (err) {
      console.error('Failed to delete version:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatSizeBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <OreConfirmDialog
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleDeleteConfirm}
        isConfirming={isDeleting}
        title={t('settings.data.manageVersions.deleteConfirmTitle', '删除版本核心')}
        headline={t('settings.data.manageVersions.deleteConfirmHeadline', '确定要删除该版本核心吗？')}
        description={
          <div className="space-y-3 font-minecraft text-sm leading-6">
            <p className="font-bold text-red-400 font-mono text-sm break-all bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded">
              {deletingItem?.name || ''}
            </p>
            <p className="text-[11px] text-ore-text-muted break-all font-mono opacity-80">
              ID / Path: {deletingItem?.id || ''}
            </p>
            <p>{t('settings.data.manageVersions.deleteConfirmDesc', '这会彻底删除该核心文件夹下的文件（包括 json 和 jar），删除后，使用该核心的实例需要重新下载此核心才能运行。')}</p>
            
            {deletingItem && deletingItem.associatedInstances.length > 0 ? (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
                <p className="text-xs font-bold text-yellow-400">
                  {t('settings.data.manageVersions.deleteConfirmAffect', '此操作会影响以下 {{count}} 个关联实例：', { count: deletingItem.associatedInstances.length })}
                </p>
                <div className="max-h-[80px] overflow-y-auto mt-1.5 flex flex-wrap gap-1 custom-scrollbar">
                  {deletingItem.associatedInstances.map(inst => (
                    <span key={inst.id} className="text-[10px] bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded font-mono">
                      {inst.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-green-400 font-bold bg-green-500/10 border border-green-500/20 p-2 rounded">
                {t('settings.data.manageVersions.deleteConfirmAffectNone', '当前无关联实例，可以安全删除。')}
              </p>
            )}
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
        title={t('settings.data.manageVersions.modalTitle', '版本核心管理')}
        className="w-[640px] h-[580px] flex flex-col"
        contentClassName="flex flex-col h-full overflow-hidden p-6"
      >
        <div className="flex flex-col h-full gap-4 relative">
          {/* Top Toggle Switch with safety margin */}
          <div className="flex-shrink-0 mb-1">
            <OreToggleButton
              options={toggleOptions}
              value={activeTab}
              onChange={(val) => setActiveTab(val as 'mc' | 'loader')}
              size="md"
              focusKeyPrefix="manage-versions-toggle"
            />
          </div>

          {/* Search bar */}
          <div className="flex-shrink-0 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ore-text-muted pointer-events-none">
              <Search size={16} />
            </div>
            <OreInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('settings.data.manageVersions.searchPlaceholder', '搜索版本号、加载器或名称...')}
              className="pl-9 w-full"
            />
          </div>

          {/* Core version list wrapped in OreOverlayScrollArea */}
          <div className="flex-1 min-h-[300px] overflow-hidden relative">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-ore-text-muted gap-2">
                <Loader2 className="animate-spin" size={24} />
                <span>{t('settings.data.remoteLogs.loading', '正在加载...')}</span>
              </div>
            ) : filteredVersions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-ore-text-muted">
                <span>
                  {searchQuery.trim()
                    ? t('settings.data.manageVersions.emptySearch', '未搜索到匹配的核心')
                    : t('settings.data.manageVersions.empty', '暂无已下载的核心')}
                </span>
              </div>
            ) : (
              <OreOverlayScrollArea className="w-full h-full" viewportClassName="pr-2" contentSafePaddingRight={6}>
                <div className="flex flex-col gap-3.5 pb-2">
                  {filteredVersions.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-row items-start justify-between p-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded transition-colors gap-4"
                    >
                      {/* Left: Metadata Details */}
                      <div className="flex flex-row gap-3 min-w-0">
                        <div className="w-9 h-9 rounded bg-white/10 flex items-center justify-center flex-shrink-0 text-ore-text-muted">
                          {activeTab === 'mc' ? <Package size={18} /> : <Cpu size={18} />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-white text-sm truncate">{item.name}</span>
                          <span className="text-[10px] font-mono text-ore-text-muted mt-0.5 truncate opacity-70">
                            ID: {item.id}
                          </span>
                          
                          {/* Folder size */}
                          <span className="text-xs text-ore-text-muted mt-1">
                            {t('settings.data.manageVersions.totalSize', '占用空间')}: <span className="text-white font-mono">{formatSizeBytes(item.sizeBytes)}</span>
                          </span>

                          {/* Associated Instances List */}
                          <div className="mt-2 flex flex-wrap items-center gap-1 min-w-0 text-xs">
                            <span className="text-ore-text-muted mr-1">
                              {t('settings.data.manageVersions.associatedInstancesCount', '关联实例: {{count}} 个', { count: item.associatedInstances.length })}
                            </span>
                            {item.associatedInstances.length > 0 && (
                              <div className="flex flex-wrap gap-1 max-w-full">
                                {item.associatedInstances.slice(0, 4).map(inst => (
                                  <span key={inst.id} className="text-[10px] bg-white/10 hover:bg-white/15 text-white px-2 py-0.5 rounded transition-colors truncate max-w-[120px]" title={inst.name}>
                                    {inst.name}
                                  </span>
                                ))}
                                {item.associatedInstances.length > 4 && (
                                  <span className="text-[10px] bg-white/10 text-ore-text-muted px-2 py-0.5 rounded">
                                    +{item.associatedInstances.length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex-shrink-0 self-center">
                        <OreButton
                          variant="danger"
                          onClick={() => setDeletingItem(item)}
                          className="min-w-[80px] h-8.5 justify-center flex-shrink-0"
                        >
                          <Trash2 size={14} className="mr-1.5" />
                          {t('settings.data.remoteLogs.delete', '删除')}
                        </OreButton>
                      </div>
                    </div>
                  ))}
                </div>
              </OreOverlayScrollArea>
            )}
          </div>
        </div>
      </OreModal>
    </>
  );
};
