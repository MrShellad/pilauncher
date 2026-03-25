// src/ui/components/DirectoryBrowserModal.tsx
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, HardDrive, CornerLeftUp, Plus, Check, X, AlertCircle, Gamepad2, MousePointer2 } from 'lucide-react';
import { OreButton } from '../primitives/OreButton';

import { FocusBoundary } from '../focus/FocusBoundary';
import { FocusItem } from '../focus/FocusItem';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useInputMode } from '../focus/FocusProvider';
import { ControlHint } from './ControlHint';
import { useLinearNavigation } from '../focus/useLinearNavigation';
import { useInputAction } from '../focus/InputDriver';

import { useDirectoryBrowser } from '../hooks/useDirectoryBrowser';

interface DirectoryBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

export const DirectoryBrowserModal: React.FC<DirectoryBrowserModalProps> = ({ isOpen, onClose, onSelect, initialPath }) => {
  // 业务逻辑与内部状态已全部交给 Hook 管理
  const {
    currentPath, nodes, loading, error,
    goUp, goToPath,
    isCreating, newDirName, setNewDirName,
    startCreating, cancelCreating, confirmCreateDir
  } = useDirectoryBrowser(isOpen, initialPath);

  const listContainerRef = useRef<HTMLDivElement>(null);
  const inputMode = useInputMode();

  const getDirFocusKey = (path: string) => `dir-item-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;

  // 构建线性焦点链条
  const focusOrder = [
    'dir-btn-up',
    'dir-btn-new',
    ...(isCreating ? ['dir-btn-confirm-new', 'dir-btn-cancel-new'] : []),
    ...nodes.map(node => getDirFocusKey(node.path)),
    'dir-btn-cancel',
    'dir-btn-select'
  ];

  const { handleLinearArrow } = useLinearNavigation(
    focusOrder,
    nodes.length > 0 ? getDirFocusKey(nodes[0].path) : 'dir-btn-cancel',
    true,
    isOpen && !loading
  );

  // 监听库内路径变化，自动将滚动条置顶
  useEffect(() => {
    if (listContainerRef.current) listContainerRef.current.scrollTop = 0;
  }, [currentPath]);

  // 绑定手柄 B 键 / 键盘 Esc 键取消按键
  useInputAction('CANCEL', () => {
    if (!isOpen) return;
    if (isCreating) {
      cancelCreating();
    } else {
      onClose();
    }
  });

  // 新建目录时的焦点重置：如果进入创建模式，强制将焦点移到确认按钮
  useEffect(() => {
    if (isOpen && isCreating) {
      const timer = setTimeout(() => {
        if (doesFocusableExist('dir-btn-confirm-new')) {
          setFocus('dir-btn-confirm-new');
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isCreating]);

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
          {/* Header */}
          <div className="bg-[#1E1E1F] p-5 border-b-2 border-[#1E1E1F] flex flex-col gap-4 shrink-0">
            <h3 className="text-white text-xl">选择存放目录</h3>
            <div className="flex items-center gap-3">
              <OreButton
                onClick={goUp}
                disabled={!currentPath}
                variant="secondary"
                size="auto"
                focusKey="dir-btn-up"
                className="!h-10"
                onArrowPress={handleLinearArrow}
              >
                <CornerLeftUp size={18} />
              </OreButton>
              <div className="flex-1 bg-[#141415] border border-[#2A2A2C] text-ore-text-muted px-3 h-10 flex items-center text-sm truncate">
                {currentPath || '此电脑 / 根节点'}
              </div>
              {currentPath && (
                <OreButton
                  onClick={startCreating}
                  variant="primary"
                  size="auto"
                  focusKey="dir-btn-new"
                  className="!h-10"
                  onArrowPress={handleLinearArrow}
                >
                  <Plus size={18} className="mr-1" /> 新建目录
                </OreButton>
              )}
            </div>
          </div>

          {/* List Section */}
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
                <FocusItem focusKey="dir-btn-confirm-new" onEnter={confirmCreateDir} onArrowPress={handleLinearArrow}>
                  {({ ref, focused }) => (
                    <button ref={ref as any} onClick={confirmCreateDir} className={`p-1 rounded-sm outline-none transition-all ${focused ? 'bg-ore-green text-black scale-110' : 'text-ore-green hover:brightness-125'}`}><Check size={20} /></button>
                  )}
                </FocusItem>
                <FocusItem focusKey="dir-btn-cancel-new" onEnter={cancelCreating} onArrowPress={handleLinearArrow}>
                  {({ ref, focused }) => (
                    <button ref={ref as any} onClick={cancelCreating} className={`p-1 rounded-sm outline-none transition-all ${focused ? 'bg-red-400 text-black scale-110' : 'text-red-400 hover:brightness-125'}`}><X size={20} /></button>
                  )}
                </FocusItem>
              </div>
            )}

            {loading ? (
              <div className="text-center text-ore-text-muted mt-10 text-base animate-pulse">正在读取...</div>
            ) : (
              <div className="space-y-1">
                {nodes.map((node) => (
                  <FocusItem
                    key={node.path}
                    focusKey={getDirFocusKey(node.path)}
                    onEnter={() => goToPath(node.path)}
                    // 允许上下按键由线性导航接管，左右按键拦截
                    onArrowPress={(direction) => {
                      if (direction === 'up' || direction === 'down') {
                        return handleLinearArrow(direction);
                      }
                      return false; // 拦截左右
                    }}
                  >
                    {({ ref, focused }) => (
                      <div
                        ref={ref as any}
                        onClick={() => { (ref.current as any)?.focus(); }}
                        onDoubleClick={() => goToPath(node.path)}
                        className={`flex items-center p-3 rounded-sm transition-all select-none cursor-pointer outline-none group border-2 ${focused ? 'bg-ore-green/15 border-ore-green shadow-lg scale-[1.01] z-10 text-white' : 'bg-transparent border-transparent text-ore-text-muted hover:bg-white/5 hover:text-white'}`}
                      >
                        {node.is_drive ? <HardDrive size={28} className={`mr-4 shrink-0 transition-colors ${focused ? 'text-ore-green' : 'group-hover:text-white'}`} /> : <Folder size={28} className={`mr-4 shrink-0 transition-colors ${focused ? 'text-ore-green' : 'group-hover:text-white'}`} />}
                        <span className="flex-1 truncate text-lg font-minecraft">{node.name}</span>

                        <AnimatePresence>
                          {focused && (
                            <motion.div initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 5 }} className="flex items-center gap-2 text-xs text-ore-green/80 pl-2">
                              <span className="intent-gamepad:flex hidden items-center gap-1.5">
                                <Gamepad2 size={14} /> <ControlHint label="A" variant="face" tone="green" /> 进入
                              </span>
                              <span className="intent-mouse:flex hidden items-center gap-1.5"><MousePointer2 size={14} /> 双击进入</span>
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

          {/* Footer */}
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
            </div>
            <div className="flex items-center justify-end gap-4">
              <OreButton
                onClick={onClose}
                variant="ghost"
                size="auto"
                focusKey="dir-btn-cancel"
                className="!h-10"
                onArrowPress={handleLinearArrow}
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
                onArrowPress={handleLinearArrow}
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