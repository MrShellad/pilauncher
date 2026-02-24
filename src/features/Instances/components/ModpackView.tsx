// /src/features/Instances/components/ModpackView.tsx
import React from 'react';
import { PackageOpen } from 'lucide-react';

export const ModpackView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full text-ore-text-muted animate-fade-in">
      <PackageOpen size={64} className="mb-4 opacity-50" />
      <h2 className="font-minecraft text-xl text-white mb-2">整合包市场 / 导入</h2>
      <p className="font-minecraft text-sm">此功能正在开发中，未来将支持从 CurseForge 或 Modrinth 直接下载...</p>
    </div>
  );
};