import React, { useState, useEffect } from 'react';
import { Blocks, Settings2, FolderArchive, Image as ImageIcon, HardDrive, CheckCircle2, Circle, Plus, X, FilePlus2 } from 'lucide-react';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { DirectoryBrowserModal } from '../../../../../ui/components/DirectoryBrowserModal';
import type { ExportData } from './ExportPanel';

interface ExportContentStepProps {
  instanceId: string;
  data: ExportData;
  onChange: (data: Partial<ExportData>) => void;
}

export const ExportContentStep: React.FC<ExportContentStepProps> = ({ instanceId, data, onChange }) => {
  const [isDirBrowserOpen, setIsDirBrowserOpen] = useState(false);
  const [defaultPath, setDefaultPath] = useState<string>('');

  useEffect(() => {
    const initPath = async () => {
      try {
        const basePath = await invoke<string | null>('get_base_directory');
        if (basePath) {
          const sep = basePath.includes('\\') ? '\\' : '/';
          setDefaultPath(`${basePath}${sep}instances${sep}${instanceId}`);
        }
      } catch (e) {
        console.error(e);
      }
    };
    initPath();
  }, [instanceId]);

  const toggles = [
    { id: 'includeMods', label: 'MODS (模组)', icon: Blocks, desc: '包含 mods 文件夹' },
    { id: 'includeConfigs', label: 'CONFIG (配置)', icon: Settings2, desc: '包含 config 文件夹' },
    { id: 'includeResourcePacks', label: '资源包', icon: FolderArchive, desc: '包含 resourcepacks' },
    { id: 'includeShaderPacks', label: '光影包', icon: ImageIcon, desc: '包含 shaderpacks' },
    { id: 'includeSaves', label: '存档 (SAVES)', icon: HardDrive, desc: '包含 saves 文件夹' },
  ];

  const toggleStatus = (id: string) => {
    onChange({ [id]: !data[id as keyof ExportData] });
  };

  const handleDirSelected = (selectedPath: string) => {
    setIsDirBrowserOpen(false);
    if (!selectedPath) return;
    const trimmed = selectedPath.trim();
    if (!data.additionalPaths.find(p => p.path === trimmed)) {
      onChange({ additionalPaths: [...data.additionalPaths, { path: trimmed, type: 'dir' }] });
    }
  };

  const handleAddFile = async () => {
    try {
      const selectedPath = await open({
        directory: false,
        multiple: true,
        defaultPath,
      });

      if (selectedPath) {
        let paths = Array.isArray(selectedPath) ? selectedPath : [selectedPath];
        const newPaths: { path: string, type: 'file' | 'dir' }[] = [];
        for (const p of paths) {
          if (typeof p === 'string') {
            const trimmed = p.trim();
            if (trimmed && !data.additionalPaths.find(old => old.path === trimmed)) {
              newPaths.push({ path: trimmed, type: 'file' });
            }
          }
        }
        if (newPaths.length > 0) {
          onChange({ additionalPaths: [...data.additionalPaths, ...newPaths] });
        }
      }
    } catch (e) {
      console.error("Failed to open file dialog", e);
    }
  };

  const removePath = (path: string) => {
    onChange({ additionalPaths: data.additionalPaths.filter(p => p.path !== path) });
  };

  const getBasename = (path: string) => {
    return path.split(/[/\\]/).pop() || path;
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center space-x-3 border-b-2 border-[#18181B] pb-3">
        <span className="w-1.5 h-4 bg-[#3C8527] shadow-[0_0_8px_rgba(56,133,39,0.4)]" />
        <div>
          <h3 className="text-lg font-bold tracking-widest text-white">导出内容</h3>
          <p className="text-xs text-[#B1B2B5] tracking-wider">选择打包入整合包的文件夹或依赖</p>
        </div>
      </div>

      {/* Ore Toggle Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {toggles.map((opt) => (
          <button
            key={opt.id}
            onClick={() => toggleStatus(opt.id)}
            className={`cursor-pointer focus:outline-none flex flex-col items-start p-4 border-2 rounded-sm relative text-left w-full
              ${data[opt.id as keyof ExportData] 
                ? 'bg-[#3C8527] border-[#18181B] shadow-[inset_0_-4px_#1D4D13,inset_3px_3px_rgba(255,255,255,0.2),inset_-3px_-7px_rgba(255,255,255,0.1)]' 
                : 'bg-[#1E1E1F] border-[#18181B] shadow-[inset_2px_2px_rgba(255,255,255,0.05)]'}
              hover:opacity-90 transition-opacity`}
            style={{ fontWeight: 'normal' }}
          >
            <div className="flex items-center w-full mb-1">
              <opt.icon size={20} className={`mr-2 ${data[opt.id as keyof ExportData] ? 'text-white' : 'text-[#B1B2B5]'}`} />
              <span className={`text-sm font-bold tracking-wide flex-1 ${data[opt.id as keyof ExportData] ? 'text-white text-shadow' : 'text-[#D0D1D4]'}`}>
                {opt.label}
              </span>
              <div className={data[opt.id as keyof ExportData] ? 'text-white' : 'text-[#58585A]'}>
                {data[opt.id as keyof ExportData] ? <CheckCircle2 size={18} /> : <Circle size={18} />}
              </div>
            </div>
            <span className={`text-xs ml-7 ${data[opt.id as keyof ExportData] ? 'text-white' : 'text-[#B1B2B5]'}`}>
              {opt.desc}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 p-5 bg-[#313233] border-2 border-[#18181B] rounded-sm space-y-4 shadow-[inset_0_4px_8px_-2px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between">
          <label className="text-sm text-[#D0D1D4] font-bold flex items-center">
            <Plus size={16} className="mr-2 text-[#B1B2B5]" />
            附加自定义内容 (Custom Content)
          </label>
          <div className="flex space-x-2">
            <OreButton variant="secondary" onClick={() => setIsDirBrowserOpen(true)} size="sm">
              <FolderArchive size={14} className="mr-2" /> 目录
            </OreButton>
            <OreButton variant="secondary" onClick={handleAddFile} size="sm">
              <FilePlus2 size={14} className="mr-2" /> 文件
            </OreButton>
          </div>
        </div>

        {data.additionalPaths && data.additionalPaths.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-2">
            {data.additionalPaths.map((item) => (
              <div key={item.path} className="flex items-center bg-[#1E1E1F] border border-[#18181B] px-3 py-1.5 rounded-sm shadow-sm group relative" title={item.path}>
                {item.type === 'dir' ? <FolderArchive size={14} className="mr-2 text-[#3C8527]" /> : <ImageIcon size={14} className="mr-2 text-[#D0D1D4]" />}
                <span className="text-sm mr-3 text-[#D0D1D4] max-w-[200px] truncate">{getBasename(item.path)}</span>
                <button 
                  onClick={() => removePath(item.path)} 
                  className="text-[#B1B2B5] group-hover:text-[#C33636] transition-colors focus:outline-none"
                  title="Remove"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-[#58585A] italic mt-2">没有手动附加额外的文件或目录。</div>
        )}
      </div>

      <DirectoryBrowserModal
        isOpen={isDirBrowserOpen}
        onClose={() => setIsDirBrowserOpen(false)}
        onSelect={handleDirSelected}
        initialPath={defaultPath}
      />
    </div>
  );
};
