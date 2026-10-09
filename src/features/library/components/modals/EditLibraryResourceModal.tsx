import React, { useEffect, useState } from 'react';
import { FolderOpen, Loader2, Save } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import type { LibraryResourceViewModel } from '../../logic/libraryItems';

interface EditLibraryResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: LibraryResourceViewModel | null;
  onSuccess?: () => void;
}

export const EditLibraryResourceModal: React.FC<EditLibraryResourceModalProps> = ({
  isOpen,
  onClose,
  resource,
  onSuccess,
}) => {

  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [author, setAuthor] = useState('');
  const [desc, setDesc] = useState('');
  const [fileName, setFileName] = useState('');

  // --- Upgrade/Overwrite path ---
  const [newLocalPath, setNewLocalPath] = useState('');
  const [isLocalFolder, setIsLocalFolder] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && resource) {
      setTitle(resource.title || '');
      setVersion(resource.version || '');
      setAuthor(resource.author || '');
      setDesc(resource.description || '');

      try {
        const snapshot = JSON.parse(resource.item.snapshot);
        setFileName(snapshot.fileName || '');
      } catch {
        setFileName('');
      }

      setNewLocalPath('');
      setIsLocalFolder(false);
      setErrorMsg(null);
    }
  }, [isOpen, resource]);

  const handleBrowseLocal = async () => {
    try {
      const typeText = resource?.type === 'shader' ? '光影' : '资源包';
      const selected = await openDialog({
        multiple: false,
        directory: isLocalFolder,
        filters: isLocalFolder ? undefined : [{ name: typeText, extensions: ['zip'] }],
      });

      if (selected && typeof selected === 'string') {
        setNewLocalPath(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (!resource || isSaving) return;
    if (!title.trim()) {
      setErrorMsg('标题不能为空');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const updatedFileName = newLocalPath ? (newLocalPath.split(/[/\\]/).pop() || '') : fileName;
      const snapshotObj = {
        title: title.trim(),
        author: author.trim(),
        description: desc.trim(),
        version: version.trim(),
        fileName: updatedFileName,
        iconUrl: resource.iconUrl,
        loaders: resource.loaders,
        categories: resource.categories,
      };

      if (newLocalPath) {
        // Upgrade flow: overwrite file and recreate link maps
        await invoke('update_library_resource_file', {
          resourceId: resource.id,
          newLocalPath: newLocalPath,
          newFilename: updatedFileName,
          newSnapshotJson: JSON.stringify(snapshotObj),
        });
      } else {
        // Simple metadata update
        const updatedItem = {
          ...resource.item,
          title: title.trim(),
          author: author.trim() || undefined,
          snapshot: JSON.stringify(snapshotObj),
          updatedAt: Math.floor(Date.now() / 1000),
        };
        await invoke('save_starred_item', {
          item: updatedItem,
          deviceId: '', // optional or empty
        });
      }

      onSuccess?.();
      onClose();
    } catch (e) {
      console.error(e);
      setErrorMsg(`更新失败: ${String(e)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const typeText = resource?.type === 'shader' ? '光影' : '资源包';

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={`编辑与覆盖升级${typeText}`}
      defaultFocusKey="btn-edit-res-save"
      className="h-[min(44rem,80vh)] w-[46rem] max-w-[calc(100vw-2rem)] border-[0.1875rem] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-modal-bg)] shadow-[var(--ore-shadow-modal-default)]"
      contentClassName="min-h-0 overflow-visible p-6 flex flex-col h-full bg-[var(--ore-color-background-surface-panel)] space-y-5 font-sans text-[var(--ore-color-text-primary-default)] text-sm"
      actionsClassName="!justify-center py-4 bg-[var(--ore-color-background-surface-raised)] border-t-[3px] border-[var(--ore-color-border-primary-default)]"
      actions={
        <div className="w-full flex flex-col items-center">
          {errorMsg && (
            <div className="text-xs text-[var(--ore-color-text-danger-default)] px-4 font-minecraft text-center truncate max-w-full mb-3">
              ⚠️ {errorMsg}
            </div>
          )}
          <div className="flex items-center justify-center gap-4 w-full">
            <OreButton 
              focusKey="btn-edit-res-cancel" 
              variant="secondary" 
              onClick={onClose} 
              disabled={isSaving} 
              size="auto"
            >
              取消
            </OreButton>
            <OreButton
              focusKey="btn-edit-res-save"
              variant="primary"
              onClick={() => { void handleSave(); }}
              disabled={isSaving}
              size="auto"
            >
              {isSaving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save size={14} className="mr-2" />}
              保存更新
            </OreButton>
          </div>
        </div>
      }
    >
      {/* Basic Metadata Group */}
      <div className="border-[3px] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] p-5 rounded-sm space-y-4">
        <div className="font-minecraft text-xs text-[var(--ore-color-background-info-default)] font-bold border-b border-[var(--ore-color-border-primary-default)] pb-2.5 uppercase tracking-wider">
          📝 基础信息设置
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <OreInput 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              disabled={isSaving} 
              focusKey="edit-res-title" 
              label="标题 (必填)"
            />
          </div>
          <div>
            <OreInput 
              value={version} 
              onChange={(e) => setVersion(e.target.value)} 
              disabled={isSaving} 
              focusKey="edit-res-version" 
              label="版本号"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <OreInput 
              value={author} 
              onChange={(e) => setAuthor(e.target.value)} 
              disabled={isSaving} 
              focusKey="edit-res-author" 
              label="作者"
            />
          </div>
          <div>
            <OreInput 
              value={desc} 
              onChange={(e) => setDesc(e.target.value)} 
              disabled={isSaving} 
              focusKey="edit-res-desc" 
              label="描述 / 备注"
            />
          </div>
        </div>
      </div>

      {/* Upgrade File Group */}
      <div className="border-[3px] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] p-5 rounded-sm space-y-4">
        <div className="flex justify-between items-center border-b border-[var(--ore-color-border-primary-default)] pb-2.5">
          <div className="font-minecraft text-xs text-[var(--ore-color-background-info-default)] font-bold uppercase tracking-wider">
            ⚡ 覆盖升级 (覆盖库文件并重构挂载)
          </div>
          <OreSwitch
            checked={isLocalFolder}
            onChange={(checked) => {
              setIsLocalFolder(checked);
              setNewLocalPath('');
            }}
            disabled={isSaving}
            focusKey="switch-edit-local-folder"
          />
        </div>

        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <OreInput
              value={newLocalPath}
              onChange={(e) => setNewLocalPath(e.target.value)}
              placeholder="留空表示仅元数据；选择新文件则覆盖库文件"
              readOnly
              focusKey="edit-res-new-path"
            />
          </div>
          <OreButton 
            focusKey="btn-edit-res-browse" 
            variant="secondary" 
            onClick={handleBrowseLocal} 
            disabled={isSaving}
            size="auto"
          >
            <FolderOpen size={15} className="mr-2" />
            浏览新文件
          </OreButton>
        </div>
        
        {fileName && (
          <div className="text-xs text-[var(--ore-color-text-muted-default)] font-mono bg-[var(--ore-color-background-surface-deep)] p-3 rounded-sm border border-[var(--ore-color-border-primary-default)] break-all">
            <span className="text-[var(--ore-color-background-info-default)] font-bold font-minecraft mr-2">当前库文件名:</span>
            {fileName}
          </div>
        )}
      </div>
    </OreModal>
  );
};
