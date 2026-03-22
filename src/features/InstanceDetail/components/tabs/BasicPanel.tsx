// /src/features/InstanceDetail/components/tabs/BasicPanel.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Image as ImageIcon,
  Trash2,
  ShieldCheck,
  Save,
  Loader2,
  CheckCircle2,
  Plus,
  X,
  FileText,
  Link2,
  Wrench,
  AlertTriangle
} from 'lucide-react';
import { BUTTON_TYPES, getButtonIcon } from '../../../../ui/icons/SocialIcons';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
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

  const handleDelete = () => setIsDeleteModalOpen(true);

  const confirmDelete = async () => {
    setIsSaving(true);
    setIsDeleteModalOpen(false);
    await onDelete(true);
  };

  const isNameChanged = editName !== data.name && editName.trim() !== '';

  const dropdownOptions = useMemo(() => {
    return BUTTON_TYPES.map(t => ({ label: t.label, value: t.value }));
  }, []);

  return (
    <SettingsPageLayout>
      <div className="relative flex flex-col w-full h-full">

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
          {isSaving && (
            <span className="text-ore-text-muted text-sm flex items-center">
              <Loader2 size={14} className="animate-spin mr-1.5" /> 正在保存...
            </span>
          )}
          {successMsg && !isSaving && (
            <span className="text-ore-green text-sm flex items-center drop-shadow-[0_0_5px_rgba(56,133,39,0.5)]">
              <CheckCircle2 size={14} className="mr-1.5" /> {successMsg}
            </span>
          )}
        </div>

        {/* ==================== 1. 基本信息 ==================== */}
        <SettingsSection title="基本信息" icon={<FileText size={18} />}>
          <FormRow
            label="实例名称"
            description="用于在列表中显示的自定义名称。"
            className="!lg:items-center"
            control={
              <div className="flex items-center gap-3 w-full lg:w-[480px]">
                <OreInput
                  focusKey="basic-input-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  disabled={isSaving || isInitializing}
                  placeholder="输入实例名称"
                  containerClassName="flex-1"
                />
                <OreButton
                  focusKey="basic-btn-save-name"
                  variant={isNameChanged ? 'primary' : 'secondary'}
                  onClick={handleSaveName}
                  disabled={!isNameChanged || isSaving || isInitializing}
                  className="flex-shrink-0"
                >
                  <Save size={16} className="mr-2" /> 保存
                </OreButton>
              </div>
            }
          />

          <FormRow
            label="实例封面"
            description="支持 .png 或 .jpg 格式，建议比例 16:9。"
            control={
              <div className="flex items-center gap-4">
                <div className="w-32 h-18 bg-[#141415] border-2 border-[#1E1E1F] rounded-sm flex items-center justify-center overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] relative">
                  {data.coverUrl ? (
                    <img src={data.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={24} className="text-ore-text-muted opacity-60" />
                  )}
                  {isSaving && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
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

        {/* ==================== 2. 自定义链接管理 ==================== */}
        <SettingsSection title="自定义链接管理" icon={<Link2 size={18} />}>
          <div className="px-6 py-4 bg-[#141415]/50 border-b-2 border-white/5 mb-4">
            <p className="font-minecraft text-sm text-ore-text-muted leading-relaxed">
              为整合包添加快速链接按钮（如 Wiki、社区、官网等），将展示在主页和概览页。留空标题时将使用平台名称。
            </p>
          </div>

          <div className="px-6 space-y-2 mb-6">
            {customButtons.map((btn, idx) => {
              const IconComp = getButtonIcon(btn.type);

              return (
                <div
                  key={idx}
                  className="flex flex-col lg:flex-row items-center gap-2 p-2 bg-[#18181B] border-2 border-[#2A2A2C] rounded-sm transition-colors hover:border-[#3A3A3C]"
                >
                  {/* ✅ 直接使用强化后的 OreDropdown，依靠 prefixNode 完美内嵌图标 */}
                  <div className="w-full lg:w-[160px] flex-shrink-0">
                    <OreDropdown
                      focusKey={`btn-type-select-${idx}`}
                      options={dropdownOptions}
                      value={btn.type}
                      onChange={(val) => handleChangeButton(idx, 'type', val)}
                      disabled={isSaving || isInitializing}
                      prefixNode={<IconComp size={18} />}
                      className="w-full"
                    />
                  </div>

                  {/* 默认高度 40px，完美与下拉框对齐 */}
                  <div className="w-full lg:w-[140px] flex-shrink-0">
                    <OreInput
                      focusKey={`btn-label-${idx}`}
                      value={btn.label || ''}
                      onChange={(e) => handleChangeButton(idx, 'label', e.target.value)}
                      disabled={isSaving || isInitializing}
                      placeholder="自定义标题"
                    />
                  </div>

                  <div className="flex-1 w-full min-w-[200px]">
                    <OreInput
                      focusKey={`btn-url-${idx}`}
                      value={btn.url}
                      onChange={(e) => handleChangeButton(idx, 'url', e.target.value)}
                      disabled={isSaving || isInitializing}
                      placeholder="https://..."
                    />
                  </div>

                  {/* 提高删除按钮至 40px */}
                  <FocusItem focusKey={`btn-remove-${idx}`}>
                    {({ ref, focused }) => (
                      <button
                        ref={ref as any}
                        onClick={() => handleRemoveButton(idx)}
                        disabled={isSaving || isInitializing}
                        className={`w-10 h-10 flex items-center justify-center rounded-sm outline-none transition-all flex-shrink-0 ${focused ? 'bg-red-500/20 text-red-400 ring-2 ring-red-400 z-10' : 'text-ore-text-muted hover:text-white hover:bg-[#2A2A2C]'
                          } disabled:opacity-40`}
                        title="删除链接"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </FocusItem>
                </div>
              );
            })}

            {customButtons.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-[#1E1E1F] bg-[#141415]/20">
                <Link2 size={24} className="text-ore-text-muted opacity-40 mb-2" />
                <span className="text-sm text-ore-text-muted font-minecraft">暂无自定义链接</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-6 pb-6 border-t border-white/5 pt-4 mt-2">
            <OreButton
              focusKey="btn-add-link"
              variant="secondary"
              onClick={handleAddButton}
              disabled={isSaving || isInitializing}
            >
              <Plus size={16} className="mr-1.5" /> 添加链接
            </OreButton>

            <OreButton
              focusKey="btn-save-links"
              variant="primary"
              onClick={handleSaveCustomButtons}
              disabled={isSaving || isInitializing || customButtons.length === 0}
            >
              <Save size={16} className="mr-1.5" /> 保存配置
            </OreButton>
          </div>
        </SettingsSection>

        {/* ==================== 3. 实例维护 ==================== */}
        <SettingsSection title="实例维护" icon={<Wrench size={18} />}>
          <FormRow
            label="补全缺失文件"
            description="自动检查并重新下载缺失的核心文件、运行库或依赖资源。"
            control={
              <OreButton
                focusKey="basic-btn-verify-files"
                variant="secondary"
                onClick={onVerifyFiles}
                disabled={isSaving || isInitializing}
                className="w-40"
              >
                <ShieldCheck size={16} className="mr-2" /> 校验补全
              </OreButton>
            }
          />
        </SettingsSection>

        {/* ==================== 4. 危险区域 ==================== */}
        <SettingsSection title="危险区域" icon={<AlertTriangle size={18} />} danger>
          <FormRow
            label="彻底删除实例"
            description="此操作不可逆，将永久删除该实例的所有本地文件与存档。"
            control={
              <OreButton
                focusKey="basic-btn-delete-instance"
                variant="danger"
                onClick={handleDelete}
                disabled={isSaving || isInitializing}
                className="w-40"
              >
                <Trash2 size={16} className="mr-2" /> 彻底删除
              </OreButton>
            }
          />
        </SettingsSection>

        {/* 彻底删除弹窗 */}
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
                强制删除
              </OreButton>
            </>
          }
        >
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border-2 border-red-500/20 shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]">
              <Trash2 size={32} className="text-red-500" />
            </div>
            <p className="text-white text-lg mb-2 font-minecraft">
              您确定要彻底删除实例 <span className="font-bold text-red-400">"{data.name}"</span> 吗？
            </p>
            <p className="text-ore-text-muted text-sm px-4">
              此操作无法撤销，与其相关的所有配置、模组以及游戏存档都将被永久清除！
            </p>
          </div>
        </OreModal>

      </div>
    </SettingsPageLayout>
  );
};