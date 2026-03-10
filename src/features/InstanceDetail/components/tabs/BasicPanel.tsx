// /src/features/InstanceDetail/components/tabs/BasicPanel.tsx
import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Trash2, ShieldCheck, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';
import { FocusItem } from '../../../../ui/focus/FocusItem';

import type { InstanceDetailData } from '../../../../hooks/pages/InstanceDetail/useInstanceDetail';

interface BasicPanelProps {
  data: InstanceDetailData;
  isInitializing: boolean;
  onUpdateName: (newName: string) => Promise<void>;
  onUpdateCover: () => Promise<void>;
  onVerifyFiles: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export const BasicPanel: React.FC<BasicPanelProps> = ({
  data,
  isInitializing,
  onUpdateName,
  onUpdateCover,
  onVerifyFiles,
  onDelete,
}) => {
  const [editName, setEditName] = useState(data.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setEditName(data.name);
  }, [data.name]);

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

  const handleDelete = async () => {
    if (window.confirm(`确定要彻底删除实例 "${data.name}" 吗？此操作无法撤销！`)) {
      setIsSaving(true);
      await onDelete();
    }
  };

  const isNameChanged = editName !== data.name && editName.trim() !== '';

  return (
    <SettingsPageLayout title="基础设置" subtitle="Basic Settings">
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

      </div>
    </SettingsPageLayout>
  );
};