// /src/features/home/components/InstanceSelectModal.tsx
import React, { useEffect } from 'react';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreInstanceCard } from '../../../ui/primitives/OreInstanceCard';
import { useInstances } from '../../../hooks/pages/Instances/useInstances';
import { useTranslation } from 'react-i18next';

// 引入空间焦点引擎组件
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { focusManager } from '../../../ui/focus/FocusManager';

// ✅ 引入全局 Store，用于记忆选择
import { useLauncherStore } from '../../../store/useLauncherStore';

interface InstanceSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
}

export const InstanceSelectModal: React.FC<InstanceSelectModalProps> = ({
  isOpen,
  onClose,
  selectedId, // 父组件传来的状态（如果存在）
  onSelect,
}) => {
  const { instances } = useInstances();
  const { t } = useTranslation();
  
  // ✅ 获取全局存储的方法和记忆的 ID
  const globalSelectedId = useLauncherStore(state => state.selectedInstanceId);
  const setSelectedInstanceId = useLauncherStore(state => state.setSelectedInstanceId);

  // 综合判定当前高亮的 ID：优先用父组件传的 -> 其次用全局记忆的 -> 最后默认选第一个
  const currentSelectedId = selectedId || globalSelectedId || (instances.length > 0 ? instances[0].id : null);

  // ✅ 拦截点击事件，将选择同步到持久化 Store 中
  const handleSelect = (id: string) => {
    setSelectedInstanceId(id); // 记忆选择，下次打开启动器依然生效
    onSelect(id);              // 通知父组件
    onClose();                 // 选择后自动关闭弹窗
  };

  useEffect(() => {
    if (isOpen) {
      if (currentSelectedId) {
        setTimeout(() => focusManager.focus(`instance-card-${currentSelectedId}`), 100);
      }
    } else {
      focusManager.focus('instance-button');
    }
  }, [isOpen, currentSelectedId, instances]);

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('home.selectInstanceModal.title')}
      className="w-full max-w-4xl"
    >
      <FocusBoundary id="instance-select-boundary" trapFocus={true} onEscape={onClose}>
        
        {instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-[#1E1E1F] bg-[#141415]/50 m-2">
            <span className="text-ore-text-muted font-minecraft mb-2 tracking-wider">
              {t('home.selectInstanceModal.empty')}
            </span>
            <span className="text-[#A0A0A0] font-minecraft text-xs">
              {t('home.selectInstanceModal.emptyHint')}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-2 max-h-[60vh] overflow-y-auto no-scrollbar pb-6">
            {instances.map((instance) => (
              
              <FocusItem 
                key={instance.id} 
                focusKey={`instance-card-${instance.id}`} 
                onEnter={() => handleSelect(instance.id)} // ✅ 使用拦截器
              >
                {({ ref, focused }) => (
                  <div 
                    ref={ref}
                    onClick={() => handleSelect(instance.id)} // ✅ 使用拦截器
                    className={`
                      rounded-sm transition-all duration-200 cursor-pointer
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
                      isActive={instance.id === currentSelectedId} // ✅ 使用智能判定的 ID
                      onClick={() => handleSelect(instance.id)} // ✅ 使用拦截器
                      className="w-full h-64 pointer-events-none" // 卡片内部不要阻挡外层的点击
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