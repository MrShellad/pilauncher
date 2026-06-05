import React, { useEffect, useState } from 'react';
import { Check, Columns3, Loader2, Save } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Virtuoso } from 'react-virtuoso';

import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { VirtuosoScroller } from '../../../../ui/primitives/OreOverlayScrollArea';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import type { LibraryResourceViewModel } from '../../logic/libraryItems';

interface ManageLinkageModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: LibraryResourceViewModel | null;
  onSuccess?: () => void;
}

interface InstanceItem {
  id: string;
  name: string;
  version: string;
  loader: string;
  coverPath?: string;
}

const ModalScroller = React.forwardRef<HTMLDivElement, any>((props, ref) => (
  <VirtuosoScroller
    {...props}
    ref={ref}
    contentSafePaddingRight={0}
  />
));
ModalScroller.displayName = 'ModalScroller';

const ModalList = React.forwardRef<HTMLDivElement, any>((props, ref) => (
  <div
    {...props}
    ref={ref}
    className={`max-w-[36rem] mx-auto px-4 ${props.className || ''}`}
  />
));
ModalList.displayName = 'ModalList';

const ModalHeader = () => <div className="h-4" />;
const ModalFooter = () => <div className="h-2" />;

const VIRTUOSO_COMPONENTS = {
  Scroller: ModalScroller,
  List: ModalList,
  Header: ModalHeader,
  Footer: ModalFooter,
};

export const ManageLinkageModal: React.FC<ManageLinkageModalProps> = ({
  isOpen,
  onClose,
  resource,
  onSuccess,
}) => {

  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && resource) {
      void loadData();
    }
  }, [isOpen, resource]);

  const loadData = async () => {
    if (!resource) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // 1. Load instances
      const list = await invoke<InstanceItem[]>('get_all_instances', { forceRefresh: false });

      // 2. Load linked instances
      const linkedIds = await invoke<string[]>('get_library_resource_mappings', {
        resourceId: resource.id,
      });
      const linkedSet = new Set(linkedIds);
      setSelectedIds(linkedSet);

      // Sort: linked ones at the top
      const sortedList = [...list].sort((a, b) => {
        const aLinked = linkedSet.has(a.id) ? 1 : 0;
        const bLinked = linkedSet.has(b.id) ? 1 : 0;
        return bLinked - aLinked;
      });
      setInstances(sortedList);
    } catch (e) {
      console.error(e);
      setErrorMsg(`数据加载失败: ${String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (id: string) => {
    if (isSaving) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!resource || isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await invoke('link_library_resource_to_instances', {
        resourceId: resource.id,
        instanceIds: Array.from(selectedIds),
      });
      onSuccess?.();
      onClose();
    } catch (e) {
      console.error(e);
      setErrorMsg(`保存失败: ${String(e)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const resourceTitle = resource?.title || '未命名资源';
  const typeText = resource?.type === 'shader' ? '光影' : '资源包';

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={`管理${typeText}实例导入`}
      defaultFocusKey="btn-linkage-save"
      hideCloseButton={true}
      className="h-[min(38rem,calc(100vh-2rem))] w-[46rem] max-w-[calc(100vw-2rem)] border-[0.1875rem] border-[var(--ore-color-border-primary-default)] bg-[#313233] shadow-[var(--ore-shadow-modal-default)]"
      contentClassName="min-h-0 overflow-visible p-0 flex flex-col h-full bg-[#313233]"
      actionsClassName="!justify-center py-4 bg-[#313233] border-t-[3px] border-[var(--ore-color-border-primary-default)]"
      actions={
        <div className="w-full flex flex-col items-center">
          {errorMsg && (
            <div className="text-xs text-[var(--ore-color-text-danger-default)] px-4 font-minecraft text-center truncate max-w-full mb-3">
              ⚠️ {errorMsg}
            </div>
          )}
          <div className="flex items-center justify-center gap-4 w-full">
            <OreButton 
              focusKey="btn-linkage-cancel" 
              variant="secondary" 
              onClick={onClose} 
              disabled={isSaving} 
              size="md"
            >
              取消
            </OreButton>
            <OreButton
              focusKey="btn-linkage-save"
              variant="primary"
              onClick={() => { void handleSave(); }}
              disabled={isLoading || isSaving}
              size="md"
            >
              {isSaving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save size={14} className="mr-2" />}
              保存映射
            </OreButton>
          </div>
        </div>
      }
    >
      <div className="shrink-0 border-b-[3px] border-[var(--ore-color-border-primary-default)] bg-[#313233] px-6 py-4">
        <div className="flex items-center gap-3">
          <Columns3 size={20} className="text-[var(--ore-color-background-success-default)]" />
          <div>
            <div className="font-minecraft text-sm text-[var(--ore-color-text-primary-default)] font-bold tracking-wide">{resourceTitle}</div>
            <div className="text-xs text-[var(--ore-color-text-muted-default)] mt-1.5 leading-relaxed font-minecraft">
              选择把该{typeText}导入到下方的实例中，通过超轻量级链接技术以防占用过多空间。
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-[#313233]">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center text-sm text-[var(--ore-color-text-muted-default)] font-minecraft">
            <Loader2 className="animate-spin mb-3 text-[var(--ore-color-background-success-default)]" size={24} />
            正在加载实例映射...
          </div>
        ) : instances.length > 0 ? (
          <Virtuoso
            className="h-full custom-scrollbar"
            style={{
              height: '100%',
              overflowY: 'auto',
            }}
            data={instances}
            components={VIRTUOSO_COMPONENTS}
            computeItemKey={(_, item) => item.id}
            itemContent={(_, instance) => {
              const checked = selectedIds.has(instance.id);
              return (
                <div className="pb-2">
                  <FocusItem
                    key={instance.id}
                    focusKey={`lib-linkage-item-${instance.id}`}
                    onEnter={() => handleToggle(instance.id)}
                  >
                    {({ ref, focused }) => (
                      <div
                        ref={ref as React.RefObject<HTMLDivElement>}
                        className={`flex items-center justify-between border-2 p-3.5 cursor-pointer rounded-[2px] transition-all duration-75 select-none ${
                          checked
                            ? 'border-[var(--ore-color-background-success-default)] bg-[rgba(108,195,73,0.1)] text-[var(--ore-color-text-primary-default)]'
                            : 'border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] text-[var(--ore-color-text-muted-default)] hover:bg-[var(--ore-color-background-surface-hover)]'
                        } ${focused ? 'outline outline-[2px] outline-[var(--ore-focus-ringFallback)] outline-offset-1 z-10 scale-[1.01] shadow-[0_0_10px_var(--ore-focus-glow)] brightness-110' : ''}`}
                        onClick={() => handleToggle(instance.id)}
                      >
                        <div className="min-w-0 flex-1 flex items-center gap-3.5">
                          <div className="h-10 w-10 shrink-0 border border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-deep)] overflow-hidden rounded-[2px] shadow-inner flex items-center justify-center">
                            {instance.coverPath ? (
                              <img src={instance.coverPath} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="text-[0.6875rem] font-minecraft text-[var(--ore-color-text-success-default)] font-bold">
                                {instance.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-bold font-minecraft text-[var(--ore-color-text-primary-default)] text-sm tracking-wide">{instance.name}</div>
                            <div className="text-[0.625rem] text-[var(--ore-color-text-muted-default)] mt-1 font-minecraft">
                              MC版本: <span className="text-[var(--ore-color-text-secondary-default)]">{instance.version}</span> | 加载器: <span className="text-[var(--ore-color-text-secondary-default)]">{instance.loader || 'Vanilla'}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center pl-3">
                          <div className={`w-5 h-5 flex items-center justify-center border-2 rounded-[2px] transition-all duration-100 ${
                            checked 
                              ? 'border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-success-default)]' 
                              : 'border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-deep)]'
                          }`}>
                            {checked && <Check size={12} className="text-black stroke-[3.5px]" />}
                          </div>
                        </div>
                      </div>
                    )}
                  </FocusItem>
                </div>
              );
            }}
          />
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-sm text-[var(--ore-color-text-muted-default)] text-center p-6 border-2 border-dashed border-[var(--ore-color-border-primary-default)] rounded-[2px] font-minecraft max-w-[36rem] mx-auto my-4">
            暂无可用游戏实例，请先在实例页创建实例。
          </div>
        )}
      </div>
    </OreModal>
  );
};
