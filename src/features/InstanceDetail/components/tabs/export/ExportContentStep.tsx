import React, { useEffect, useState } from 'react';
import {
  Blocks,
  Check,
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
    {
      id: 'includeMods',
      label: 'Mods',
      icon: Blocks,
      desc: t('instanceDetail.export.content.toggles.mods', { defaultValue: '包含 mods 模组目录与所有 Jar 文件' }),
    },
    {
      id: 'includeConfigs',
      label: 'Config',
      icon: Settings2,
      desc: t('instanceDetail.export.content.toggles.config', { defaultValue: '包含 config 模组配置与自定义选项' }),
    },
    {
      id: 'includeResourcePacks',
      label: t('instanceDetail.export.content.toggles.resourcePacksLabel', { defaultValue: '资源包' }),
      icon: FolderArchive,
      desc: t('instanceDetail.export.content.toggles.resourcePacks', {
        defaultValue: '包含 resourcepacks 材质与音效包',
      }),
    },
    {
      id: 'includeShaderPacks',
      label: t('instanceDetail.export.content.toggles.shaderPacksLabel', { defaultValue: '光影包' }),
      icon: ImageIcon,
      desc: t('instanceDetail.export.content.toggles.shaderPacks', {
        defaultValue: '包含 shaderpacks 自定义光影渲染包',
      }),
    },
    {
      id: 'includeSaves',
      label: t('instanceDetail.export.content.toggles.savesLabel', { defaultValue: '游戏存档' }),
      icon: HardDrive,
      desc: t('instanceDetail.export.content.toggles.saves', { defaultValue: '包含 saves 世界地图与玩家进度' }),
    },
  ] as const;

  const toggleStatus = (id: (typeof toggles)[number]['id']) => {
    onChange({ [id]: !data[id] } as Partial<ExportData>);
  };

  const toInstanceRelativePath = (selectedPath: string): string | null => {
    const root = defaultPath.replace(/[\\/]+$/, '').replace(/\\/g, '/');
    const candidate = selectedPath.trim().replace(/\\/g, '/');
    if (!root || !candidate) return null;

    if (!candidate.toLocaleLowerCase().startsWith(`${root.toLocaleLowerCase()}/`)) {
      addToast('warning', 'Only files and directories inside the current instance can be exported.');
      return null;
    }

    return candidate.slice(root.length + 1);
  };

  const handleSelectDir = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        defaultPath,
      });

      if (!selectedPath || typeof selectedPath !== 'string') return;

      const relativePath = toInstanceRelativePath(selectedPath);
      if (!relativePath) return;
      if (data.additionalPaths.find((item) => item.path === relativePath)) {
        addToast(
          'warning',
          t('instanceDetail.export.content.directoryAlreadyAdded', {
            defaultValue: '目录 [{{name}}] 已在附加列表中，请勿重复添加',
            name: getBasename(relativePath),
          })
        );
      } else {
        onChange({
          additionalPaths: [...data.additionalPaths, { path: relativePath, type: 'dir' }],
        });
      }
    } catch (error) {
      console.error('Failed to open directory dialog', error);
      addToast(
        'error',
        t('instanceDetail.export.content.openDirectoryPickerFailed', {
          defaultValue: '打开目录选择器失败，请检查系统权限',
        })
      );
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
        const relativePath = toInstanceRelativePath(path);
        if (!relativePath) continue;

        if (data.additionalPaths.find((item) => item.path === relativePath)) {
          duplicatePaths.push(relativePath);
        } else {
          filteredPaths.push(relativePath);
        }
      }

      if (duplicatePaths.length > 0) {
        addToast(
          'warning',
          t('instanceDetail.export.content.fileAlreadyAdded', {
            defaultValue: '文件 [{{names}}] 已在附加列表中，请勿重复添加',
            names: duplicatePaths.map((p) => getBasename(p)).join(', '),
          })
        );
      }

      if (filteredPaths.length > 0) {
        const nextPaths = filteredPaths.map((path) => ({ path, type: 'file' as const }));
        onChange({ additionalPaths: [...data.additionalPaths, ...nextPaths] });
      }
    } catch (error) {
      console.error('Failed to open file dialog', error);
      addToast(
        'error',
        t('instanceDetail.export.content.openFilePickerFailed', {
          defaultValue: '打开文件选择器失败，请检查系统权限',
        })
      );
    }
  };

  const removePath = (path: string) => {
    onChange({ additionalPaths: data.additionalPaths.filter((item) => item.path !== path) });
  };

  const getBasename = (path: string) => path.split(/[/\\]/).pop() || path;

  return (
    <div className="w-full max-w-4xl xl:max-w-5xl mx-auto flex flex-col space-y-5 font-minecraft select-none">
      {/* 1. 系统核心内容 3D 多选磁贴网格 (居中平铺自适应) */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {toggles.map((option) => {
          const isChecked = !!data[option.id];
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggleStatus(option.id)}
              className={`flex w-full cursor-pointer flex-col justify-between border-[2px] border-[#1E1E1F] p-4 text-left transition-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white active:translate-y-[2px] min-h-[5.75rem] ${
                isChecked
                  ? 'bg-[#3C8527] text-white shadow-[inset_0_-3px_0_#1D4D13,inset_0_2px_0_#6CC349]'
                  : 'bg-[#48494A] text-[#D0D1D4] shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)] hover:bg-[#525354]'
              }`}
            >
              <div className="flex w-full items-center justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center border-[2px] border-[#1E1E1F] ${
                      isChecked ? 'bg-[#244A1B]' : 'bg-[#222324]'
                    } shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]`}
                  >
                    <option.icon
                      size={16}
                      className={isChecked ? 'text-white' : 'text-[#6CC349]'}
                    />
                  </div>
                  <span className="truncate text-sm sm:text-base font-bold tracking-wide">
                    {option.label}
                  </span>
                </div>

                {/* 正统 3D 方形勾选框 */}
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center border-[2px] border-[#1E1E1F] ${
                    isChecked
                      ? 'bg-[#244A1B] text-[#6CC349] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
                      : 'bg-[#222324] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
                  }`}
                >
                  {isChecked && <Check size={14} strokeWidth={3} />}
                </div>
              </div>

              <span
                className={`text-xs leading-tight ${
                  isChecked ? 'text-white/90' : 'text-[#8C8D90]'
                }`}
              >
                {option.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. 附加自定义内容 3D 石质矿槽 */}
      <div className="border-[3px] border-[#1E1E1F] bg-[#313233] p-5 shadow-[inset_0_2px_0_rgba(255,255,255,0.08)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b-[2px] border-[#1E1E1F] pb-3.5 mb-3.5">
          <div>
            <label className="flex items-center text-sm font-bold uppercase tracking-wider text-white">
              <Plus size={15} className="mr-2 text-[#6CC349]" />
              <span>{t('instanceDetail.export.content.additionalContent', { defaultValue: '附加自定义内容' })}</span>
            </label>
            <p className="text-xs text-[#8C8D90] mt-0.5">
              可手动添加当前实例目录下的独立文件或配置目录（如 scripts, options.txt 等）
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <OreButton variant="secondary" size="sm" onClick={handleSelectDir}>
              <FolderArchive size={14} className="mr-1.5 shrink-0" />
              <span>{t('instanceDetail.export.content.directory', { defaultValue: '添加目录' })}</span>
            </OreButton>
            <OreButton variant="secondary" size="sm" onClick={handleAddFile}>
              <FilePlus2 size={14} className="mr-1.5 shrink-0" />
              <span>{t('instanceDetail.export.content.file', { defaultValue: '添加文件' })}</span>
            </OreButton>
          </div>
        </div>

        {/* 附加文件/目录列表 */}
        {data.additionalPaths.length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            <AnimatePresence>
              {data.additionalPaths.map((item) => (
                <motion.div
                  key={item.path}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.12 }}
                  className="group flex items-center border-[2px] border-[#1E1E1F] bg-[#222324] px-3 py-1.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                  title={item.path}
                >
                  {item.type === 'dir' ? (
                    <FolderArchive size={15} className="mr-2 shrink-0 text-[#6CC349]" />
                  ) : (
                    <ImageIcon size={15} className="mr-2 shrink-0 text-[#D0D1D4]" />
                  )}
                  <span
                    className="mr-2 max-w-[18rem] truncate text-xs text-[#D0D1D4] font-['JetBrains_Mono',monospace]"
                    style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  >
                    {getBasename(item.path)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePath(item.path)}
                    className="text-[#8C8D90] transition-colors hover:text-[#FF9E9E] focus:outline-none ml-1"
                    title="移除"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex items-center justify-center p-5 border-[2px] border-dashed border-[#1E1E1F] bg-[#222324]/50 text-xs text-[#8C8D90]">
            {t('instanceDetail.export.content.noAdditionalPaths', {
              defaultValue: '当前未添加额外的自定义文件或目录。点击右上角按钮即可添加。',
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportContentStep;