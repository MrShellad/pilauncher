import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Blocks,
  CheckCircle2,
  Cpu,
  FileArchive,
  FolderArchive,
  HardDrive,
  Loader2,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';

import { OreButton } from '../../../ui/primitives/OreButton';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { DirectoryBrowserModal } from '../../../ui/components/DirectoryBrowserModal';
import { useDownloadStore } from '../../../store/useDownloadStore';
import { useLauncherStore } from '../../../store/useLauncherStore';

interface ModpackMetadata {
  name: string;
  version: string;
  loader: string;
  loaderVersion: string;
  author: string;
  source: 'CurseForge' | 'Modrinth' | 'PiPack' | 'HMCL' | 'Unknown';
  packVersion?: string | null;
  packagedAt?: string | null;
  packUuid?: string | null;
}

const SUPPORTED_ARCHIVE_EXTENSIONS = ['zip', 'mrpack', 'pipack'];

const getFileExtension = (path: string) => {
  const fileName = path.split(/[\\/]/).pop() || path;
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) return '';
  return fileName.slice(dotIndex + 1).toLowerCase();
};

export const LocalImportView: React.FC = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPath, setSelectedPath] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [metadata, setMetadata] = useState<ModpackMetadata | null>(null);
  const [instanceName, setInstanceName] = useState('');
  const [installPath, setInstallPath] = useState(t('localImport.status.loadingInstancesDir'));
  const [isImporting, setIsImporting] = useState(false);
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false);

  useEffect(() => {
    const fetchBasePath = async () => {
      try {
        const basePath = await invoke<string | null>('get_base_directory');
        if (basePath) {
          const separator = basePath.includes('\\') ? '\\' : '/';
          setInstallPath(`${basePath}${separator}instances`);
        } else {
          setInstallPath(t('localImport.status.baseDirMissing'));
        }
      } catch (error) {
        console.error('Failed to read base directory:', error);
        setInstallPath(t('localImport.status.defaultDirReadFailed'));
      }
    };

    fetchBasePath();
  }, [t]);

  const parseSelectedArchive = async (path: string) => {
    const extension = getFileExtension(path);
    if (!SUPPORTED_ARCHIVE_EXTENSIONS.includes(extension)) {
      alert(t('localImport.errors.unsupportedArchive'));
      return;
    }

    setSelectedPath(path);
    setIsParsing(true);

    try {
      const parsedData: ModpackMetadata = await invoke('parse_modpack_metadata', {
        path,
      });
      setMetadata(parsedData);
      setInstanceName(parsedData.name);
      setStep(2);
    } catch (parseError) {
      alert(t('localImport.errors.parseFailed', { error: String(parseError) }));
    } finally {
      setIsParsing(false);
    }
  };

  const handleSelectFile = () => {
    setIsFileBrowserOpen(true);
  };

  const handleFileBrowserSelect = (path: string) => {
    setIsFileBrowserOpen(false);
    void parseSelectedArchive(path);
  };

  const handleSelectPath = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === 'string') {
      setInstallPath(selected);
    }
  };

  const handleStartImport = async () => {
    setIsImporting(true);
    try {
      await invoke('import_modpack', {
        zipPath: selectedPath,
        instanceName,
      });

      useLauncherStore.getState().setActiveTab('home');
      useDownloadStore.getState().setPopupOpen(true);
    } catch (error) {
      console.error('Import request failed:', error);
      alert(t('localImport.errors.importFailed', { error: String(error) }));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-8 text-white">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex w-full max-w-[58rem] flex-col items-center border border-white/10 bg-black/35 px-8 py-8 shadow-[0_12px_32px_rgba(0,0,0,0.24)]"
          >
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/5">
              {isParsing ? (
                <Loader2 size={40} className="animate-spin text-ore-green" />
              ) : (
                <FolderArchive size={40} className="text-ore-text-muted" />
              )}
            </div>
            <h2 className="mb-3 font-minecraft text-2xl tracking-widest">
              {isParsing ? t('localImport.step1.reading') : t('localImport.step1.title')}
            </h2>
            <p className="mb-8 w-full text-center font-minecraft text-base leading-relaxed text-white/90">
              {t('localImport.step1.supportPrefix')}{' '}
              <span className="font-bold text-orange-300">CurseForge .zip</span>
              {t('localImport.step1.separator')}{' '}
              <span className="font-bold text-emerald-300">Modrinth .mrpack</span>
              {t('localImport.step1.separator')}{' '}
              <span className="font-bold text-cyan-300">PiLauncher .pipack</span>
              {t('localImport.step1.supportSuffix')}{' '}
              <span className="font-bold text-ore-green">{t('localImport.step1.autoPrepare')}</span>
            </p>

            <FocusItem focusKey="btn-select-zip" onEnter={handleSelectFile}>
              {({ ref, focused }) => (
                <div
                  ref={ref}
                  className={`rounded-sm transition-shadow ${
                    focused ? 'outline outline-[3px] outline-offset-[4px] outline-white' : ''
                  }`}
                >
                  <OreButton
                    variant="primary"
                    size="lg"
                    onClick={handleSelectFile}
                    disabled={isParsing}
                    tabIndex={-1}
                  >
                    <FileArchive size={20} className="mr-2" />
                    {t('localImport.actions.selectArchive')}
                  </OreButton>
                </div>
              )}
            </FocusItem>
          </motion.div>
        )}

        {step === 2 && metadata && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex w-full max-w-2xl flex-col border-2 border-[#2A2A2C] bg-[#1E1E1F] p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between border-b-2 border-white/5 pb-4">
              <div>
                <h3 className="mb-1 flex items-center font-minecraft text-2xl text-white">
                  <CheckCircle2 size={24} className="mr-2 text-ore-green" />
                  {t('localImport.step2.parsed', { name: metadata.name })}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-sm border border-white/10 bg-black/40 px-2 py-1 text-base text-ore-text-muted">
                    {t('localImport.meta.source')}: {metadata.source} | {t('localImport.meta.author')}:{' '}
                    {metadata.author}
                  </span>
                  {metadata.packVersion && (
                    <span className="rounded-sm border border-white/10 bg-black/40 px-2 py-1 text-base text-[#FFE866]">
                      {t('localImport.meta.pack')} {metadata.packVersion}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="flex items-center border border-white/5 bg-black/30 p-3">
                <Blocks size={24} className="mr-3 opacity-80 text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-base uppercase tracking-wider text-ore-text-muted">
                    {t('localImport.meta.gameVersion')}
                  </span>
                  <span className="font-minecraft text-white">Minecraft {metadata.version}</span>
                </div>
              </div>
              <div className="flex items-center border border-white/5 bg-black/30 p-3">
                <Cpu size={24} className="mr-3 opacity-80 text-orange-400" />
                <div className="flex flex-col">
                  <span className="text-base uppercase tracking-wider text-ore-text-muted">
                    {t('localImport.meta.loader')}
                  </span>
                  <span className="font-minecraft text-white">
                    {metadata.loader} {metadata.loaderVersion}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-6 space-y-4">
              <div className="flex flex-col space-y-1.5">
                <label className="text-base font-bold tracking-wider text-ore-text-muted">
                  {t('localImport.fields.instanceName')}
                </label>
                <input
                  type="text"
                  value={instanceName}
                  onChange={(event) => setInstanceName(event.target.value)}
                  className="border border-[#2A2A2C] bg-black/40 px-3 py-2 font-minecraft text-white transition-colors focus:border-white/50 focus:outline-none"
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-base font-bold tracking-wider text-ore-text-muted">
                  {t('localImport.fields.installPath')}
                </label>
                <div className="flex space-x-2">
                  <div
                    className="flex-1 truncate border border-[#2A2A2C] bg-black/40 px-3 py-2 font-minecraft text-base text-gray-400"
                    title={installPath}
                  >
                    {installPath}
                  </div>
                  <FocusItem focusKey="btn-change-path" onEnter={handleSelectPath}>
                    {({ ref, focused }) => (
                      <button
                        ref={ref}
                        onClick={handleSelectPath}
                        className={`bg-[#2A2A2C] px-4 font-minecraft text-white transition-colors hover:bg-[#3A3B3D] focus:outline-none ${
                          focused ? 'outline outline-2 outline-offset-2 outline-white' : ''
                        }`}
                      >
                        {t('localImport.actions.change')}
                      </button>
                    )}
                  </FocusItem>
                </div>
              </div>
            </div>

            <div className="mb-8 flex items-start border border-yellow-400/45 bg-black/35 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
              <AlertTriangle size={18} className="mt-0.5 mr-2 flex-shrink-0 text-yellow-500" />
              <p className="font-minecraft text-base leading-relaxed text-white/90">
                {t('localImport.warning.requiresPrefix')}{' '}
                <span className="font-bold text-yellow-300">{metadata.version}</span>{' '}
                {t('localImport.warning.with')}{' '}
                <span className="font-bold text-orange-300">{metadata.loader}</span>.{' '}
                <span className="text-ore-green">{t('localImport.warning.autoRestore')}</span>
              </p>
            </div>

            <div className="mt-auto flex justify-center space-x-3">
              <FocusItem focusKey="btn-cancel-import" onEnter={() => setStep(1)}>
                {({ ref, focused }) => (
                  <div
                    ref={ref}
                    className={`rounded-sm ${
                      focused ? 'outline outline-2 outline-offset-[4px] outline-white' : ''
                    }`}
                  >
                    <OreButton variant="secondary" onClick={() => setStep(1)} tabIndex={-1}>
                      {t('localImport.actions.cancel')}
                    </OreButton>
                  </div>
                )}
              </FocusItem>

              <FocusItem focusKey="btn-confirm-import" onEnter={handleStartImport}>
                {({ ref, focused }) => (
                  <div
                    ref={ref}
                    className={`rounded-sm ${
                      focused ? 'outline outline-2 outline-offset-[4px] outline-white' : ''
                    }`}
                  >
                    <OreButton
                      variant="primary"
                      onClick={handleStartImport}
                      disabled={isImporting}
                      tabIndex={-1}
                    >
                      {isImporting ? (
                        <Loader2 size={18} className="mr-2 animate-spin" />
                      ) : (
                        <HardDrive size={18} className="mr-2" />
                      )}
                      {isImporting ? t('localImport.actions.importing') : t('localImport.actions.startImport')}
                    </OreButton>
                  </div>
                )}
              </FocusItem>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DirectoryBrowserModal
        isOpen={isFileBrowserOpen}
        onClose={() => setIsFileBrowserOpen(false)}
        onSelect={handleFileBrowserSelect}
        showFiles
        allowedExtensions={SUPPORTED_ARCHIVE_EXTENSIONS}
        title={t('directoryBrowser.title.modpackArchive')}
        allowDirectorySelection={false}
      />
    </div>
  );
};
