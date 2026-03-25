import React, { useMemo, useState, useEffect } from 'react';
import { Archive, Trash2, FolderOpen, Database, Edit2, LogOut } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { message, ask } from '@tauri-apps/plugin-dialog';
import { exit } from '@tauri-apps/plugin-process';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { DirectoryBrowserModal } from '../../../../ui/components/DirectoryBrowserModal';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';

import { useSettingsStore } from '../../../../store/useSettingsStore';

export const DataSettings: React.FC = () => {
  const { settings, updateGeneralSetting } = useSettingsStore();
  const thirdPartyDirs = settings.general.thirdPartyDirs || [];
  const basePath = settings.general.basePath;

  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [browserOpen, setBrowserOpen] = useState(false);

  useEffect(() => {
    // 延迟 50ms 确保 OreButton 已经向 norigin-spatial-navigation 注册了它的 focusKey
    const timer = setTimeout(() => {
      setFocus('settings-data-modify-dir');
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  const handleRemoveDir = (dirToRemove: string) => {
    const updatedDirs = thirdPartyDirs.filter(d => d !== dirToRemove);
    updateGeneralSetting('thirdPartyDirs', updatedDirs);
  };

  const handleDirectorySelected = async (selectedPath: string) => {
    try {
      setBrowserOpen(false);
      setTimeout(() => setFocus('settings-data-modify-dir'), 50);

      if (!selectedPath || selectedPath === basePath) return;

      const wantsMove = await ask("是否将当前目录下的所有游戏数据（实例、配置等）完整移动到新目录？\n\n选择【是】将移动所有数据\n选择【否】仅复制基本配置文件(settings.json)，旧数据予以保留", { title: "数据迁移确认", kind: 'info' });

      await invoke('migrate_base_directory', { newPath: selectedPath, moveData: wantsMove });
      updateGeneralSetting('basePath', selectedPath);

      await message("数据目录迁移成功！为了确保游戏运行正常，PiLauncher 将退出，请重新启动启动器。", { title: "迁移成功", kind: 'info' });
      await exit(0);
    } catch (e) {
      await message(`目录修改过程中出错: ${e}`, { title: "迁移失败", kind: 'error' });
    }
  };

  const openRenameModal = () => {
    setNewName(basePath.split(/[\/\\]/).pop() || "");
    setRenameOpen(true);
  };

  const closeRenameModal = () => {
    setRenameOpen(false);
    setTimeout(() => setFocus('settings-data-rename-dir'), 50);
  };

  const submitRename = async () => {
    if (!newName.trim()) {
      closeRenameModal();
      return;
    }

    try {
      await invoke('rename_base_directory', { newName });
      await message("重命名成功！为了确保一切正常，启动器将退出，请重新启动。", { title: "成功", kind: 'info' });
      await exit(0);
    } catch (e) {
      await message(`重命名失败: ${e}`, { title: "错误", kind: 'error' });
    }
  };

  // Main page focus order
  const focusOrder = useMemo(() => {
    const baseFocus = ['settings-data-modify-dir', 'settings-data-rename-dir'];
    const thirdPartyFocus = thirdPartyDirs.map((_, idx) => `settings-data-remove-dir-${idx}`);
    return [...baseFocus, ...thirdPartyFocus];
  }, [thirdPartyDirs]);

  const { handleLinearArrow } = useLinearNavigation(focusOrder, 'settings-data-modify-dir', true, !browserOpen && !renameOpen);

  // Rename modal focus order
  const renameFocusOrder = ['settings-rename-input', 'settings-rename-submit', 'settings-rename-cancel'];
  const { handleLinearArrow: handleRenameArrow } = useLinearNavigation(renameFocusOrder, 'settings-rename-input', true, renameOpen);

  return (
    <SettingsPageLayout>

      <DirectoryBrowserModal
        isOpen={browserOpen}
        onClose={() => {
          setBrowserOpen(false);
          setTimeout(() => setFocus('settings-data-modify-dir'), 50);
        }}
        onSelect={handleDirectorySelected}
        initialPath={basePath}
      />

      <OreModal
        isOpen={renameOpen}
        onClose={closeRenameModal}
        title="重命名目录"
        defaultFocusKey="settings-rename-input"
        actions={
          <>
            <OreButton variant="ghost" onClick={closeRenameModal} focusKey="settings-rename-cancel" onArrowPress={handleRenameArrow}>取消</OreButton>
            <OreButton variant="primary" onClick={submitRename} focusKey="settings-rename-submit" onArrowPress={handleRenameArrow}>确认重命名</OreButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ore-text-muted">修改成功后启动器会自动退出以应用新名称。</p>
          <OreInput
            focusKey="settings-rename-input"
            onArrowPress={handleRenameArrow}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="新文件夹名字..."
          />
        </div>
      </OreModal>

      <SettingsSection title="核心数据目录" icon={<Database size={18} />}>
        <FormRow
          label="核心数据存储位置"
          description={`当前位置: ${basePath || "尚未配置"}\n将游戏实例、日志、启动器配置等核心数据完整迁移至新的目录。`}
          vertical={false}
          control={
            <OreButton variant="secondary" onClick={() => setBrowserOpen(true)} focusKey="settings-data-modify-dir" onArrowPress={handleLinearArrow}>
              <LogOut size={16} className="mr-1.5" /> 修改目录并迁移
            </OreButton>
          }
        />
        <FormRow
          label="重命名数据文件夹"
          description="如果你对当前数据文件夹名字不满意，可以直接对其进行重命名，方便步骤选择或者辨别。"
          vertical={false}
          control={
            <OreButton variant="secondary" onClick={openRenameModal} focusKey="settings-data-rename-dir" onArrowPress={handleLinearArrow}>
              <Edit2 size={16} className="mr-1.5" /> 重命名文件夹
            </OreButton>
          }
        />
      </SettingsSection>

      <SettingsSection title="导入的实例目录" icon={<Archive size={18} />}>
        {thirdPartyDirs.length === 0 ? (
          <FormRow
            label="已关联的第三方文件夹"
            description="这些文件夹内的实例会在启动器启动时被自动扫描。移除关联不会删除本地文件和数据。"
            vertical={false}
            control={
              <div className="text-[length:var(--ore-typography-size-sm)] font-minecraft text-[color:var(--ore-color-text-muted-default)] px-[var(--ore-spacing-base)] py-[var(--ore-spacing-sm)] border-2 border-dashed border-[color:var(--ore-color-border-neutral-default)]">
                暂无导入的外部目录
              </div>
            }
          />
        ) : (
          thirdPartyDirs.map((dir, idx) => (
            <FormRow
              key={dir}
              label={
                <div className="flex items-center space-x-2 overflow-hidden max-w-sm lg:max-w-md xl:max-w-xl">
                  <FolderOpen size={18} className="text-ore-orange flex-shrink-0" />
                  <span className="text-white font-minecraft text-base truncate flex-1" title={dir}>
                    {dir}
                  </span>
                </div>
              }
              description={idx === 0 ? "这些外部文件夹内的游戏实例同样会被 PiLauncher 加载。点击移除仅取消关联，不会损伤本地文件。" : undefined}
              vertical={false}
              control={
                <OreButton
                  variant="danger"
                  size="auto"
                  onClick={() => handleRemoveDir(dir)}
                  focusKey={`settings-data-remove-dir-${idx}`}
                  onArrowPress={handleLinearArrow}
                >
                  <Trash2 size={14} className="mr-1.5" />
                  移除关联
                </OreButton>
              }
            />
          ))
        )}
      </SettingsSection>
    </SettingsPageLayout>
  );
};
