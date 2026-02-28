// src/features/runtime/components/JavaSelector.tsx
import React, { useState, useEffect, useRef } from 'react';
import { OreInput } from '../../../ui/primitives/OreInput';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreModal } from '../../../ui/primitives/OreModal';
import { FocusItem } from '../../../ui/focus/FocusItem';
// ✅ 1. 引入焦点边界容器
import { FocusBoundary } from '../../../ui/focus/FocusBoundary'; 
import { Search, FolderOpen, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { validateCachedJava, scanJava, getJavaRecommendation, type JavaInstall } from '../logic/javaDetector';

import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

export const JavaSelector: React.FC<{ value: string; onChange: (path: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const [isModalOpen, setModalOpen] = useState(false);
  const [javaList, setJavaList] = useState<JavaInstall[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  
  // ✅ 2. 增加一个标记，用来记录弹窗“刚刚是否处于打开状态”
  const wasModalOpen = useRef(false);

  const loadFromCache = async () => {
    setIsScanning(true);
    const { valid } = await validateCachedJava();
    setJavaList(valid.sort((a, b) => b.version.localeCompare(a.version)));
    setIsScanning(false);
  };

  const handleOpen = () => {
    setModalOpen(true);
    if (javaList.length === 0) loadFromCache();
  };

  const handleDeepScan = async () => {
    setIsScanning(true);
    const result = await scanJava();
    setJavaList(result);
    setIsScanning(false);
  };

  // ✅ 3. 核心修复：完整的“切入与回落”焦点闭环控制
  useEffect(() => {
    if (isModalOpen && !isScanning) {
      // 弹窗准备就绪，标记为打开，并把焦点拽入弹窗
      wasModalOpen.current = true;
      const timer = setTimeout(() => {
        setFocus('modal-选择 Java 运行时');
      }, 100);
      return () => clearTimeout(timer);
    } else if (!isModalOpen && wasModalOpen.current) {
      // 弹窗刚刚被关闭！重置标记，并呼叫底层的边界容器恢复记忆
      wasModalOpen.current = false;
      const timer = setTimeout(() => {
        setFocus('java-selector-boundary');
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen, isScanning]);

  return (
    <>
      {/* ✅ 4. 用 FocusBoundary 替换掉原来的 div。
          它不会影响任何 CSS 布局，但它拥有记忆功能：
          会永远记住内部最后一次被选中的元素（即那个“选择 Java”按钮）！ */}
      <FocusBoundary id="java-selector-boundary" className="flex flex-col space-y-3 w-full max-w-md">
        <OreInput value={value} onChange={(e) => onChange(e.target.value)} placeholder="未选择 Java..." disabled={disabled} />
        <div className="flex space-x-3">
          <OreButton size="sm" onClick={handleOpen} disabled={disabled}><Search size={16} className="mr-2" /> 选择 Java</OreButton>
          <OreButton size="sm" variant="secondary" disabled={disabled}><FolderOpen size={16} className="mr-2" /> 浏览...</OreButton>
        </div>
      </FocusBoundary>

      <OreModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="选择 Java 运行时" className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm font-minecraft text-ore-text-muted">已从缓存中读取，点击可应用。如果不准确，请重新扫描。</p>
          <OreButton size="sm" variant="secondary" onClick={handleDeepScan} disabled={isScanning}>
            <RefreshCw size={14} className={`mr-2 ${isScanning ? 'animate-spin' : ''}`} /> 重新扫描硬盘
          </OreButton>
        </div>

        {isScanning && javaList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-ore-green font-minecraft">
            <Loader2 size={32} className="animate-spin mb-4" />
            <p>正在深度扫描磁盘可能存在的 Java...</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-2">
            {javaList.length === 0 && !isScanning && (
              <div className="text-center py-8 text-ore-text-muted font-minecraft">未在默认路径找到 Java，请尝试重新扫描或手动浏览。</div>
            )}
            {javaList.map((java, i) => {
              const rec = getJavaRecommendation(java.version);
              return (
                <FocusItem key={i} onEnter={() => { onChange(java.path); setModalOpen(false); }}>
                  {({ ref, focused }) => (
                    <div
                      ref={ref} onClick={() => { onChange(java.path); setModalOpen(false); }}
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
            })}
          </div>
        )}
      </OreModal>
    </>
  );
};