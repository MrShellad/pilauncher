// src/features/runtime/components/JavaSelector.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { OreInput } from '../../../ui/primitives/OreInput';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreModal } from '../../../ui/primitives/OreModal';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary'; 
import { Search, FolderOpen, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { validateCachedJava, scanJava, getJavaRecommendation, type JavaInstall } from '../logic/javaDetector';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { DirectoryBrowserModal } from '../../../ui/components/DirectoryBrowserModal';

export const JavaSelector: React.FC<{ value: string; onChange: (path: string) => void; disabled?: boolean; isError?: boolean; onArrowPress?: (direction: string) => boolean }> = ({ value, onChange, disabled, isError, onArrowPress }) => {
  const [isModalOpen, setModalOpen] = useState(false);
  const [javaList, setJavaList] = useState<JavaInstall[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [browserStartPath, setBrowserStartPath] = useState('');

  const wasModalOpen = useRef(false);
  const wasBrowserOpen = useRef(false);
  const returnFocusKeyRef = useRef<string>('java-input-path');

  const restoreFocusAfterClose = useCallback(() => {
    const candidates = [
      returnFocusKeyRef.current,
      'java-input-path',
      'java-btn-browse'
    ];

    setTimeout(() => {
      const next = candidates.find((k) => !!k && doesFocusableExist(k));
      if (next) setFocus(next);
    }, 80);
  }, []);

  const openSelectorModal = useCallback((fallbackFocusKey: string) => {
    if (disabled) return;

    const current = getCurrentFocusKey();
    const isValidCurrent = current && current !== 'SN:ROOT' && current.startsWith('java-');
    returnFocusKeyRef.current = isValidCurrent ? current : fallbackFocusKey;

    setModalOpen(true);
  }, [disabled]);

  const closeSelectorModal = useCallback((nextFocusKey?: string) => {
    if (nextFocusKey) returnFocusKeyRef.current = nextFocusKey;
    setModalOpen(false);
  }, []);

  const loadFromCache = async () => {
    setIsScanning(true);
    const { valid } = await validateCachedJava();
    setJavaList(valid.sort((a, b) => b.version.localeCompare(a.version)));
    setIsScanning(false);
  };

  useEffect(() => {
    if (isModalOpen && !wasModalOpen.current) {
      loadFromCache();
      setTimeout(() => setFocus('btn-java-scan'), 100);
    }
    if (!isModalOpen && wasModalOpen.current && !isBrowserOpen) {
      restoreFocusAfterClose();
    }
    wasModalOpen.current = isModalOpen;
  }, [isModalOpen, isBrowserOpen, restoreFocusAfterClose]);

  useEffect(() => {
    if (!isBrowserOpen && wasBrowserOpen.current && isModalOpen) {
      setTimeout(() => {
        if (doesFocusableExist('btn-java-browse')) {
          setFocus('btn-java-browse');
        }
      }, 80);
    }
    wasBrowserOpen.current = isBrowserOpen;
  }, [isBrowserOpen, isModalOpen]);

  const handleScan = async () => {
    setIsScanning(true);
    const javas = await scanJava();
    setJavaList(javas);
    setIsScanning(false);
  };

  const handleBrowse = async () => {
    try {
      const basePath = await invoke<string | null>('get_base_directory');
      if (basePath) {
        const sep = basePath.includes('\\') ? '\\' : '/';
        setBrowserStartPath(`${basePath}${sep}runtime${sep}java`);
      } else {
        setBrowserStartPath('');
      }
    } catch (e) {
      setBrowserStartPath('');
    }
    setIsBrowserOpen(true);
  };

  const handleDirSelect = (dirPath: string) => {
    const isWin = dirPath.includes('\\');
    const sep = isWin ? '\\' : '/';
    const exeName = isWin ? 'javaw.exe' : 'java';
    let executable = dirPath.endsWith('bin') ? `${dirPath}${sep}${exeName}` : `${dirPath}${sep}bin${sep}${exeName}`;
    
    onChange(executable);
    setIsBrowserOpen(false);
    closeSelectorModal('java-input-path');
  };

  return (
    <>
      <div className="flex gap-2">
        <div className="flex-1 cursor-pointer" onClick={() => openSelectorModal('java-input-path')}>
          <OreInput 
            focusKey="java-input-path" // ✅ 补充焦点ID
            onArrowPress={onArrowPress}
            value={value} 
            readOnly 
            placeholder="点击选择 Java 路径..." 
            disabled={disabled}
            className={`cursor-pointer ${isError ? '!text-red-400 font-bold' : ''}`}
            containerClassName="!space-y-0"
          />
        </div>
        <OreButton 
          focusKey="java-btn-browse" // ✅ 补充焦点ID
          onArrowPress={onArrowPress}
          variant="secondary" 
          onClick={() => openSelectorModal('java-btn-browse')} 
          disabled={disabled} 
          className="!px-4"
        >
          选择...
        </OreButton>
      </div>

      <OreModal 
        isOpen={isModalOpen} 
        onClose={() => closeSelectorModal()} 
        title="选择 Java 运行时" 
        hideTitleBar={true}
        defaultFocusKey="btn-java-scan"
        className="w-[600px] h-[500px]"
      >
        <FocusBoundary id="java-selector-boundary" trapFocus={isModalOpen} onEscape={() => closeSelectorModal()} className="flex flex-col h-full outline-none">
          <div className="flex gap-3 mb-4 shrink-0">
            <FocusItem focusKey="btn-java-scan" onEnter={handleScan}>
              {({ ref, focused }) => (
                <button ref={ref as any} onClick={handleScan} disabled={isScanning} className={`flex-1 flex items-center justify-center p-2 rounded-sm border transition-all ${focused ? 'bg-white/10 border-white text-white scale-[1.02]' : 'bg-[#141415] border-[#1E1E1F] text-gray-300 hover:bg-white/5'} ${isScanning ? 'opacity-50' : ''}`}>
                  <RefreshCw size={16} className={`mr-2 ${isScanning ? 'animate-spin' : ''}`} /> {isScanning ? '扫描中...' : '重新扫描本机'}
                </button>
              )}
            </FocusItem>
            <FocusItem focusKey="btn-java-browse" onEnter={handleBrowse}>
              {({ ref, focused }) => (
                <button ref={ref as any} onClick={handleBrowse} className={`flex-1 flex items-center justify-center p-2 rounded-sm border transition-all ${focused ? 'bg-white/10 border-white text-white scale-[1.02]' : 'bg-[#141415] border-[#1E1E1F] text-gray-300 hover:bg-white/5'}`}>
                  <FolderOpen size={16} className="mr-2" /> 手动浏览目录...
                </button>
              )}
            </FocusItem>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
            {isScanning && javaList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
                <Loader2 size={32} className="animate-spin opacity-50" />
                <span>正在深度扫描磁盘...</span>
              </div>
            ) : javaList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
                <Search size={32} className="opacity-50" />
                <span>未扫描到可用的 Java 环境，请手动浏览</span>
              </div>
            ) : (
              javaList.map((java, idx) => {
                const rec = getJavaRecommendation(java.version);
                return (
                  <FocusItem key={java.path} focusKey={`java-item-${idx}`} onEnter={() => { onChange(java.path); closeSelectorModal('java-input-path'); }}>
                    {({ ref, focused }) => (
                      <div
                        ref={ref as any} onClick={() => { onChange(java.path); closeSelectorModal('java-input-path'); }}
                        className={`
                          flex flex-col p-4 bg-[#141415] border-2 cursor-pointer outline-none transition-all duration-200
                          ${value === java.path ? 'border-ore-green shadow-[0_0_10px_rgba(56,133,39,0.2)]' : 'border-[#1E1E1F] hover:border-white/30'}
                          ${focused ? 'ring-2 ring-white border-white scale-[1.01] z-10' : ''}
                        `}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center space-x-3">
                            <span className="text-white font-minecraft text-lg">Java {java.version}</span>
                            {rec && <span className="text-[10px] bg-[#3A3B3C] text-ore-green px-2 py-0.5 rounded-sm border border-[#1E1E1F] font-minecraft uppercase tracking-wider">{rec}</span>}
                          </div>
                          {value === java.path && <CheckCircle2 size={18} className="text-ore-green" />}
                        </div>
                        <span className="text-ore-text-muted font-minecraft text-sm truncate">{java.path}</span>
                      </div>
                    )}
                  </FocusItem>
                );
              })
            )}
          </div>
        </FocusBoundary>
      </OreModal>

      <DirectoryBrowserModal 
        isOpen={isBrowserOpen} 
        onClose={() => setIsBrowserOpen(false)} 
        onSelect={handleDirSelect} 
        initialPath={browserStartPath} 
      />
    </>
  );
};
