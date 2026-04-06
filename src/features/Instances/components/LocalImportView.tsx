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

import { OreButton } from '../../../ui/primitives/OreButton';
import { FocusItem } from '../../../ui/focus/FocusItem';
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

export const LocalImportView: React.FC = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPath, setSelectedPath] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [metadata, setMetadata] = useState<ModpackMetadata | null>(null);
  const [instanceName, setInstanceName] = useState('');
  const [installPath, setInstallPath] = useState('Loading instances directory...');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const fetchBasePath = async () => {
      try {
        const basePath = await invoke<string | null>('get_base_directory');
        if (basePath) {
          const separator = basePath.includes('\\') ? '\\' : '/';
          setInstallPath(`${basePath}${separator}instances`);
        } else {
          setInstallPath('Base directory is not configured.');
        }
      } catch (error) {
        console.error('Failed to read base directory:', error);
        setInstallPath('Unable to read default directory.');
      }
    };

    fetchBasePath();
  }, []);

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Minecraft Modpacks', extensions: ['zip', 'mrpack', 'pipack'] }],
      });

      if (!selected || typeof selected !== 'string') {
        return;
      }

      setSelectedPath(selected);
      setIsParsing(true);

      try {
        const parsedData: ModpackMetadata = await invoke('parse_modpack_metadata', {
          path: selected,
        });
        setMetadata(parsedData);
        setInstanceName(parsedData.name);
        setStep(2);
      } catch (parseError) {
        alert(`Failed to parse archive: ${parseError}`);
      } finally {
        setIsParsing(false);
      }
    } catch (error) {
      console.error('File selection failed:', error);
      setIsParsing(false);
    }
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
      alert(`Import failed: ${error}`);
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
            className="flex w-full max-w-lg flex-col items-center"
          >
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/5">
              {isParsing ? (
                <Loader2 size={40} className="animate-spin text-ore-green" />
              ) : (
                <FolderArchive size={40} className="text-ore-text-muted" />
              )}
            </div>
            <h2 className="mb-2 font-minecraft text-2xl tracking-widest">
              {isParsing ? 'Reading metadata...' : 'Import local modpack'}
            </h2>
            <p className="mb-8 text-center font-minecraft text-sm leading-relaxed text-[#A0A0A0]">
              Supports CurseForge `.zip`, Modrinth `.mrpack`, and PiLauncher `.pipack` archives.
              <br />
              The launcher will parse metadata and prepare the required runtime automatically.
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
                    Select archive
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
                  Parsed: {metadata.name}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-sm border border-white/10 bg-black/40 px-2 py-0.5 text-xs text-ore-text-muted">
                    Source: {metadata.source} | Author: {metadata.author}
                  </span>
                  {metadata.packVersion && (
                    <span className="rounded-sm border border-white/10 bg-black/40 px-2 py-0.5 text-xs text-[#FFE866]">
                      Pack {metadata.packVersion}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="flex items-center border border-white/5 bg-black/30 p-3">
                <Blocks size={24} className="mr-3 opacity-80 text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-ore-text-muted">
                    Game Version
                  </span>
                  <span className="font-minecraft text-white">Minecraft {metadata.version}</span>
                </div>
              </div>
              <div className="flex items-center border border-white/5 bg-black/30 p-3">
                <Cpu size={24} className="mr-3 opacity-80 text-orange-400" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-ore-text-muted">
                    Loader
                  </span>
                  <span className="font-minecraft text-white">
                    {metadata.loader} {metadata.loaderVersion}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-6 space-y-4">
              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-bold tracking-wider text-ore-text-muted">
                  Instance Name
                </label>
                <input
                  type="text"
                  value={instanceName}
                  onChange={(event) => setInstanceName(event.target.value)}
                  className="border border-[#2A2A2C] bg-black/40 px-3 py-2 font-minecraft text-white transition-colors focus:border-white/50 focus:outline-none"
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-bold tracking-wider text-ore-text-muted">
                  Install Path
                </label>
                <div className="flex space-x-2">
                  <div
                    className="flex-1 truncate border border-[#2A2A2C] bg-black/40 px-3 py-2 font-minecraft text-sm text-gray-400"
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
                        Change
                      </button>
                    )}
                  </FocusItem>
                </div>
              </div>
            </div>

            <div className="mb-8 flex items-start border border-yellow-500/30 bg-yellow-500/10 p-3">
              <AlertTriangle size={18} className="mt-0.5 mr-2 flex-shrink-0 text-yellow-500" />
              <p className="font-minecraft text-xs leading-relaxed text-yellow-500/90">
                The pack requires <span className="font-bold text-white">{metadata.version}</span>{' '}
                with <span className="font-bold text-white">{metadata.loader}</span>.
                <br />
                Missing runtimes and referenced mods will be restored automatically during import.
              </p>
            </div>

            <div className="mt-auto flex justify-end space-x-3">
              <FocusItem focusKey="btn-cancel-import" onEnter={() => setStep(1)}>
                {({ ref, focused }) => (
                  <div
                    ref={ref}
                    className={`rounded-sm ${
                      focused ? 'outline outline-2 outline-offset-[4px] outline-white' : ''
                    }`}
                  >
                    <OreButton variant="secondary" onClick={() => setStep(1)} tabIndex={-1}>
                      Cancel
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
                      {isImporting ? 'Importing...' : 'Start import'}
                    </OreButton>
                  </div>
                )}
              </FocusItem>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
