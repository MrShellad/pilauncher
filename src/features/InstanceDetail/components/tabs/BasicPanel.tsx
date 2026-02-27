// /src/features/InstanceDetail/components/tabs/BasicPanel.tsx
import React, { useState, useEffect } from 'react';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { Image as ImageIcon, Trash2, ShieldCheck, Save } from 'lucide-react';
import type { InstanceDetailData } from '../../../../hooks/pages/InstanceDetail/useInstanceDetail';

// 引入刚刚封装好的通用设置布局组件
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';

interface BasicPanelProps {
  data: InstanceDetailData;
  onUpdateName: (newName: string) => void;
  onUpdateCover: () => void;
  onVerifyFiles: () => void;
  onDelete: () => void;
}

export const BasicPanel: React.FC<BasicPanelProps> = ({ 
  data, onUpdateName, onUpdateCover, onVerifyFiles, onDelete 
}) => {
  const [editName, setEditName] = useState(data.name);

  useEffect(() => {
    setEditName(data.name);
  }, [data.name]);

  return (
    // 1. 最外层：统一的页面结构、最大宽度和标题
    <SettingsPageLayout title="基础设置" subtitle="Basic Configuration">
      
      {/* 2. 区块一：实例信息 */}
      <SettingsSection title="实例信息">
        
        {/* 行 1：修改名称 */}
        <FormRow 
          label="实例名称"
          description="修改该实例在启动器中显示的名称标识。"
          control={
            <div className="flex items-center space-x-2">
              {/* 注意：去掉了 OreInput 的 label，因为 FormRow 已经提供了 */}
              <OreInput 
                value={editName} 
                onChange={(e) => setEditName(e.target.value)} 
                containerClassName="w-48 md:w-64"
              />
              <OreButton 
                variant="secondary" 
                onClick={() => onUpdateName(editName)} 
                disabled={editName === data.name || !editName.trim()}
              >
                <Save size={18} />
              </OreButton>
            </div>
          }
        />

        {/* 行 2：修改封面 */}
        <FormRow 
          label="封面图像"
          description="推荐使用 16:9 比例的图片。更换后图片将自动拷贝至实例配置目录中。"
          control={
            <div className="flex items-center space-x-4">
              <div className="w-32 md:w-40 aspect-video bg-[#141415] border-2 border-dashed border-ore-gray-border flex items-center justify-center overflow-hidden shadow-inner flex-shrink-0">
                {data.coverUrl ? (
                  <img src={data.coverUrl} className="w-full h-full object-cover" alt="Cover" draggable={false} />
                ) : (
                  <ImageIcon size={24} className="text-ore-text-muted opacity-60" />
                )}
              </div>
              <OreButton variant="secondary" onClick={onUpdateCover}>
                更换封面
              </OreButton>
            </div>
          }
        />
      </SettingsSection>

      {/* 3. 区块二：实例维护 */}
      <SettingsSection title="实例维护">
        <FormRow 
          label="补全缺失文件"
          description="自动检查并重新下载实例缺失的 Minecraft 核心文件、运行库或依赖资源。"
          control={
            <OreButton variant="primary" onClick={onVerifyFiles}>
              <ShieldCheck size={18} className="mr-2" /> 校验并补全
            </OreButton>
          }
        />
      </SettingsSection>

      {/* 4. 区块三：危险区域 (开启 danger 模式) */}
      <SettingsSection title="危险区域" danger>
        <FormRow 
          label="彻底删除实例"
          description="此操作不可逆！将会彻底从硬盘中删除该实例的所有文件、MOD 和存档。"
          control={
            <OreButton variant="danger" onClick={onDelete}>
              <Trash2 size={18} className="mr-2" /> 彻底删除
            </OreButton>
          }
        />
      </SettingsSection>

    </SettingsPageLayout>
  );
};