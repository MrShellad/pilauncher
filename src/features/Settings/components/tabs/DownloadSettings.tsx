// src/features/Settings/components/tabs/DownloadSettings.tsx
import React from 'react';
import { Globe, Zap, ShieldCheck, Network } from 'lucide-react';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreSlider } from '../../../../ui/primitives/OreSlider';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreToggleButton } from '../../../../ui/primitives/OreToggleButton';

import { useSettingsStore } from '../../../../store/useSettingsStore';
import { DEFAULT_SETTINGS } from '../../../../types/settings';

export const DownloadSettings: React.FC = () => {
  const { settings, updateDownloadSetting } = useSettingsStore();
  // 防御性读取：兼容旧版本 JSON 缺少 download 节点的情况
  const download = settings.download || DEFAULT_SETTINGS.download;

  const selectBaseStyle = "bg-[#141415] border-2 border-ore-gray-border text-white font-minecraft p-2 text-sm focus:outline-none focus:border-ore-green transition-colors min-w-[200px] cursor-pointer";

  return (
    <SettingsPageLayout title="下载与网络" subtitle="Download & Network Configurations">
      
      {/* ==================== 1. 下载源与节点 ==================== */}
      <SettingsSection title="下载源与节点" icon={<Globe size={18} />}>
        
        <FormRow 
          label="Minecraft 核心下载源" 
          description="选择游戏核心、库文件及资源的下载通道。国内用户强烈建议使用镜像源。"
          control={
            <select 
              value={download.source} 
              onChange={(e) => updateDownloadSetting('source', e.target.value as any)} 
              className={selectBaseStyle}
            >
              <option value="official">官方源 (Official)</option>
              <option value="bmclapi">BMCLAPI (国内极速镜像)</option>
              <option value="mcbbs">MCBBS (备用镜像)</option>
            </select>
          }
        />

        <FormRow 
          label="动态测速与自动切换" 
          description="下载前自动对可用节点进行 PING 测试，并优先分配到延迟最低的节点服务器。"
          control={
            <OreSwitch 
              checked={download.autoCheckLatency} 
              onChange={(v) => updateDownloadSetting('autoCheckLatency', v)} 
            />
          }
        />

      </SettingsSection>

      {/* ==================== 2. 速度与并发 ==================== */}
      <SettingsSection title="速度与并发" icon={<Zap size={18} />}>
        
        <FormRow 
          label="速度显示单位" 
          description="MB/s (兆字节，常规显示方式) 或 Mbps (兆比特，宽带运营商标注方式)。"
          vertical={true}
          control={
            <div className="w-full max-w-sm mt-2">
              <OreToggleButton 
                options={[
                  { label: <span className="font-minecraft tracking-wider">MB/s</span>, value: 'MB/s' },
                  { label: <span className="font-minecraft tracking-wider">Mbps</span>, value: 'Mbps' }
                ]}
                value={download.speedUnit}
                onChange={(v) => updateDownloadSetting('speedUnit', v as any)}
              />
            </div>
          }
        />

        <FormRow 
          label="全局下载限速" 
          description="限制启动器的最大下载速度，设置为 0 则表示不限速。"
          control={
            <div className="flex items-center space-x-2">
              <OreInput 
                type="number" 
                value={download.speedLimit} 
                onChange={(e) => updateDownloadSetting('speedLimit', Number(e.target.value))} 
                className="w-24 text-center font-bold text-ore-green" 
                min={0} 
              />
              <span className="text-ore-text-muted font-minecraft text-sm">MB/s</span>
            </div>
          }
        />

        <FormRow 
          label="最大并发任务数" 
          description="同时下载的文件数量。数值越大理论速度越快，但过高可能导致路由器卡顿或被服务器拒绝连接。"
          vertical={true}
          control={
            <div className="w-full flex flex-col">
              <div className="flex justify-end font-minecraft text-sm mb-2">
                <span className="text-ore-green font-bold">{download.concurrency} 线程</span>
              </div>
              <OreSlider 
                value={download.concurrency} 
                min={1} max={128} step={1} 
                onChange={(v) => updateDownloadSetting('concurrency', v)} 
              />
            </div>
          }
        />

      </SettingsSection>

      {/* ==================== 3. 容错与校验 ==================== */}
      <SettingsSection title="容错与校验" icon={<ShieldCheck size={18} />}>
        
        <FormRow 
          label="连接超时时间" 
          description="当超过此时间（秒）仍未收到服务器数据时，将自动断开并尝试重新连接。"
          control={
            <div className="flex items-center space-x-2">
              <OreInput 
                type="number" 
                value={download.timeout} 
                onChange={(e) => updateDownloadSetting('timeout', Number(e.target.value))} 
                className="w-20 text-center" 
                min={5} max={120}
              />
              <span className="text-ore-text-muted font-minecraft text-sm">秒</span>
            </div>
          }
        />

        <FormRow 
          label="单文件失败重试次数" 
          description="下载失败后自动重新尝试的次数。超过该次数将判定为彻底失败并中断任务。"
          vertical={true}
          control={
            <div className="w-full max-w-sm flex flex-col">
              <div className="flex justify-end font-minecraft text-sm mb-2">
                <span className="text-ore-green font-bold">{download.retryCount} 次</span>
              </div>
              <OreSlider 
                value={download.retryCount} 
                min={0} max={10} step={1} 
                onChange={(v) => updateDownloadSetting('retryCount', v)} 
              />
            </div>
          }
        />

        <FormRow 
          label="下载后强制校验 (Hash)" 
          description="下载完成后自动对文件进行 SHA-1 完整性校验，确保文件未损坏。开启后会略微增加 CPU 负担。"
          control={
            <OreSwitch 
              checked={download.verifyAfterDownload} 
              onChange={(v) => updateDownloadSetting('verifyAfterDownload', v)} 
            />
          }
        />

      </SettingsSection>

      {/* ==================== 4. 代理设置 ==================== */}
      <SettingsSection title="代理服务器" icon={<Network size={18} />}>
        
        <FormRow 
          label="代理模式" 
          description="配置启动器的全局网络代理（仅对下载与 API 请求生效，不影响游戏内的多人联机）。"
          control={
            <select 
              value={download.proxyType} 
              onChange={(e) => updateDownloadSetting('proxyType', e.target.value as any)} 
              className={selectBaseStyle}
            >
              <option value="none">直连 (不使用代理)</option>
              <option value="http">HTTP 代理</option>
              <option value="https">HTTPS 代理</option>
              <option value="socks5">SOCKS5 代理</option>
            </select>
          }
        />

        {/* 当非直连时，动态展开配置项，加上平滑的透明度过渡 */}
        <div className={`transition-all duration-300 overflow-hidden divide-y-2 divide-[#1E1E1F] ${download.proxyType === 'none' ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100 bg-[#141415]/30'}`}>
          <FormRow 
            label="主机地址 (Host)" 
            control={
              <OreInput 
                value={download.proxyHost} 
                onChange={(e) => updateDownloadSetting('proxyHost', e.target.value)} 
                placeholder="127.0.0.1"
                className="w-48"
              />
            }
          />
          <FormRow 
            label="端口 (Port)" 
            control={
              <OreInput 
                value={download.proxyPort} 
                onChange={(e) => updateDownloadSetting('proxyPort', e.target.value)} 
                placeholder="7890"
                className="w-24 text-center"
              />
            }
          />
        </div>

      </SettingsSection>

    </SettingsPageLayout>
  );
};