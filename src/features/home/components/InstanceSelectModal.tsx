// /src/features/home/components/InstanceSelectModal.tsx
import React, { useEffect } from 'react';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreInstanceCard } from '../../../ui/primitives/OreInstanceCard';
import { useInstances } from '../../../hooks/pages/Instances/useInstances';

// ✅ 引入空间焦点引擎组件
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { focusManager } from '../../../ui/focus/FocusManager';

interface InstanceSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
}

export const InstanceSelectModal: React.FC<InstanceSelectModalProps> = ({
  isOpen,
  onClose,
  selectedId,
  onSelect,
}) => {
  const { instances } = useInstances();

  // ✅ 焦点自动吸附与退回逻辑
  useEffect(() => {
    if (isOpen) {
      // 打开弹窗时，延迟一点等待动画，然后强行将焦点吸附到当前选中的实例上
      const targetId = selectedId || (instances.length > 0 ? instances[0].id : null);
      if (targetId) {
        setTimeout(() => focusManager.focus(`instance-card-${targetId}`), 100);
      }
    } else {
      // 弹窗关闭时，焦点退回到首页的选择按钮上
      focusManager.focus('instance-button');
    }
  }, [isOpen, selectedId, instances]);

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title="选择启动实例"
      className="w-full max-w-4xl"
    >
      {/* ✅ 焦点隔离边界，trapFocus={true} 确保焦点不会跑出弹窗外 */}
      <FocusBoundary id="instance-select-boundary" trapFocus={true} onEscape={onClose}>
        
        {instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-[#1E1E1F] bg-[#141415]/50 m-2">
            <span className="text-ore-text-muted font-minecraft mb-2 tracking-wider">
              尚未创建任何实例
            </span>
            <span className="text-[#A0A0A0] font-minecraft text-xs">
              请前往「实例管理」页面创建或导入你的第一个游戏环境
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-2 max-h-[60vh] overflow-y-auto no-scrollbar pb-6">
            {instances.map((instance) => (
              
              // ✅ 让每个卡片都成为可被手柄选中的焦点项
              <FocusItem 
                key={instance.id} 
                focusKey={`instance-card-${instance.id}`} 
                onEnter={() => onSelect(instance.id)}
              >
                {({ ref, focused }) => (
                  <div 
                    ref={ref}
                    className={`
                      rounded-sm transition-all duration-200 
                      ${focused ? 'outline outline-[4px] outline-offset-4 outline-white/80 scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.2)] z-10' : ''}
                    `}
                  >
                    <OreInstanceCard
                      id={instance.id}
                      name={instance.name}
                      mcVersion={instance.version}
                      loaderType={instance.loader}
                      lastPlayed={instance.lastPlayed}
                      coverUrl={instance.coverUrl}
                      isActive={instance.id === selectedId}
                      onClick={() => onSelect(instance.id)}
                      className="w-full h-64"
                    />
                  </div>
                )}
              </FocusItem>

            ))}
          </div>
        )}

      </FocusBoundary>
    </OreModal>
  );
};