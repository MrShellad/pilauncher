// /src/features/InstanceDetail/components/tabs/ShaderPanel.tsx
import React from 'react';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { OreList } from '../../../../ui/primitives/OreList';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { Image as ImageIcon, FolderOpen, Loader2, Trash2, Power } from 'lucide-react';
import { useResourceManager } from '../../hooks/useResourceManager';

export const ShaderPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { items, isLoading, toggleItem, deleteItem, openFolder, formatSize } = useResourceManager(instanceId, 'shader');

  return (
    <SettingsPageLayout title="光影管理" subtitle="Shader Packs">
      <div className="flex justify-between items-center mb-6 bg-[#18181B] p-4 border-2 border-[#2A2A2C]">
        <div>
          <h3 className="text-white font-minecraft flex items-center"><ImageIcon size={18} className="mr-2 text-ore-green" /> 本地光影包</h3>
          <p className="text-sm text-ore-text-muted mt-1">需预先安装 OptiFine、Iris 或 Oculus 前置模组方可生效。</p>
        </div>
        <OreButton variant="secondary" size="sm" onClick={openFolder}>
          <FolderOpen size={16} className="mr-2" /> 打开光影目录
        </OreButton>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={32} className="animate-spin text-ore-green" /></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 overflow-y-auto custom-scrollbar px-2 pb-4">
          {items.map((item, i) => (
            <OreList
              key={i}
              isInactive={!item.isEnabled}
              title={item.fileName.replace('.zip', '').replace('.disabled', '')}
              subtitle={`文件: ${item.fileName} | 大小: ${formatSize(item.fileSize)}`}
              icon={<ImageIcon size={32} className="text-ore-text-muted/50 drop-shadow-md" />}
              actions={
                <>
                  <button 
                    onClick={() => toggleItem(item.fileName, item.isEnabled)}
                    className={`p-1.5 rounded transition-colors ${item.isEnabled ? 'text-ore-green hover:bg-white/10' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
                  >
                    <Power size={18} />
                  </button>
                  <button 
                    onClick={() => deleteItem(item.fileName)}
                    className="p-1.5 rounded text-red-400 hover:bg-red-400/10 transition-colors ml-2"
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}
    </SettingsPageLayout>
  );
};