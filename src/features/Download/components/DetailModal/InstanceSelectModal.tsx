// /src/features/Download/components/DetailModal/InstanceSelectModal.tsx
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { Monitor, CheckCircle2, BoxSelect, Loader2, AlertTriangle } from 'lucide-react';
import { getProjectDetails, type OreProjectVersion } from '../../../InstanceDetail/logic/modrinthApi';
import { modService } from '../../../InstanceDetail/logic/modService';

interface InstanceSelectModalProps {
  isOpen: boolean;
  version: OreProjectVersion | null;
  onClose: () => void;
  onConfirm: (instanceId: string, autoInstallDeps: boolean) => void;
  ignoreLoader?: boolean; 
}

export const InstanceSelectModal: React.FC<InstanceSelectModalProps> = ({ 
  isOpen, version, onClose, onConfirm, ignoreLoader = false 
}) => {
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // 前置依赖相关状态
  const [isCheckingDeps, setIsCheckingDeps] = useState(false);
  const [missingDeps, setMissingDeps] = useState<{id: string, name: string}[]>([]);
  const [autoInstallDeps, setAutoInstallDeps] = useState(true);

  // 1. 初始化兼容实例列表
  useEffect(() => {
    if (isOpen && version) {
      setIsLoading(true);
      invoke<any[]>('get_compatible_instances', {
        gameVersions: version.game_versions,
        loaders: version.loaders,
        ignoreLoader 
      })
        .then(list => {
          setInstances(list || []);
          if (list && list.length > 0) setSelectedId(list[0].id);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    } else {
      setSelectedId('');
      setInstances([]);
      setMissingDeps([]);
    }
  }, [isOpen, version, ignoreLoader]);

  // 2. 核心逻辑：监听目标实例的切换，分析前置依赖
  useEffect(() => {
    let isMounted = true;
    
    // 💡 Debug 探针：按 F12 打开控制台查看数据是否正常到达前端
    console.log("[前置分析] 当前选中的 Version 数据:", version);

    if (!selectedId || !version || !version.dependencies) {
      if (isMounted) setMissingDeps([]);
      if (isOpen && version && !version.dependencies) {
        console.warn("[前置分析] 警告：当前版本的 dependencies 字段缺失，请确认 Rust 后端已重新编译并正确返回！");
      }
      return;
    }

    // 💡 容错过滤：强制转小写，并确保 project_id 存在
    const requiredDeps = version.dependencies.filter(
      d => d.dependency_type && d.dependency_type.toLowerCase() === 'required' && d.project_id
    );

    console.log("[前置分析] 筛选出的【必需(Required)】前置:", requiredDeps);

    if (requiredDeps.length === 0) {
      if (isMounted) setMissingDeps([]);
      return;
    }

    const checkDependencies = async () => {
      setIsCheckingDeps(true);
      try {
        // 获取所选实例本地已安装的 Mod（加了 catch 防止接口报错导致中断）
        const installedMods = await modService.getMods(selectedId).catch(() => []);
        const installedModIds = installedMods.map(m => m.modId).filter(Boolean);

        // 筛选出不在本地的前置
        const missing = requiredDeps.filter(d => !installedModIds.includes(d.project_id!));
        console.log("[前置分析] 对比本地已安装列表后，【真正缺失】的前置:", missing);

        if (missing.length === 0) {
          if (isMounted) setMissingDeps([]);
          return;
        }

        // 异步获取缺失前置的可读名称，增强用户体验
        const missingDetails = await Promise.all(
          missing.map(async (dep) => {
            try {
              const detail = await getProjectDetails(dep.project_id!);
              return { id: dep.project_id!, name: detail.title };
            } catch (e) {
              return { id: dep.project_id!, name: `未知前置 (${dep.project_id})` };
            }
          })
        );

        if (isMounted) setMissingDeps(missingDetails);
      } catch (error) {
        console.error("[前置分析] 检查前置失败:", error);
      } finally {
        if (isMounted) setIsCheckingDeps(false);
      }
    };

    checkDependencies();
    return () => { isMounted = false; };
  }, [selectedId, version, isOpen]);

  if (!isOpen || !version) return null;

  return (
    <OreModal 
      isOpen={isOpen} 
      onClose={onClose} 
      hideTitleBar={false} 
      title="选择安装目标"
      className="w-full max-w-lg bg-[#18181B] border-[2px] border-[#313233]"
      contentClassName="p-0 flex flex-col overflow-hidden"
    >
      <div className="p-5 border-b border-white/5 bg-black/40 text-sm text-gray-300 flex-shrink-0">
        <div className="font-minecraft text-lg text-white mb-1">目标实例确认</div>
        准备部署：<span className="text-ore-green font-bold truncate inline-block max-w-full align-bottom">{version.file_name}</span>
        <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-tighter">
          环境需求：MC {version.game_versions[0]} {ignoreLoader ? '' : `| ${version.loaders.join(', ')}`}
        </div>
      </div>

      <FocusBoundary id="instance-list-boundary" className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar min-h-[260px] max-h-[45vh] bg-[#111112]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-ore-green opacity-80 py-12">
            <Loader2 className="animate-spin mb-3" size={32} />
            <span className="font-minecraft text-sm">正在匹配兼容的实例...</span>
          </div>
        ) : instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <BoxSelect size={48} className="mb-4 opacity-50" />
            <div className="font-minecraft text-lg text-white mb-1 text-center">未找到匹配实例</div>
            <div className="text-xs text-center px-8">此 Mod 的运行环境与您现有的实例不兼容，请先创建一个匹配的实例。</div>
          </div>
        ) : (
          instances.map(inst => {
            const isSelected = selectedId === inst.id;
            return (
              <FocusItem key={inst.id} focusKey={`inst-item-${inst.id}`} onEnter={() => setSelectedId(inst.id)}>
                {({ ref, focused }) => (
                  <div
                    ref={ref as any}
                    onClick={() => setSelectedId(inst.id)}
                    className={`
                      relative group flex items-center p-3 rounded-sm border transition-all cursor-pointer overflow-hidden
                      ${isSelected ? 'border-ore-green bg-ore-green/10' : 'border-white/5 bg-black/30 hover:border-white/20'}
                      ${focused ? 'ring-2 ring-white scale-[1.02] brightness-110 z-10 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : ''}
                    `}
                  >
                    <Monitor size={24} className={`mr-4 transition-colors ${isSelected ? 'text-ore-green' : 'text-blue-400 opacity-60'}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-minecraft truncate text-base ${isSelected ? 'text-white font-bold' : 'text-gray-300'}`}>{inst.name}</div>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">{inst.version} | {inst.loader}</div>
                    </div>
                    {isSelected && <CheckCircle2 className="text-ore-green ml-3" size={20} />}
                  </div>
                )}
              </FocusItem>
            );
          })
        )}
      </FocusBoundary>

      <div className="p-4 border-t border-white/10 bg-black/60 flex flex-col flex-shrink-0">
        
        {isCheckingDeps ? (
          <div className="flex items-center text-ore-green text-xs font-minecraft mb-4 pl-1">
            <Loader2 size={14} className="animate-spin mr-2" /> 正在分析前置依赖环境...
          </div>
        ) : missingDeps.length > 0 ? (
          <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-sm mb-4">
            <div className="flex items-start text-yellow-500 mb-2">
              <AlertTriangle size={16} className="mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-xs font-minecraft leading-relaxed">
                该实例缺少 <span className="font-bold">{missingDeps.length}</span> 个必需的前置：<br/>
                <span className="text-yellow-400 font-bold">{missingDeps.map(d => d.name).join('、')}</span>
              </div>
            </div>
            
            <FocusItem focusKey="modal-inst-auto-deps" onEnter={() => setAutoInstallDeps(!autoInstallDeps)}>
              {({ ref, focused }) => (
                <div
                  ref={ref as any}
                  onClick={() => setAutoInstallDeps(!autoInstallDeps)}
                  className={`flex items-center gap-2.5 cursor-pointer p-1.5 rounded-sm transition-all outline-none w-max ${focused ? 'bg-white/10 ring-1 ring-white' : 'hover:bg-white/5'}`}
                >
                   <div className={`w-3.5 h-3.5 border flex items-center justify-center rounded-sm ${autoInstallDeps ? 'border-ore-green bg-ore-green' : 'border-gray-500 bg-transparent'}`}>
                     {autoInstallDeps && <CheckCircle2 size={10} className="text-black" />}
                   </div>
                   <span className="text-xs text-gray-300 font-minecraft uppercase tracking-wider">自动下载并补全前置模组</span>
                </div>
              )}
            </FocusItem>
          </div>
        ) : null}

        <div className="flex justify-end gap-4">
          <OreButton focusKey="modal-inst-cancel" variant="secondary" onClick={onClose}>
            取消
          </OreButton>
          <OreButton 
            focusKey="modal-inst-confirm" 
            variant="primary" 
            disabled={!selectedId || isLoading || isCheckingDeps} 
            onClick={() => onConfirm(selectedId, missingDeps.length > 0 ? autoInstallDeps : false)}
            className="font-bold tracking-widest text-black"
          >
            确认并部署
          </OreButton>
        </div>
      </div>
    </OreModal>
  );
};