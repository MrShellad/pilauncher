import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Archive, Trash2, FolderOpen, Database, Edit2, LogOut, FileX, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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
import { OreConfirmDialog } from '../../../../ui/primitives/OreConfirmDialog';
import { DirectoryBrowserModal } from '../../../../ui/components/DirectoryBrowserModal';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';

import { useSettingsStore } from '../../../../store/useSettingsStore';

export const DataSettings: React.FC = () => {
  const { t } = useTranslation();
  const { settings, updateGeneralSetting } = useSettingsStore();
  const thirdPartyDirs = settings.general.thirdPartyDirs || [];
  const basePath = settings.general.basePath;

  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [browserOpen, setBrowserOpen] = useState(false);

  // Confirm dialog state
  const [removeDirTarget, setRemoveDirTarget] = useState<string | null>(null);

  type CleanLogsPhase = 'idle' | 'confirm' | 'cleaning' | 'done' | 'error';
  const [cleanLogsPhase, setCleanLogsPhase] = useState<CleanLogsPhase>('idle');
  const [cleanLogsCount, setCleanLogsCount] = useState(0);
  const [cleanLogsError, setCleanLogsError] = useState('');

  const closeCleanLogsDialog = () => {
    setCleanLogsPhase('idle');
    setCleanLogsCount(0);
    setCleanLogsError('');
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setFocus('settings-data-modify-dir');
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleRemoveDir = async () => {
    if (!removeDirTarget) return;
    const dirToRemove = removeDirTarget;
    setRemoveDirTarget(null);
    try {
      const removedCount = await invoke<number>('remove_imported_instances', { dirPath: dirToRemove });
      const updatedDirs = thirdPartyDirs.filter(d => d !== dirToRemove);
      updateGeneralSetting('thirdPartyDirs', updatedDirs);
      await message(`已取消关联并清理了 ${removedCount} 个相关的导入实例数据。`, { title: "操作成功", kind: "info" });
    } catch (e) {
      await message(`移除失败: ${e}`, { title: "错误", kind: 'error' });
    }
  };

  const handleCleanLogs = async () => {
    setCleanLogsPhase('cleaning');
    try {
      const count = await invoke<number>('clean_logs');
      setCleanLogsCount(count);
      setCleanLogsPhase('done');
    } catch (e) {
      setCleanLogsError(String(e));
      setCleanLogsPhase('error');
    }
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
    const baseFocus = ['settings-data-modify-dir', 'settings-data-rename-dir', 'settings-data-clean-logs'];
    const thirdPartyFocus = thirdPartyDirs.map((_, idx) => `settings-data-remove-dir-${idx}`);
    return [...baseFocus, ...thirdPartyFocus];
  }, [thirdPartyDirs]);

  const { handleLinearArrow } = useLinearNavigation(focusOrder, 'settings-data-modify-dir', true, !browserOpen && !renameOpen && !removeDirTarget && cleanLogsPhase === 'idle');

  // Rename modal focus order
  const renameFocusOrder = ['settings-rename-input', 'settings-rename-submit', 'settings-rename-cancel'];
  const { handleLinearArrow: handleRenameArrow } = useLinearNavigation(renameFocusOrder, 'settings-rename-input', true, renameOpen);

  return (
    <SettingsPageLayout adaptiveScale>

      {/* Confirm: remove third-party dir */}
      <OreConfirmDialog
        isOpen={!!removeDirTarget}
        onClose={() => setRemoveDirTarget(null)}
        onConfirm={handleRemoveDir}
        title="移除确认"
        headline="确定要移除此关联目录吗？"
        description={
          <div className="space-y-2">
            <p className="font-mono text-xs bg-black/30 px-3 py-2 rounded break-all">{removeDirTarget}</p>
            <p>此操作将取消与该外部目录的关联，并同步清理 PiLauncher 内对应的实例缓存数据。</p>
            <p className="text-ore-text-muted text-xs">原始目录内的文件和存档不会受到任何影响。</p>
          </div>
        }
        confirmLabel="确认移除"
        cancelLabel="取消"
        confirmVariant="danger"
        tone="warning"
      />

      {/* Confirm: clean logs — inline phase dialog, fixed size to prevent jitter */}
      <OreModal
        isOpen={cleanLogsPhase !== 'idle'}
        onClose={closeCleanLogsDialog}
        title="清理日志"
        hideCloseButton={cleanLogsPhase === 'cleaning'}
        closeOnOutsideClick={cleanLogsPhase !== 'cleaning'}
        className="w-[440px]"
        actions={
          <div className="flex flex-row gap-3 justify-end">
            {cleanLogsPhase === 'confirm' && (
              <>
                <OreButton variant="secondary" onClick={closeCleanLogsDialog} focusKey="clean-logs-cancel" className="min-w-[110px] justify-center whitespace-nowrap">取消</OreButton>
                <OreButton variant="danger" onClick={handleCleanLogs} focusKey="clean-logs-confirm" className="min-w-[110px] justify-center whitespace-nowrap">确认清理</OreButton>
              </>
            )}
            {cleanLogsPhase !== 'confirm' && cleanLogsPhase !== 'cleaning' && (
              <OreButton variant="primary" onClick={closeCleanLogsDialog} focusKey="clean-logs-done" className="min-w-[110px] justify-center whitespace-nowrap">完成</OreButton>
            )}
          </div>
        }
      >
        <div className="relative h-[140px] overflow-hidden">
          <AnimatePresence mode="wait">
            {cleanLogsPhase === 'confirm' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0 flex flex-col justify-center gap-3"
              >
                <p className="text-ore-text">此操作将删除 <span className="font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">logs/</span> 目录下的所有日志文件，包括游戏启动日志和诊断记录。</p>
                <p className="text-ore-text-muted text-xs">清理后不可撤销，建议先导出所需诊断包。当前路径: {basePath ? basePath + '/logs' : '尚未配置'}</p>
              </motion.div>
            )}
            {cleanLogsPhase === 'cleaning' && (
              <motion.div
                key="cleaning"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4"
              >
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                  <Loader2 size={36} className="text-ore-green" />
                </motion.div>
                <p className="text-ore-text-muted text-sm">清理中，请稍候...</p>
              </motion.div>
            )}
            {cleanLogsPhase === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              >
                <CheckCircle2 size={36} className="text-ore-green" />
                <p className="text-ore-text font-bold">清理完成</p>
                <p className="text-ore-text-muted text-sm">已成功清理 <span className="text-white font-bold">{cleanLogsCount}</span> 个日志条目</p>
              </motion.div>
            )}
            {cleanLogsPhase === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              >
                <AlertCircle size={36} className="text-red-400" />
                <p className="text-ore-text font-bold">清理失败</p>
                <p className="text-ore-text-muted text-xs break-all text-center">{cleanLogsError}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </OreModal>

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
          <div className="flex flex-row gap-3 justify-end">
            <OreButton variant="secondary" onClick={closeRenameModal} focusKey="settings-rename-cancel" onArrowPress={handleRenameArrow} className="min-w-[110px] justify-center whitespace-nowrap">取消</OreButton>
            <OreButton variant="primary" onClick={submitRename} focusKey="settings-rename-submit" onArrowPress={handleRenameArrow} className="min-w-[110px] justify-center whitespace-nowrap">确认重命名</OreButton>
          </div>
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

      <SettingsSection title={t('settings.data.sections.core')} icon={<Database size={18} />}>
        <FormRow
          label={t('settings.data.coreLocation')}
          description={`当前位置: ${basePath || "尚未配置"}\n将游戏实例、日志、启动器配置等核心数据完整迁移至新的目录。`}
          vertical={false}
          control={
            <OreButton variant="secondary" onClick={() => setBrowserOpen(true)} focusKey="settings-data-modify-dir" onArrowPress={handleLinearArrow} className="w-[200px] justify-center whitespace-nowrap">
              <LogOut size={16} className="mr-1.5" /> 修改目录并迁移
            </OreButton>
          }
        />
        <FormRow
          label={t('settings.data.renameDir')}
          description={t('settings.data.renameDirDesc')}
          vertical={false}
          control={
            <OreButton variant="secondary" onClick={openRenameModal} focusKey="settings-data-rename-dir" onArrowPress={handleLinearArrow} className="w-[200px] justify-center whitespace-nowrap">
              <Edit2 size={16} className="mr-1.5" /> 重命名文件夹
            </OreButton>
          }
        />
        <FormRow
          label={t('settings.data.cleanLogs')}
          description={t('settings.data.cleanLogsDesc', { path: basePath ? basePath + '/logs' : '' })}
          vertical={false}
          control={
            <OreButton
              variant="danger"
              onClick={() => setCleanLogsPhase('confirm')}
              focusKey="settings-data-clean-logs"
              onArrowPress={handleLinearArrow}
              className="w-[200px] justify-center whitespace-nowrap"
            >
              <FileX size={16} className="mr-1.5" /> 清理日志
            </OreButton>
          }
        />
      </SettingsSection>

      <SettingsSection title={t('settings.data.sections.thirdParty')} icon={<Archive size={18} />}>
        {thirdPartyDirs.length === 0 ? (
          <FormRow
            label={t('settings.data.thirdPartyList')}
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
                  onClick={() => setRemoveDirTarget(dir)}
                  focusKey={`settings-data-remove-dir-${idx}`}
                  onArrowPress={handleLinearArrow}
                  className="w-[200px] justify-center whitespace-nowrap"
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
