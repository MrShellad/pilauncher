// src/features/runtime/components/JavaGuard.tsx
import React, { useEffect, useState } from 'react';
import { validateCachedJava, type JavaInstall } from '../logic/javaDetector';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreButton } from '../../../ui/primitives/OreButton';
import { AlertTriangle } from 'lucide-react';

export const JavaGuard: React.FC = () => {
  const [missingJavas, setMissingJavas] = useState<JavaInstall[]>([]);
  const [affectedInstances, setAffectedInstances] = useState<string[]>([]);

  useEffect(() => {
    const checkEnvironment = async () => {
      const { missing } = await validateCachedJava();
      if (missing.length > 0) {
        // TODO: 这里应从您的 Zustand Store 获取所有实例数据
        // 模拟：假设我们在本地数据里发现有实例用了丢失的 Java
        const mockAffected = ["生存整合包 1.20.1", "RLCraft 困难服"]; 
        
        if (mockAffected.length > 0) {
          setMissingJavas(missing);
          setAffectedInstances(mockAffected);
        }
      }
    };
    checkEnvironment();
  }, []);

  const handleFix = () => {
    // TODO: 调用 Store 遍历 affectedInstances，将它们的 useGlobalJava 设为 true，并清空 javaPath
    console.log("已将以下实例重置为全局 Java:", affectedInstances);
    setMissingJavas([]); // 关闭弹窗
  };

  return (
    <OreModal 
      isOpen={missingJavas.length > 0} 
      onClose={() => setMissingJavas([])} 
      title="环境异常检测"
      closeOnOverlayClick={false}
    >
      <div className="flex flex-col items-center text-center space-y-4 pt-2">
        <div className="p-3 bg-yellow-500/10 rounded-full">
          <AlertTriangle size={48} className="text-yellow-500" />
        </div>
        
        <h3 className="text-white font-minecraft text-lg">发现失效的 Java 运行环境</h3>
        
        <p className="text-sm font-minecraft text-ore-text-muted leading-relaxed max-w-sm">
          启动器检测到部分历史记录的 Java 路径已失效（可能由于系统重装或 JDK 卸载导致）。
        </p>

        <div className="w-full bg-[#141415] border-2 border-[#1E1E1F] p-4 text-left space-y-2 max-h-32 overflow-y-auto">
          <span className="text-xs text-ore-text-muted font-minecraft font-bold">受影响的独立实例：</span>
          <ul className="list-disc list-inside text-sm text-red-400 font-minecraft">
            {affectedInstances.map((name, i) => <li key={i}>{name}</li>)}
          </ul>
        </div>
      </div>

      <div className="mt-6 flex justify-end space-x-3 border-t-2 border-[#1E1E1F] pt-4">
        <OreButton variant="secondary" onClick={() => setMissingJavas([])}>忽略</OreButton>
        <OreButton variant="primary" onClick={handleFix}>一键修复并回退至全局</OreButton>
      </div>
    </OreModal>
  );
};