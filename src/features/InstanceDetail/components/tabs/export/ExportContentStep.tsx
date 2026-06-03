import React, { useEffect, useState } from 'react';
import {
  Blocks,
  CheckCircle2,
  Circle,
  FilePlus2,
  FolderArchive,
  HardDrive,
  Image as ImageIcon,
  Plus,
  Settings2,
  X,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

import { useToastStore } from '../../../../../store/useToastStore';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import type { ExportData } from './ExportPanel';

interface ExportContentStepProps {
  instanceId: string;
  data: ExportData;
  onChange: (data: Partial<ExportData>) => void;
}

export const ExportContentStep: React.FC<ExportContentStepProps> = ({
  instanceId,
  data,
  onChange,
}) => {
  const { t } = useTranslation();
  const [defaultPath, setDefaultPath] = useState('');
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    const initPath = async () => {
      try {
        const basePath = await invoke<string | null>('get_base_directory');
        if (basePath) {
          const separator = basePath.includes('\\') ? '\\' : '/';
          setDefaultPath(`${basePath}${separator}instances${separator}${instanceId}`);
        }
      } catch (error) {
        console.error(error);
      }
    };

    void initPath();
  }, [instanceId]);

  const toggles = [
    { id: 'includeMods', label: 'Mods', icon: Blocks, desc: t('instanceDetail.export.content.toggles.mods', { defaultValue: '包含 mods 文件夹' }) },
    { id: 'includeConfigs', label: 'Config', icon: Settings2, desc: t('instanceDetail.export.content.toggles.config', { defaultValue: '包含 config 文件夹' }) },
    {
      id: 'includeResourcePacks',
      label: t('instanceDetail.export.content.toggles.resourcePacksLabel', { defaultValue: '资源包' }),
      icon: FolderArchive,
      desc: t('instanceDetail.export.content.toggles.resourcePacks', { defaultValue: '包含 resourcepacks 文件夹' }),
    },
    {
      id: 'includeShaderPacks',
      label: t('instanceDetail.export.content.toggles.shaderPacksLabel', { defaultValue: '光影包' }),
      icon: ImageIcon,
      desc: t('instanceDetail.export.content.toggles.shaderPacks', { defaultValue: '包含 shaderpacks 文件夹' }),
    },
    { id: 'includeSaves', label: t('instanceDetail.export.content.toggles.savesLabel', { defaultValue: '存档' }), icon: HardDrive, desc: t('instanceDetail.export.content.toggles.saves', { defaultValue: '包含 saves 文件夹' }) },
  ] as const;

  const toggleStatus = (id: (typeof toggles)[number]['id']) => {
    onChange({ [id]: !data[id] } as Partial<ExportData>);
  };

  const handleSelectDir = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        defaultPath,
      });

      if (!selectedPath || typeof selectedPath !== 'string') return;

      const trimmedPath = selectedPath.trim();
      if (data.additionalPaths.find((item) => item.path === trimmedPath)) {
        addToast('warning', t('instanceDetail.export.content.directoryAlreadyAdded', { defaultValue: '目录 [{{name}}] 已在附加列表中，请勿重复添加', name: getBasename(trimmedPath) }));
      } else {
        onChange({
          additionalPaths: [...data.additionalPaths, { path: trimmedPath, type: 'dir' }],
        });
      }
    } catch (error) {
      console.error('Failed to open directory dialog', error);
      addToast('error', t('instanceDetail.export.content.openDirectoryPickerFailed', { defaultValue: '打开目录选择器失败，请检查系统权限' }));
    }
  };

  const handleAddFile = async () => {
    try {
      const selectedPath = await open({
        directory: false,
        multiple: true,
        defaultPath,
      });

      if (!selectedPath) return;

      const paths = Array.isArray(selectedPath) ? selectedPath : [selectedPath];
      const filteredPaths: string[] = [];
      const duplicatePaths: string[] = [];

      for (const path of paths) {
        if (typeof path !== 'string') continue;
        const trimmed = path.trim();
        if (trimmed.length === 0) continue;

        if (data.additionalPaths.find((item) => item.path === trimmed)) {
          duplicatePaths.push(trimmed);
        } else {
          filteredPaths.push(trimmed);
        }
      }

      if (duplicatePaths.length > 0) {
        addToast(
          'warning',
          t('instanceDetail.export.content.fileAlreadyAdded', { defaultValue: '文件 [{{names}}] 已在附加列表中，请勿重复添加', names: duplicatePaths.map((p) => getBasename(p)).join(', ') })
        );
      }

      if (filteredPaths.length > 0) {
        const nextPaths = filteredPaths.map((path) => ({ path, type: 'file' as const }));
        onChange({ additionalPaths: [...data.additionalPaths, ...nextPaths] });
      }
    } catch (error) {
      console.error('Failed to open file dialog', error);
      addToast('error', t('instanceDetail.export.content.openFilePickerFailed', { defaultValue: '打开文件选择器失败，请检查系统权限' }));
    }
  };

  const removePath = (path: string) => {
    onChange({ additionalPaths: data.additionalPaths.filter((item) => item.path !== path) });
  };

  const getBasename = (path: string) => path.split(/[/\\]/).pop() || path;

  return (
    <div className="flex flex-col space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {toggles.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => toggleStatus(option.id)}
            className={`flex w-full cursor-pointer flex-col items-start rounded-sm border-2 p-4 text-left transition-all duration-75 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#313233] active:translate-y-[2px] ${
              data[option.id]
                ? 'border-[#18181B] bg-[#3C8527] shadow-[inset_0_-4px_#1D4D13,inset_3px_3px_rgba(255,255,255,0.2),inset_-3px_-7px_rgba(255,255,255,0.1)] active:shadow-[inset_0_-2px_#1D4D13]'
                : 'border-[#18181B] bg-[#1E1E1F] shadow-[inset_2px_2px_rgba(255,255,255,0.05)] active:shadow-[inset_2px_2px_rgba(0,0,0,0.2)]'
            }`}
          >
            <div className="mb-1 flex w-full items-center">
              <option.icon
                size={20}
                className={`mr-2 ${data[option.id] ? 'text-white' : 'text-[#B1B2B5]'}`}
              />
              <span
                className={`flex-1 text-sm font-bold tracking-wide ${
                  data[option.id] ? 'text-white text-shadow' : 'text-[#D0D1D4]'
                }`}
              >
                {option.label}
              </span>
              <div className={data[option.id] ? 'text-white' : 'text-[#58585A]'}>
                {data[option.id] ? <CheckCircle2 size={18} /> : <Circle size={18} />}
              </div>
            </div>
            <span className={`ml-7 text-xs ${data[option.id] ? 'text-white' : 'text-[#B1B2B5]'}`}>
              {option.desc}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-1 space-y-4 rounded-sm border-2 border-[#18181B] bg-[#313233] p-5 shadow-[inset_0_4px_8px_-2px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center text-sm font-bold text-[#D0D1D4]">
            <Plus size={16} className="mr-2 text-[#B1B2B5]" />
            {t('instanceDetail.export.content.additionalContent', { defaultValue: '附加自定义内容' })}
          </label>
          <div className="flex flex-wrap gap-2">
            <OreButton variant="secondary" size="sm" onClick={handleSelectDir}>
              <FolderArchive size={14} className="mr-2" />
              {t('instanceDetail.export.content.directory', { defaultValue: '目录' })}
            </OreButton>
            <OreButton variant="secondary" size="sm" onClick={handleAddFile}>
              <FilePlus2 size={14} className="mr-2" />
              {t('instanceDetail.export.content.file', { defaultValue: '文件' })}
            </OreButton>
          </div>
        </div>

        {data.additionalPaths.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <AnimatePresence>
              {data.additionalPaths.map((item) => (
                <motion.div
                  key={item.path}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="group relative flex items-center rounded-sm border border-[#18181B] bg-[#1E1E1F] px-3 py-1.5 shadow-sm"
                  title={item.path}
                >
                  {item.type === 'dir' ? (
                    <FolderArchive size={14} className="mr-2 text-[#3C8527]" />
                  ) : (
                    <ImageIcon size={14} className="mr-2 text-[#D0D1D4]" />
                  )}
                  <span className="mr-3 max-w-[12.5rem] truncate text-sm text-[#D0D1D4]">
                    {getBasename(item.path)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePath(item.path)}
                    className="text-[#B1B2B5] transition-colors group-hover:text-[#C33636] focus:outline-none"
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="mt-2 text-xs italic text-[#58585A]">
            {t('instanceDetail.export.content.noAdditionalPaths', { defaultValue: '当前没有手动附加额外的文件或目录。' })}
          </div>
        )}
      </div>
    </div>
  );
};
