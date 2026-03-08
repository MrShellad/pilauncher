// src/features/runtime/components/JavaSelector.tsx
import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { OreInput } from '../../../ui/primitives/OreInput';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreModal } from '../../../ui/primitives/OreModal';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary'; 
import { Search, FolderOpen, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { validateCachedJava, scanJava, getJavaRecommendation, type JavaInstall } from '../logic/javaDetector';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

// ✅ 引入我们自己写的沉浸式目录选择器
import { DirectoryBrowserModal } from '../../../ui/components/DirectoryBrowserModal';

export const JavaSelector: React.FC<{ value: string; onChange: (path: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  // Java 列表弹窗状态
  const [isModalOpen, setModalOpen] = useState(false);
  const [javaList, setJavaList] = useState<JavaInstall[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  
  // 目录选择器弹窗状态
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [browserStartPath, setBrowserStartPath] = useState('');

  const wasModalOpen = useRef(false);

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
    wasModalOpen.current = isModalOpen;
  }, [isModalOpen]);

  const handleScan = async () => {
    setIsScanning(true);
    const javas = await scanJava();
    setJavaList(javas);
    setIsScanning(false);
  };

  // ✅ 唤起我们自己的浏览器，并自动定位到 runtime/java
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

  // ✅ 选择目录后，智能推导系统后缀
  const handleDirSelect = (dirPath: string) => {
    const isWin = dirPath.includes('\\');
    const sep = isWin ? '\\' : '/';
    const exeName = isWin ? 'javaw.exe' : 'java';
    
    // 智能判断用户选到了哪一层
    let executable = dirPath.endsWith('bin') ? `${dirPath}${sep}${exeName}` : `${dirPath}${sep}bin${sep}${exeName}`;
    
    onChange(executable);
    setIsBrowserOpen(false);
    setModalOpen(false); // 同时关闭底层的 Java 列表弹窗
  };

  return (
    <>
      {/* 入口触发器 */}
      <div className="flex gap-2">
        <div className="flex-1 cursor-pointer" onClick={() => !disabled && setModalOpen(true)}>
          <OreInput 
            value={value} 
            readOnly 
            placeholder="点击选择 Java 路径..." 
            disabled={disabled}
            className="cursor-pointer"
            containerClassName="!space-y-0"
          />
        </div>
        <OreButton variant="secondary" onClick={() => setModalOpen(true)} disabled={disabled} className="!px-4">
          选择...
        </OreButton>
      </div>

      {/* Java 列表弹窗 */}
      <OreModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="选择 Java 运行时" className="w-[600px] h-[500px]">
        <FocusBoundary id="java-selector-boundary" trapFocus={isModalOpen} onEscape={() => setModalOpen(false)} className="flex flex-col h-full outline-none">
          
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
                  <FocusItem key={java.path} focusKey={`java-item-${idx}`} onEnter={() => { onChange(java.path); setModalOpen(false); }}>
                    {({ ref, focused }) => (
                      <div
                        ref={ref as any} onClick={() => { onChange(java.path); setModalOpen(false); }}
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

      {/* ✅ 挂载嵌套的目录浏览器弹窗 */}
      <DirectoryBrowserModal 
        isOpen={isBrowserOpen} 
        onClose={() => setIsBrowserOpen(false)} 
        onSelect={handleDirSelect} 
        initialPath={browserStartPath} 
      />
    </>
  );
};