// /src/features/InstanceDetail/components/tabs/BasicPanel.tsx
import React, { useState, useEffect } from 'react';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { Image as ImageIcon, Trash2, ShieldCheck, Save, Loader2, CheckCircle2 } from 'lucide-react';
import type { InstanceDetailData } from '../../../../hooks/pages/InstanceDetail/useInstanceDetail';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';

interface BasicPanelProps {
  data: InstanceDetailData;
  isInitializing: boolean;
  onUpdateName: (newName: string) => Promise<void>;
  onUpdateCover: () => Promise<void>;
  onVerifyFiles: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export const BasicPanel: React.FC<BasicPanelProps> = ({ 
  data, isInitializing, onUpdateName, onUpdateCover, onVerifyFiles, onDelete 
}) => {
  const [editName, setEditName] = useState(data.name || '');
  
  // 仅负责 UI 的保存状态反馈
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // 监听外部数据变化
  useEffect(() => {
    setEditName(data.name);
  }, [data.name]);

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  // 1. 触发修改名称
  const handleSaveName = async () => {
    if (!editName.trim() || editName === data.name) return;
    setIsSaving(true);
    try {
      await onUpdateName(editName.trim());
      triggerSuccess('名称已更新');
    } catch (error) {
      console.error('修改名称失败:', error);
      setEditName(data.name); // 失败时回退输入框
    } finally {
      setIsSaving(false);
    }
  };

  // 2. 触发更换封面
  const handleChangeCover = async () => {
    setIsSaving(true);
    try {
      await onUpdateCover();
      triggerSuccess('封面已更新');
    } catch (error: any) {
      if (error.message !== "USER_CANCELED") {
        console.error('更换封面失败:', error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // 3. 触发彻底删除
  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await onDelete();
    } catch (error) {
      console.error('删除实例失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsPageLayout title="基础设置" subtitle="Basic Configuration">
      <div className="flex justify-end h-6 mb-2 pr-6 font-minecraft transition-opacity duration-300">
        {isSaving && (
          <span className="text-ore-text-muted text-sm flex items-center">
            <Loader2 size={14} className="animate-spin mr-1.5" /> 处理中...
          </span>
        )}
        {successMsg && !isSaving && (
          <span className="text-ore-green text-sm flex items-center drop-shadow-[0_0_5px_rgba(56,133,39,0.5)]">
            <CheckCircle2 size={14} className="mr-1.5" /> {successMsg}
          </span>
        )}
      </div>

      <SettingsSection title="实例信息">
        <FormRow 
          label="实例名称"
          description="修改该实例在启动器中显示的名称标识。"
          control={
            <div className="flex items-center space-x-2">
              <OreInput 
                value={editName} 
                onChange={(e) => setEditName(e.target.value)} 
                containerClassName="w-48 md:w-64"
                disabled={isSaving || isInitializing}
              />
              <OreButton 
                variant="secondary" 
                onClick={handleSaveName} 
                disabled={editName === data.name || !editName.trim() || isSaving || isInitializing}
              >
                <Save size={18} />
              </OreButton>
            </div>
          }
        />

        <FormRow 
          label="封面图像"
          description="推荐使用 16:9 比例的图片。更换后图片将自动拷贝至实例专属的 piconfig 配置目录中。"
          control={
            <div className="flex items-center space-x-4">
              <div className="w-32 md:w-40 aspect-video bg-[#141415] border-2 border-dashed border-ore-gray-border flex items-center justify-center overflow-hidden shadow-inner flex-shrink-0 relative">
                
                {isInitializing ? (
                  <Loader2 size={24} className="animate-spin text-ore-text-muted opacity-50" />
                ) : data.coverUrl ? (
                  <img src={data.coverUrl} className="w-full h-full object-cover" alt="Cover" draggable={false} />
                ) : (
                  <ImageIcon size={24} className="text-ore-text-muted opacity-60" />
                )}

                {isSaving && (
                   <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 size={24} className="animate-spin text-white" />
                   </div>
                )}
              </div>
              <OreButton variant="secondary" onClick={handleChangeCover} disabled={isSaving || isInitializing}>
                更换封面
              </OreButton>
            </div>
          }
        />
      </SettingsSection>

      <SettingsSection title="实例维护">
        <FormRow 
          label="补全缺失文件"
          description="自动检查并重新下载实例缺失的 Minecraft 核心文件、运行库或依赖资源。"
          control={
            <OreButton variant="primary" onClick={onVerifyFiles} disabled={isSaving || isInitializing}>
              <ShieldCheck size={18} className="mr-2" /> 校验并补全
            </OreButton>
          }
        />
      </SettingsSection>

      <SettingsSection title="危险区域" danger>
        <FormRow 
          label="彻底删除实例"
          description="此操作不可逆！将会彻底从硬盘中删除该实例的所有文件、MOD 和存档。"
          control={
            <OreButton variant="danger" onClick={handleDelete} disabled={isSaving || isInitializing}>
              <Trash2 size={18} className="mr-2" /> 彻底删除
            </OreButton>
          }
        />
      </SettingsSection>
    </SettingsPageLayout>
  );
};