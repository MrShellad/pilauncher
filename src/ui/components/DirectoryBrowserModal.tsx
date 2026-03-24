// src/ui/components/DirectoryBrowserModal.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, HardDrive, CornerLeftUp, Plus, Check, X, AlertCircle, Gamepad2, MousePointer2 } from 'lucide-react';
import { OreButton } from '../primitives/OreButton';

import { FocusBoundary } from '../focus/FocusBoundary';
import { FocusItem } from '../focus/FocusItem';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useInputAction } from '../focus/InputDriver';
import { useInputMode } from '../focus/FocusProvider';
import { ControlHint } from './ControlHint';

interface DirNode {
  name: string;
  path: string;
  is_drive: boolean;
}

interface DirectoryBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string; // ✅ 新增：允许从外部指定初始打开的路径
}

type FocusSection = 'header' | 'list' | 'footer';
const sectionOrder: FocusSection[] = ['header', 'list', 'footer'];

export const DirectoryBrowserModal: React.FC<DirectoryBrowserModalProps> = ({ isOpen, onClose, onSelect, initialPath }) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [nodes, setNodes] = useState<DirNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [newDirName, setNewDirName] = useState('PiLauncher'); 

  const listContainerRef = useRef<HTMLDivElement>(null);
  const initialFocusDoneRef = useRef(false);
  const activeSectionRef = useRef<FocusSection>('list');
  const sectionFocusRef = useRef<Record<FocusSection, string | null>>({
    header: null,
    list: null,
    footer: null
  });
  const inputMode = useInputMode();
  const getDirFocusKey = (path: string) => `dir-item-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;

  // ✅ 核心机制：当弹窗开启且有 initialPath 时，立刻跳转
  useEffect(() => {
    if (isOpen) {
      if (initialPath) setCurrentPath(initialPath);
      else setCurrentPath('');
    }
  }, [isOpen, initialPath]);

  useEffect(() => {
    if (!isOpen) return;
    loadDirectory(currentPath);
  }, [isOpen, currentPath]);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      if (!path) {
        const drives = await invoke<DirNode[]>('get_drives');
        setNodes(drives);
      } else {
        const dirs = await invoke<DirNode[]>('list_valid_dirs', { path });
        setNodes(dirs);
      }
      if(listContainerRef.current) listContainerRef.current.scrollTop = 0;
    } catch (e: any) {
      setError(String(e));
      setNodes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGoUp = async () => {
    if (!currentPath) return;
    try {
      const parent = await invoke<string | null>('get_parent_dir', { path: currentPath });
      setCurrentPath(parent || '');
    } catch (e) {}
  };

  const handleCreateDir = async () => {
    if (!newDirName.trim()) return;
    try {
      const newPath = await invoke<string>('create_valid_dir', { parent: currentPath, name: newDirName.trim() });
      setIsCreating(false);
      setNewDirName('PiLauncher');
      setCurrentPath(newPath); 
    } catch (e: any) {
      setError(String(e));
    }
  };

  useEffect(() => {
    if (!isOpen || !isCreating) return;
    const timer = setTimeout(() => {
      if (doesFocusableExist('dir-btn-confirm-new')) {
        setFocus('dir-btn-confirm-new');
        activeSectionRef.current = 'list';
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [isOpen, isCreating]);

  const rememberSectionFocus = useCallback((section: FocusSection, focusKey: string) => {
    sectionFocusRef.current[section] = focusKey;
    activeSectionRef.current = section;
  }, []);

  const resolveSectionFocus = useCallback((section: FocusSection) => {
    const stored = sectionFocusRef.current[section];
    if (stored && doesFocusableExist(stored)) return stored;

    if (section === 'header') {
      if (currentPath && doesFocusableExist('dir-btn-up')) return 'dir-btn-up';
      if (currentPath && doesFocusableExist('dir-btn-new')) return 'dir-btn-new';
      return null;
    }

    if (section === 'list') {
      if (isCreating) {
        if (doesFocusableExist('dir-btn-confirm-new')) return 'dir-btn-confirm-new';
        if (doesFocusableExist('dir-btn-cancel-new')) return 'dir-btn-cancel-new';
      }
      if (nodes.length > 0) {
        const key = getDirFocusKey(nodes[0].path);
        if (doesFocusableExist(key)) return key;
      }
      return null;
    }

    if (section === 'footer') {
      if (currentPath && doesFocusableExist('dir-btn-select')) return 'dir-btn-select';
      if (doesFocusableExist('dir-btn-cancel')) return 'dir-btn-cancel';
      return null;
    }

    return null;
  }, [currentPath, isCreating, nodes, getDirFocusKey]);

  const focusSection = useCallback((section: FocusSection) => {
    const target = resolveSectionFocus(section);
    if (target) {
      setFocus(target);
      activeSectionRef.current = section;
      return true;
    }
    return false;
  }, [resolveSectionFocus]);

  useEffect(() => {
    if (!isOpen) {
      initialFocusDoneRef.current = false;
      activeSectionRef.current = 'list';
      sectionFocusRef.current = { header: null, list: null, footer: null };
      return;
    }
    if (loading || initialFocusDoneRef.current) return;

    const timer = setTimeout(() => {
      if (initialFocusDoneRef.current || !isOpen) return;
      const focused = focusSection('list') || focusSection('header') || focusSection('footer');
      if (focused) initialFocusDoneRef.current = true;
    }, 80);

    return () => clearTimeout(timer);
  }, [isOpen, loading, focusSection]);

  useInputAction('ACTION_Y', () => {
    if (!isOpen || inputMode !== 'controller') return;
    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;

    const current = activeSectionRef.current;
    const currentIndex = sectionOrder.indexOf(current);
    for (let i = 1; i <= sectionOrder.length; i += 1) {
      const next = sectionOrder[(currentIndex + i) % sectionOrder.length];
      if (focusSection(next)) break;
    }
  });

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center font-minecraft"
    >
      <FocusBoundary id="directory-browser-boundary" trapFocus={isOpen} onEscape={onClose} className="relative z-10 outline-none">
        <motion.div 
          initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
          className="w-[700px] h-[560px] bg-[#18181B] border-2 border-[#1E1E1F] shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="bg-[#1E1E1F] p-5 border-b-2 border-[#1E1E1F] flex flex-col gap-4 shrink-0">
            <h3 className="text-white text-xl">选择存放目录</h3>
            <div className="flex items-center gap-3">
              <OreButton
                onClick={handleGoUp}
                disabled={!currentPath}
                variant="secondary"
                size="auto"
                focusKey="dir-btn-up"
                className="!h-10"
                onArrowPress={(direction) => (direction === 'up' || direction === 'down' ? false : true)}
                onFocus={() => rememberSectionFocus('header', 'dir-btn-up')}
              >
                <CornerLeftUp size={18} />
              </OreButton>
              <div className="flex-1 bg-[#141415] border border-[#2A2A2C] text-ore-text-muted px-3 h-10 flex items-center text-sm truncate">
                {currentPath || '此电脑 / 根节点'}
              </div>
              {currentPath && (
                <OreButton
                  onClick={() => setIsCreating(true)}
                  variant="primary"
                  size="auto"
                  focusKey="dir-btn-new"
                  className="!h-10"
                  onArrowPress={(direction) => (direction === 'up' || direction === 'down' ? false : true)}
                  onFocus={() => rememberSectionFocus('header', 'dir-btn-new')}
                >
                  <Plus size={18} className="mr-1" /> 新建目录
                </OreButton>
              )}
            </div>
          </div>

          <div ref={listContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-[#141415] relative">
            {error && (
              <div className="mx-2 mb-3 bg-red-500/10 text-red-400 p-3 text-sm border border-red-500/50 flex items-center">
                <AlertCircle size={16} className="mr-2 shrink-0" /> {error}
              </div>
            )}

            {isCreating && (
              <div className="flex items-center gap-3 p-3 bg-ore-green/10 border border-ore-green/30 mb-3">
                <Folder size={24} className="text-ore-green shrink-0" />
                <input 
                  autoFocus={inputMode !== 'controller'}
                  type="text" 
                  value={newDirName}
                  onChange={(e) => setNewDirName(e.target.value.replace(/[^\w\s-]/g, ''))} 
                  className="flex-1 bg-black/50 border border-[#2A2A2C] text-white px-3 py-1.5 outline-none focus:border-ore-green text-base"
                />
                <FocusItem
                  focusKey="dir-btn-confirm-new"
                  onEnter={handleCreateDir}
                  onArrowPress={(direction) => {
                    if (direction === 'up') return false;
                    if (direction === 'down' && nodes.length === 0) return false;
                    return true;
                  }}
                  onFocus={() => rememberSectionFocus('list', 'dir-btn-confirm-new')}
                >
                  {({ ref, focused }) => (
                    <button ref={ref as any} onClick={handleCreateDir} className={`p-1 rounded-sm outline-none transition-all ${focused ? 'bg-ore-green text-black scale-110' : 'text-ore-green hover:brightness-125'}`}><Check size={20} /></button>
                  )}
                </FocusItem>
                <FocusItem
                  focusKey="dir-btn-cancel-new"
                  onEnter={() => setIsCreating(false)}
                  onArrowPress={(direction) => {
                    if (direction === 'up') return false;
                    if (direction === 'down' && nodes.length === 0) return false;
                    return true;
                  }}
                  onFocus={() => rememberSectionFocus('list', 'dir-btn-cancel-new')}
                >
                  {({ ref, focused }) => (
                    <button ref={ref as any} onClick={() => setIsCreating(false)} className={`p-1 rounded-sm outline-none transition-all ${focused ? 'bg-red-400 text-black scale-110' : 'text-red-400 hover:brightness-125'}`}><X size={20} /></button>
                  )}
                </FocusItem>
              </div>
            )}

            {loading ? (
              <div className="text-center text-ore-text-muted mt-10 text-base animate-pulse">正在读取...</div>
            ) : (
              <div className="space-y-1">
                {nodes.map((node, index) => (
                  <FocusItem 
                    key={node.path} focusKey={getDirFocusKey(node.path)}
                    onEnter={() => setCurrentPath(node.path)}
                    defaultFocused={index === 0 && !isCreating}
                    onArrowPress={(direction) => {
                      if (direction === 'left' || direction === 'right') return false;
                      if (direction === 'up' && index === 0 && !isCreating) return false;
                      if (direction === 'down' && index === nodes.length - 1) return false;
                      return true;
                    }}
                    onFocus={() => rememberSectionFocus('list', getDirFocusKey(node.path))}
                  >
                    {({ ref, focused }) => (
                      <div 
                        ref={ref as any}
                        onClick={() => { (ref.current as any)?.focus(); }}
                        onDoubleClick={() => setCurrentPath(node.path)} 
                        className={`flex items-center p-3 rounded-sm transition-all select-none cursor-pointer outline-none group border-2 ${focused ? 'bg-ore-green/15 border-ore-green shadow-lg scale-[1.01] z-10 text-white' : 'bg-transparent border-transparent text-ore-text-muted hover:bg-white/5 hover:text-white'}`}
                      >
                        {node.is_drive ? <HardDrive size={28} className={`mr-4 shrink-0 transition-colors ${focused ? 'text-ore-green' : 'group-hover:text-white'}`} /> : <Folder size={28} className={`mr-4 shrink-0 transition-colors ${focused ? 'text-ore-green' : 'group-hover:text-white'}`} />}
                        <span className="flex-1 truncate text-lg font-minecraft">{node.name}</span>
                        
                        <AnimatePresence>
                          {focused && (
                            <motion.div initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 5 }} className="flex items-center gap-2 text-xs text-ore-green/80 pl-2">
                              <span className="intent-gamepad:flex hidden items-center gap-1.5">
                                <Gamepad2 size={14}/> <ControlHint label="A" variant="face" tone="green" /> 进入
                              </span>
                              <span className="intent-mouse:flex hidden items-center gap-1.5"><MousePointer2 size={14}/> 双击进入</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </FocusItem>
                ))}
              </div>
            )}
            
            {!loading && nodes.length === 0 && !isCreating && !error && (
              <div className="text-center text-ore-text-muted mt-16 text-base flex flex-col items-center gap-3 opacity-60">
                <Folder size={40} className="opacity-40" />
                暂无子目录
              </div>
            )}
          </div>

          <div className="bg-[#1E1E1F] p-3 border-t-2 border-[#1E1E1F] flex items-center justify-between shrink-0">
            <div className="hidden items-center gap-3 whitespace-nowrap intent-gamepad:flex">
              <div className="flex items-center gap-2">
                <ControlHint label="A" variant="face" tone="green" />
                <span className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-ore-text-muted">确认</span>
              </div>
              <div className="flex items-center gap-2">
                <ControlHint label="B" variant="face" tone="red" />
                <span className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-ore-text-muted">取消</span>
              </div>
              <div className="flex items-center gap-2">
                <ControlHint label="Y" variant="face" tone="yellow" />
                <span className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-ore-text-muted">切换区域</span>
              </div>
            </div>
            <div className="flex items-center gap-3 whitespace-nowrap intent-gamepad:hidden">
              <div className="flex items-center gap-2">
                <ControlHint label="A" variant="keyboard" tone="neutral" />
                <span className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-ore-text-muted">确认</span>
              </div>
              <div className="flex items-center gap-2">
                <ControlHint label="B" variant="keyboard" tone="neutral" />
                <span className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-ore-text-muted">取消</span>
              </div>
              <div className="flex items-center gap-2">
                <ControlHint label="Y" variant="keyboard" tone="neutral" />
                <span className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-ore-text-muted">切换区域</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-4">
              <OreButton
                onClick={onClose}
                variant="ghost"
                size="auto"
                focusKey="dir-btn-cancel"
                className="!h-10"
                onArrowPress={(direction) => (direction === 'up' || direction === 'down' ? false : true)}
                onFocus={() => rememberSectionFocus('footer', 'dir-btn-cancel')}
              >
                取消
              </OreButton>
              <OreButton
                onClick={() => onSelect(currentPath)}
                disabled={!currentPath}
                variant="primary"
                size="auto"
                focusKey="dir-btn-select"
                className="!h-10"
                onArrowPress={(direction) => (direction === 'up' || direction === 'down' ? false : true)}
                onFocus={() => rememberSectionFocus('footer', 'dir-btn-select')}
              >
                选择当前目录
              </OreButton>
            </div>
          </div>
        </motion.div>
      </FocusBoundary>
    </motion.div>
  );
};
