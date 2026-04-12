import React, { useState, useEffect } from 'react';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { FileUp, GitCommit, Play, RefreshCw, Trash2 } from 'lucide-react';
import type { InstanceSnapshot, SnapshotDiff } from '../../logic/modService';

interface ModSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: InstanceSnapshot[];
  diffs: Record<string, SnapshotDiff>;
  onDiffRequest: (oldId: string, newId: string) => void;
  onRollback: (snapshotId: string) => void;
  isRollingBack: boolean;
}

export const ModSnapshotModal: React.FC<ModSnapshotModalProps> = ({
  isOpen,
  onClose,
  history,
  diffs,
  onDiffRequest,
  onRollback,
  isRollingBack
}) => {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && history.length > 0 && !selectedSnapshotId) {
      setSelectedSnapshotId(history[0].id);
    }
  }, [isOpen, history]);

  useEffect(() => {
    if (selectedSnapshotId && history.length > 0) {
      const currentIndex = history.findIndex(s => s.id === selectedSnapshotId);
      if (currentIndex < history.length - 1) {
        const previouSnapshotId = history[currentIndex + 1].id;
        const diffKey = `${previouSnapshotId}->${selectedSnapshotId}`;
        if (!diffs[diffKey]) {
          onDiffRequest(previouSnapshotId, selectedSnapshotId);
        }
      }
    }
  }, [selectedSnapshotId, history, diffs, onDiffRequest]);

  if (!isOpen) return null;

  const selectedSnapshot = history.find(s => s.id === selectedSnapshotId);
  const currentIndex = history.findIndex(s => s.id === selectedSnapshotId);
  const previousSnapshot = currentIndex < history.length - 1 ? history[currentIndex + 1] : null;
  const currentDiff = previousSnapshot 
    ? diffs[`${previousSnapshot.id}->${selectedSnapshotId}`] 
    : null;

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  };

  return (
    <OreModal isOpen={isOpen} onClose={onClose} title="Mod 快照与时间轴" width="max-w-6xl" allowGamepad>
      <div className="flex h-[70vh] gap-6 text-white font-minecraft">
        
        {/* 左侧结构：时间轴 */}
        <div className="w-1/3 flex flex-col border-r-2 border-white/10 pr-4 overflow-y-auto custom-scrollbar">
          <h3 className="text-lg mb-4 text-ore-green flex items-center">
            <GitCommit size={20} className="mr-2" />
            版本历史
          </h3>
          
          {history.length === 0 ? (
            <div className="text-center text-white/50 mt-10">暂无任何快照记录</div>
          ) : (
            <div className="flex flex-col gap-2">
              {history.map((snap, index) => {
                const isSelected = selectedSnapshotId === snap.id;
                return (
                  <button
                    key={snap.id}
                    onClick={() => setSelectedSnapshotId(snap.id)}
                    className={`text-left p-3 border-2 transition-all group relative overflow-hidden ${
                      isSelected 
                        ? 'border-ore-green bg-ore-green/10' 
                        : 'border-white/10 hover:border-white/30 bg-[#18181B]'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm">
                        {index === 0 ? '最新状态' : `版本 #${history.length - index}`}
                      </span>
                      <span className="text-xs text-white/50">{formatDate(snap.timestamp)}</span>
                    </div>
                    <div className="text-xs text-white/70 line-clamp-2">
                      {snap.message || '未提供备注'}
                    </div>
                    <div className="mt-2 text-xs text-white/40">
                      模块数量: {snap.mods.length}
                    </div>
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-ore-green shadow-[0_0_8px_#55FF55]" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 右侧结构：快照详情与 Diff */}
        <div className="flex-1 flex flex-col pl-2">
          {selectedSnapshot ? (
            <>
              <div className="mb-6 pb-4 border-b-2 border-white/10">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold mb-2 break-all">{selectedSnapshot.message || '快照状态'}</h2>
                    <div className="text-sm text-white/60">
                      创建时间: {formatDate(selectedSnapshot.timestamp)} | 触发器: {selectedSnapshot.trigger}
                    </div>
                  </div>
                  
                  {/* 回滚操作 */}
                  <OreButton 
                    variant="hero" 
                    size="auto"
                    disabled={isRollingBack}
                    onClick={() => onRollback(selectedSnapshot.id)}
                    className="!h-12 shadow-[0_0_15px_rgba(85,255,85,0.4)]"
                  >
                    {isRollingBack ? (
                      <RefreshCw className="animate-spin mr-2" size={18} />
                    ) : (
                      <RefreshCw className="mr-2" size={18} />
                    )}
                    {isRollingBack ? '正在重构目录...' : '回退到此快照'}
                  </OreButton>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
                <h3 className="text-lg mb-4 text-white/80">
                  {previousSnapshot ? '与上一个版本的变更差异' : '初始版本状态'}
                </h3>

                {previousSnapshot && !currentDiff ? (
                  <div className="flex justify-center items-center h-32 text-white/50">
                    <RefreshCw className="animate-spin mr-2" size={20} />
                    计算差异中...
                  </div>
                ) : null}

                {/* Diff 视图 */}
                {currentDiff && (
                  <div className="flex flex-col gap-4">
                    {/* 新增的 */}
                    {currentDiff.added.length > 0 && (
                      <div>
                        <h4 className="text-[#55FF55] font-bold mb-2 flex items-center border-b border-[#55FF55]/30 pb-1">
                          <FileUp size={16} className="mr-2" />
                          新增了 {currentDiff.added.length} 个模组
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {currentDiff.added.map(m => (
                            <div key={m.hash} className="bg-white/5 p-2 text-sm border-l-2 border-[#55FF55] truncate">
                              + {m.fileName}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 删除的 */}
                    {currentDiff.removed.length > 0 && (
                      <div>
                        <h4 className="text-[#FF5555] font-bold mb-2 flex items-center border-b border-[#FF5555]/30 pb-1">
                          <Trash2 size={16} className="mr-2" />
                          移除了 {currentDiff.removed.length} 个模组
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {currentDiff.removed.map(m => (
                            <div key={m.hash} className="bg-white/5 p-2 text-sm border-l-2 border-[#FF5555] opacity-70 truncate line-through">
                              - {m.fileName}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 更新的 */}
                    {currentDiff.updated.length > 0 && (
                      <div>
                        <h4 className="text-[#FFFF55] font-bold mb-2 flex items-center border-b border-[#FFFF55]/30 pb-1">
                          <RefreshCw size={16} className="mr-2" />
                          更新了 {currentDiff.updated.length} 个模组
                        </h4>
                        <div className="flex flex-col gap-2">
                          {currentDiff.updated.map((pair, idx) => (
                            <div key={idx} className="bg-white/5 p-2 text-sm border-l-2 border-[#FFFF55] flex flex-col">
                              <span className="text-white/60 line-through">~ {pair.old.fileName}</span>
                              <span>~ {pair.new.fileName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentDiff.added.length === 0 && currentDiff.removed.length === 0 && currentDiff.updated.length === 0 && (
                      <div className="text-center text-white/40 mt-8 p-4 border border-dashed border-white/20">
                        此版本相对于上一个版本没有文件层面的变更。
                      </div>
                    )}
                  </div>
                )}

                {/* 如果是最初始版本，只列出文件 */}
                {!previousSnapshot && selectedSnapshot.mods.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedSnapshot.mods.map(m => (
                      <div key={m.hash} className="bg-white/5 p-2 text-sm border-l-2 border-white/20 truncate">
                        {m.fileName}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-white/30 text-lg">
              请在右侧选择一个快照版本
            </div>
          )}
        </div>
      </div>
    </OreModal>
  );
};
