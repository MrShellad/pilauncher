import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { Download, RotateCw, Save, Trash2, Upload } from 'lucide-react';

import { useToastStore } from '@/shared/stores/useToastStore';
import { OreButton } from '@/ui/primitives/OreButton';
import { OreConfirmDialog } from '@/ui/primitives/OreConfirmDialog';
import { OreModal } from '@/ui/primitives/OreModal';
import { OreOverlayScrollArea } from '@/ui/primitives/OreOverlayScrollArea';
import { OreToggleButton } from '@/ui/primitives/OreToggleButton';

import type { KeyBind, KeyboardProfile, KeyboardProfileListItem } from './keymapTypes';

interface KeymapProfileManagerProps {
  isOpen: boolean;
  instanceId: string;
  keybindings: KeyBind[];
  onClose: () => void;
  onKeybindingsChange: (keybindings: KeyBind[]) => void;
  onReload: () => Promise<void> | void;
}

const ProfileRow = ({
  item,
  actionLabel,
  actionFocusKey,
  onAction,
}: {
  item: KeyboardProfileListItem;
  actionLabel: string;
  actionFocusKey: string;
  onAction: () => void;
}) => (
  <div className="grid grid-cols-[2fr_1.2fr] items-center px-[1rem] py-[0.75rem] transition-colors hover:bg-white/5">
    <div className="flex min-w-0 flex-col pr-[1rem]">
      <span className="truncate text-[1.0625rem] font-bold text-white">{item.profile.name}</span>
      <span className="mt-[0.125rem] truncate text-[0.875rem] text-ore-text-muted">
        {item.profile.description || `版本 ${item.profile.version} • 由 ${item.profile.author} 创建`}
      </span>
    </div>
    <div className="flex items-center justify-end">
      <OreButton focusKey={actionFocusKey} variant="secondary" size="auto" onClick={onAction}>
        <span className="text-[0.9375rem]">{actionLabel}</span>
      </OreButton>
    </div>
  </div>
);

export const KeymapProfileManager = ({
  isOpen,
  instanceId,
  keybindings,
  onClose,
  onKeybindingsChange,
  onReload,
}: KeymapProfileManagerProps) => {
  const addToast = useToastStore((state) => state.addToast);
  const [activeTab, setActiveTab] = useState<'apply' | 'manage'>('apply');
  const [newProfileName, setNewProfileName] = useState('');
  const [presetProfiles, setPresetProfiles] = useState<KeyboardProfileListItem[]>([]);
  const [userProfiles, setUserProfiles] = useState<KeyboardProfileListItem[]>([]);
  const [hasBackup, setHasBackup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<KeyboardProfile | null | undefined>(undefined);

  const loadProfiles = async () => {
    try {
      const [presets, users, backupExists] = await Promise.all([
        invoke<KeyboardProfileListItem[]>('list_presets'),
        invoke<KeyboardProfileListItem[]>('list_user_profiles'),
        invoke<boolean>('has_options_backup', { instanceId }),
      ]);
      setPresetProfiles(presets);
      setUserProfiles(users);
      setHasBackup(backupExists);
    } catch (error) {
      console.error('加载按键配置模板失败:', error);
    }
  };

  useEffect(() => {
    if (isOpen) void loadProfiles();
  }, [isOpen, instanceId]);

  const saveCurrentProfile = async () => {
    const name = newProfileName.trim()
      || `配置_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();
    const profile: KeyboardProfile = {
      name,
      author: '用户',
      createdAt: now,
      updatedAt: now,
      description: '用户自定义备份的按键配置。',
      version: '1.0.0',
      keybindings: [...keybindings],
    };

    setSaving(true);
    try {
      await invoke('save_user_profile', { filename: name, profile });
      setNewProfileName('');
      addToast('success', `配置模板 "${name}" 保存成功！`, 2400);
      await loadProfiles();
    } catch (error) {
      console.error('保存配置模板失败:', error);
      addToast('error', '保存配置模板失败', 3000);
    } finally {
      setSaving(false);
    }
  };

  const applyProfile = async (profile: KeyboardProfile) => {
    setSaving(true);
    try {
      await invoke('backup_instance_options_file', { instanceId });
      await invoke('save_instance_keybindings', { instanceId, keybindings: profile.keybindings });
      onKeybindingsChange(profile.keybindings);
      addToast('success', `成功应用配置模板 "${profile.name}"，原 options.txt 已备份！`, 3000);
      onClose();
    } catch (error) {
      console.error('应用配置模板失败:', error);
      addToast('error', '应用配置模板失败，请检查配置文件是否可写入', 3000);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    setSaving(true);
    try {
      await invoke('backup_instance_options_file', { instanceId });
      await invoke('initialize_default_keybindings', { instanceId });
      await onReload();
      addToast('success', '默认按键已恢复，原 options.txt 已备份！', 2400);
    } catch (error) {
      console.error('恢复默认按键配置失败:', error);
      addToast('error', '恢复默认按键配置失败', 3000);
    } finally {
      setSaving(false);
    }
  };

  const restoreBackup = async () => {
    setSaving(true);
    try {
      await invoke('restore_instance_options_backup', { instanceId });
      await onReload();
      addToast('success', '已成功恢复最初备份的按键配置！', 3000);
      onClose();
    } catch (error) {
      console.error('恢复备份失败:', error);
      addToast('error', '恢复备份失败，请检查文件是否损坏', 3000);
    } finally {
      setSaving(false);
    }
  };

  const deleteProfile = async (filename: string) => {
    try {
      await invoke('delete_user_profile', { filename });
      addToast('success', '已删除该配置模板', 2000);
      await loadProfiles();
    } catch (error) {
      console.error('删除配置模板失败:', error);
      addToast('error', '删除配置模板失败', 3000);
    }
  };

  const exportProfile = async (profile: KeyboardProfile) => {
    try {
      const path = await saveDialog({
        defaultPath: `${profile.name}.json`,
        filters: [{ name: 'PiLauncher Keymap Profile', extensions: ['json'] }],
      });
      if (!path) return;
      await invoke('write_keybindings_file', { path, keybindings: profile.keybindings });
      addToast('success', `成功导出配置文件到: ${path}`, 3000);
    } catch (error) {
      console.error('导出配置文件失败:', error);
      addToast('error', '导出配置文件失败', 3000);
    }
  };

  const importProfile = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: '按键配置文件', extensions: ['json', 'txt'] }],
      });
      const path = Array.isArray(selected) ? selected[0] : selected;
      if (!path) return;
      const importedBindings = await invoke<KeyBind[]>('read_keybindings_file', { path });
      if (!importedBindings.length) {
        addToast('error', '文件中没有包含有效的按键绑定项', 3000);
        return;
      }
      const filename = path.split(/[/\\]/).pop() || '未命名导入配置';
      const name = filename.replace(/\.(json|txt)$/i, '');
      const now = new Date().toISOString();
      const profile: KeyboardProfile = {
        name: `导入-${name}`,
        author: '外部导入',
        createdAt: now,
        updatedAt: now,
        description: `从文件 ${filename} 导入的按键配置。`,
        version: '1.0.0',
        keybindings: importedBindings,
      };
      await invoke('save_user_profile', { filename: `import-${name}`, profile });
      addToast('success', `成功导入配置模板: ${name}`, 2400);
      await loadProfiles();
    } catch (error) {
      console.error('导入配置文件失败:', error);
      addToast('error', `导入失败: ${error}`, 3000);
    }
  };

  return (
    <>
      <OreModal
        isOpen={isOpen}
        onClose={onClose}
        title="按钮配置管理"
        className="z-[9999] w-[min(42rem,96vw)]"
        contentClassName="p-[1.5rem] text-center font-minecraft"
        actions={
          <OreButton focusKey="btn-close-config-modal" variant="primary" size="full" onClick={onClose}>
            <span className="text-[1.0625rem]">返回主界面</span>
          </OreButton>
        }
      >
        <div className="flex flex-col gap-[1.25rem] text-left font-minecraft">
          <OreToggleButton
            options={[{ label: '应用配置', value: 'apply' }, { label: '管理配置', value: 'manage' }]}
            value={activeTab}
            onChange={(value) => setActiveTab(value as 'apply' | 'manage')}
            size="md"
            focusKeyPrefix="btn-config-tab"
            className="w-full"
          />

          <div className="flex h-[22rem] min-h-[22rem] flex-col">
            {activeTab === 'apply' ? (
              <div className="flex h-full flex-col overflow-hidden rounded-[2px] border-[0.125rem] border-ore-gray-border bg-[#141415]">
                <div className="grid grid-cols-[2fr_1.2fr] border-b-[0.125rem] border-ore-gray-border bg-[#1E1E1F] px-[1rem] py-[0.625rem] text-[1.0625rem] font-bold uppercase tracking-[0.08em] text-ore-text-muted">
                  <span>按键配置模板</span><span className="text-right">操作</span>
                </div>
                <OreOverlayScrollArea className="min-h-[14rem] flex-1" contentClassName="divide-y-[0.125rem] divide-ore-gray-border/40">
                  <div className="bg-black/10 px-[1rem] py-[0.5rem] text-[0.875rem] font-bold uppercase tracking-wider text-ore-green">社区推荐配置</div>
                  {presetProfiles.length ? presetProfiles.map((item) => (
                    <ProfileRow key={item.filename} item={item} actionLabel="使用配置" actionFocusKey={`apply-preset-${item.filename}`} onAction={() => setPendingProfile(item.profile)} />
                  )) : <div className="py-[1.5rem] text-center text-[0.9375rem] font-bold text-ore-text-muted">暂无推荐预设</div>}
                  <div className="bg-black/10 px-[1rem] py-[0.5rem] text-[0.875rem] font-bold uppercase tracking-wider text-[#8e8e93]">本地备份的配置</div>
                  {userProfiles.length ? userProfiles.map((item) => (
                    <ProfileRow key={item.filename} item={item} actionLabel="应用" actionFocusKey={`apply-local-${item.filename}`} onAction={() => setPendingProfile(item.profile)} />
                  )) : <div className="py-[2.5rem] text-center text-[1rem] font-bold text-ore-text-muted">暂无本地保存的配置模板</div>}
                </OreOverlayScrollArea>
              </div>
            ) : (
              <div className="flex h-full flex-col gap-[1.25rem] overflow-y-auto pr-[0.25rem] custom-scrollbar">
                <div className="flex flex-col gap-[0.75rem] rounded-[2px] border-[0.125rem] border-ore-gray-border bg-black/20 p-[1.125rem]">
                  <div className="flex items-center gap-[0.5rem] text-[1.125rem] font-bold text-white"><Save size="1.125rem" className="text-ore-green" />保存当前按键配置</div>
                  <div className="flex items-center gap-[0.75rem]">
                    <input value={newProfileName} onChange={(event) => setNewProfileName(event.target.value)} placeholder="输入配置模板名称..." className="flex-1 rounded-[2px] border-[0.125rem] border-ore-gray-border bg-[#141415] px-[0.75rem] py-[0.5rem] text-[1.0625rem] text-white outline-none focus:border-ore-green" />
                    <OreButton focusKey="btn-save-current-profile" variant="primary" size="auto" onClick={() => void saveCurrentProfile()} disabled={saving}>保存模板</OreButton>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-[1rem]">
                  <OreButton focusKey="btn-import-profile-file-tab2" variant="secondary" size="full" onClick={() => void importProfile()}><Download size="1rem" />导入配置文件</OreButton>
                  <div className="flex gap-[0.5rem]">
                    {hasBackup && <OreButton focusKey="btn-restore-backup-tab2" variant="secondary" size="full" onClick={() => void restoreBackup()} disabled={saving}><RotateCw size="1rem" />恢复备份</OreButton>}
                    <OreButton focusKey="btn-reset-to-default-tab2" variant="secondary" size="full" onClick={() => setPendingProfile(null)} disabled={saving}><RotateCw size="1rem" />官方默认</OreButton>
                  </div>
                </div>

                <div className="flex min-h-[12rem] flex-col overflow-hidden rounded-[2px] border-[0.125rem] border-ore-gray-border bg-[#141415]">
                  <div className="border-b-[0.125rem] border-ore-gray-border bg-[#1E1E1F] px-[1rem] py-[0.625rem] text-[1rem] font-bold uppercase tracking-[0.08em] text-ore-text-muted">本地备份的配置管理</div>
                  {userProfiles.length ? userProfiles.map((item) => (
                    <div key={item.filename} className="grid grid-cols-[2fr_1.2fr] items-center px-[1rem] py-[0.75rem]">
                      <span className="truncate text-[1.0625rem] font-bold text-white">{item.profile.name}</span>
                      <div className="flex justify-end gap-[0.5rem]">
                        <OreButton focusKey={`export-local-manage-${item.filename}`} variant="ghost" size="auto" onClick={() => void exportProfile(item.profile)}><Upload size="0.875rem" /></OreButton>
                        <OreButton focusKey={`delete-local-manage-${item.filename}`} variant="danger" size="auto" onClick={() => void deleteProfile(item.filename)}><Trash2 size="0.875rem" /></OreButton>
                      </div>
                    </div>
                  )) : <div className="flex flex-1 items-center justify-center text-ore-text-muted">暂无本地保存的配置模板</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </OreModal>

      <OreConfirmDialog
        isOpen={pendingProfile !== undefined}
        onClose={() => setPendingProfile(undefined)}
        onConfirm={async () => {
          if (pendingProfile) await applyProfile(pendingProfile);
          else await resetToDefault();
          setPendingProfile(undefined);
        }}
        title="确认覆盖按键配置"
        headline={pendingProfile ? `确定要应用配置 "${pendingProfile.name}" 吗？` : '确定要恢复官方默认按键配置吗？'}
        description="这将覆盖当前实例的按键映射。系统会自动备份最初的 options.txt 配置文件。"
        confirmLabel="确认覆盖"
        cancelLabel="取消"
        confirmVariant="primary"
        tone="warning"
      />
    </>
  );
};
