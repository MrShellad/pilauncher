// /src/features/InstanceDetail/components/tabs/BasicPanel.tsx
import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Trash2, ShieldCheck, Save, Loader2, CheckCircle2, Plus, X } from 'lucide-react';
import { BUTTON_TYPES, getButtonIcon } from '../../../../ui/icons/SocialIcons';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreModal } from '../../../../ui/primitives/OreModal';

import type { InstanceDetailData, CustomButton } from '../../../../hooks/pages/InstanceDetail/useInstanceDetail';

interface BasicPanelProps {
  data: InstanceDetailData;
  isInitializing: boolean;
  onUpdateName: (newName: string) => Promise<void>;
  onUpdateCover: () => Promise<void>;
  onUpdateCustomButtons: (buttons: CustomButton[]) => Promise<void>;
  onVerifyFiles: () => Promise<void>;
  onDelete: (skipConfirm?: boolean) => Promise<void>;
}

export const BasicPanel: React.FC<BasicPanelProps> = ({
  data,
  isInitializing,
  onUpdateName,
  onUpdateCover,
  onUpdateCustomButtons,
  onVerifyFiles,
  onDelete,
}) => {
  const [editName, setEditName] = useState(data.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [customButtons, setCustomButtons] = useState<CustomButton[]>(data.customButtons || []);

  useEffect(() => {
    setEditName(data.name);
    setCustomButtons(data.customButtons || []);
  }, [data.name, data.customButtons]);

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  const handleSaveName = async () => {
    if (editName !== data.name && editName.trim() !== '') {
      setIsSaving(true);
      await onUpdateName(editName);
      setIsSaving(false);
      triggerSuccess('名称已保存');
    } else {
      setEditName(data.name || '');
    }
  };

  const handleChangeCover = async () => {
    setIsSaving(true);
    await onUpdateCover();
    setIsSaving(false);
  };

  const handleSaveCustomButtons = async () => {
    setIsSaving(true);
    await onUpdateCustomButtons(customButtons);
    setIsSaving(false);
    triggerSuccess('自定义链接已保存');
  };

  const handleAddButton = () => {
    setCustomButtons([...customButtons, { type: 'wiki', url: '', label: '' }]);
  };

  const handleRemoveButton = (index: number) => {
    setCustomButtons(customButtons.filter((_, i) => i !== index));
  };

  const handleChangeButton = (index: number, field: keyof CustomButton, value: string) => {
    const newBtns = [...customButtons];
    newBtns[index] = { ...newBtns[index], [field]: value };
    setCustomButtons(newBtns);
  };

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    setIsSaving(true);
    setIsDeleteModalOpen(false);
    await onDelete(true); // Bypass native confirm inside hook
  };

  const isNameChanged = editName !== data.name && editName.trim() !== '';

  return (
    <SettingsPageLayout>
      {/* 移除了导致双重滚动条的 overflow-x-hidden */}
      <div className="relative flex flex-col w-full h-full">

        {/* ======================================================== */}
        {/* ✅ 新版焦点保险杠 (Focus Bumpers)：1px 贴边，完美 0 溢出！  */}
        {/* ======================================================== */}
        <FocusItem focusKey="basic-guard-top" onFocus={() => setFocus('basic-input-name')}>
          {({ ref }) => <div ref={ref as any} className="absolute top-0 left-0 w-full h-[1px] opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey="basic-guard-left" onFocus={() => setFocus('basic-input-name')}>
          {({ ref }) => <div ref={ref as any} className="absolute top-0 left-0 w-[1px] h-full opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey="basic-guard-right" onFocus={() => setFocus('basic-btn-change-cover')}>
          {({ ref }) => <div ref={ref as any} className="absolute top-0 right-0 w-[1px] h-full opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey="basic-guard-bottom" onFocus={() => setFocus('basic-btn-delete-instance')}>
          {({ ref }) => <div ref={ref as any} className="absolute bottom-0 left-0 w-full h-[1px] opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>

        <div className="flex justify-end h-6 mb-2 pr-6 font-minecraft transition-opacity duration-300">
          {successMsg && !isSaving && (
            <span className="text-ore-green text-sm flex items-center">
              <CheckCircle2 size={14} className="mr-1.5" /> {successMsg}
            </span>
          )}
        </div>

        <SettingsSection title="基本信息">

          {/* ✅ 恢复 FormRow 布局，输入框和按钮紧密同行排布，不破坏页面整体样式 */}
          <FormRow
            label="实例名称"
            description="用于在列表中显示的自定义名称。"
            control={
              // 设置 max-w-md 让整个控件区域有足够但不失控的宽度
              <div className="flex items-center space-x-2 w-full max-w-sm md:max-w-md">
                <div className="flex-1 min-w-0">
                  <OreInput
                    focusKey="basic-input-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                    }}
                    disabled={isSaving || isInitializing}
                    className="w-full bg-[#18181B] border-[#2A2A2C]"
                    placeholder="输入实例名称"
                  />
                </div>
                <OreButton
                  focusKey="basic-btn-save-name"
                  variant={isNameChanged ? 'primary' : 'secondary'}
                  onClick={handleSaveName}
                  disabled={!isNameChanged || isSaving || isInitializing}
                  className="flex-shrink-0"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                  保存
                </OreButton>
              </div>
            }
          />

          <FormRow
            label="实例封面"
            description="支持 .png 或 .jpg 格式，建议比例 16:9。"
            control={
              <div className="flex items-center space-x-4">
                <div className="w-32 h-20 bg-[#18181B] border-2 border-[#2A2A2C] rounded-sm flex items-center justify-center overflow-hidden shadow-inner relative">
                  {data.coverUrl ? (
                    <img src={data.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={24} className="text-ore-text-muted opacity-60" />
                  )}
                  {isSaving && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 size={24} className="animate-spin text-white" />
                    </div>
                  )}
                </div>
                <OreButton
                  focusKey="basic-btn-change-cover"
                  variant="secondary"
                  onClick={handleChangeCover}
                  disabled={isSaving || isInitializing}
                >
                  更换封面
                </OreButton>
              </div>
            }
          />
        </SettingsSection>

        <SettingsSection title="自定义链接管理">
          <p className="text-ore-text-muted text-xs mb-6 leading-relaxed opacity-80">
            为整合包添加快速链接按钮（Wiki、社区、官网等），将展示在主页和概览页。留空标题时将使用平台名称。
          </p>

          {/* 链接卡片列表 — 每条一张独立卡片，垂直排布 */}
          <div className="flex flex-col gap-3 mb-2">
            {customButtons.map((btn, idx) => {
              const IconComp = getButtonIcon(btn.type);
              return (
                <div
                  key={idx}
                  className="bg-[#18181B] border border-[#2A2A2C] rounded-sm p-4 space-y-3 hover:border-[#3A3A3C] transition-colors"
                >
                  {/* 卡片顶部：类型选择 + 删除按钮 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-white/60">
                        <IconComp size={18} />
                      </span>
                      <select
                        value={btn.type}
                        onChange={(e) => handleChangeButton(idx, 'type', e.target.value)}
                        disabled={isSaving || isInitializing}
                        className="bg-[#1E1E1F] border border-[#2A2A2C] text-white text-sm px-2 py-1 rounded-sm focus:outline-none focus:border-white/40 cursor-pointer transition-colors"
                      >
                        {BUTTON_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => handleRemoveButton(idx)}
                      disabled={isSaving || isInitializing}
                      title="删除此链接"
                      className="w-7 h-7 flex items-center justify-center text-ore-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-sm transition-colors disabled:opacity-40"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* 卡片下部：标题 + URL 两个输入框 */}
                  <div className="flex gap-3">
                    <div className="w-40 flex-shrink-0">
                      <OreInput
                        focusKey={`btn-label-${idx}`}
                        value={btn.label || ''}
                        onChange={(e) => handleChangeButton(idx, 'label', e.target.value)}
                        disabled={isSaving || isInitializing}
                        placeholder="自定义标题"
                        className="bg-[#1E1E1F] border-[#2A2A2C]"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <OreInput
                        focusKey={`btn-url-${idx}`}
                        value={btn.url}
                        onChange={(e) => handleChangeButton(idx, 'url', e.target.value)}
                        disabled={isSaving || isInitializing}
                        placeholder="https://..."
                        className="bg-[#1E1E1F] border-[#2A2A2C]"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 空状态提示 */}
          {customButtons.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-ore-text-muted border border-dashed border-[#2A2A2C] rounded-sm mb-4">
              <span className="text-sm font-minecraft">暂无自定义链接</span>
              <span className="text-xs mt-1 opacity-60">点击「添加链接」按钮开始配置</span>
            </div>
          )}

          {/* 操作栏 */}
          <div className="flex items-center gap-3 px-0 py-4 border-t border-[#2A2A2C] mt-1">
            <OreButton
              focusKey="btn-add-link"
              variant="secondary"
              onClick={handleAddButton}
              disabled={isSaving || isInitializing}
            >
              <Plus size={15} className="mr-1.5" /> 添加链接
            </OreButton>

            <div className="flex-1" />

            <OreButton
              focusKey="btn-save-links"
              variant="primary"
              onClick={handleSaveCustomButtons}
              disabled={isSaving || isInitializing}
            >
              {isSaving
                ? <Loader2 size={15} className="animate-spin mr-1.5" />
                : <Save size={15} className="mr-1.5" />}
              保存链接
            </OreButton>
          </div>
        </SettingsSection>

        <SettingsSection title="实例维护">
          <FormRow
            label="补全缺失文件"
            description="自动检查并重新下载缺失的核心文件、运行库或依赖资源。"
            control={
              <OreButton
                focusKey="basic-btn-verify-files"
                variant="primary"
                onClick={onVerifyFiles}
                disabled={isSaving || isInitializing}
              >
                <ShieldCheck size={18} className="mr-2" /> 校验并补全
              </OreButton>
            }
          />
        </SettingsSection>

        <SettingsSection title="危险区域" danger>
          <FormRow
            label="彻底删除实例"
            description="此操作不可逆，将永久删除该实例的所有文件。"
            control={
              <OreButton
                focusKey="basic-btn-delete-instance"
                variant="danger"
                onClick={handleDelete}
                disabled={isSaving || isInitializing}
              >
                <Trash2 size={18} className="mr-2" /> 彻底删除
              </OreButton>
            }
          />
        </SettingsSection>

        {/* ======================================================== */}
        {/*           删除确认弹窗 (Delete Confirmation)              */}
        {/* ======================================================== */}
        <OreModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="警告：彻底删除实例"
          className="w-[450px]"
          actions={
            <>
              <OreButton
                focusKey="basic-modal-btn-cancel"
                variant="secondary"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1"
              >
                取消
              </OreButton>
              <OreButton
                focusKey="basic-modal-btn-confirm"
                variant="danger"
                onClick={confirmDelete}
                className="flex-1"
                disabled={isSaving}
              >
                {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Trash2 size={16} className="mr-2" />}
                彻底删除
              </OreButton>
            </>
          }
        >
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <Trash2 size={32} className="text-red-500" />
            </div>
            <p className="text-white text-lg mb-2">
              您确定要彻底删除实例 <span className="font-bold text-ore-red">"{data.name}"</span> 吗？
            </p>
            <p className="text-ore-text-muted text-sm px-4">
              此操作无法撤销，与其相关的所有存档和 MOD 都将被永久清除！
            </p>
          </div>
        </OreModal>

      </div>
    </SettingsPageLayout>
  );
};