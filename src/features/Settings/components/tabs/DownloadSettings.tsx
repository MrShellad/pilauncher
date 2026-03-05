// src/features/Settings/components/tabs/DownloadSettings.tsx
import React, { useMemo } from 'react';
import { Globe, Zap, ShieldCheck, Network, AlertTriangle } from 'lucide-react';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreSlider } from '../../../../ui/primitives/OreSlider';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreToggleButton } from '../../../../ui/primitives/OreToggleButton';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';

import { useSettingsStore } from '../../../../store/useSettingsStore';
import { DEFAULT_SETTINGS } from '../../../../types/settings';

// 引入你刚刚修改好的 JSON
import downloadConfig from '../../../../assets/config/downloadsource.json';

export const DownloadSettings: React.FC = () => {
  const { settings, updateDownloadSetting } = useSettingsStore();
  const download = settings.download || DEFAULT_SETTINGS.download;

  // ✅ 映射配置：将 JSON 结构映射为对应的组件渲染项
  const SOURCE_CATEGORIES = useMemo(() => [
    { key: 'vanilla', label: '原版核心下载源', data: downloadConfig.sources.vanilla },
    { key: 'forge', label: 'Forge 下载源', data: downloadConfig.sources.forge },
    { key: 'fabric', label: 'Fabric 下载源', data: downloadConfig.sources.fabric },
    { key: 'neoforge', label: 'NeoForge 下载源', data: downloadConfig.sources.neoforge },
  ] as const, []);

  const proxyOptions = [
    { label: '直连 (不使用代理)', value: 'none' },
    { label: 'HTTP 代理', value: 'http' },
    { label: 'HTTPS 代理', value: 'https' },
    { label: 'SOCKS5 代理', value: 'socks5' },
  ];

  return (
    <SettingsPageLayout title="下载与网络" subtitle="Download & Network Configurations">
      
      {/* ==================== 1. 下载源配置 (循环渲染四个 Loader 通道) ==================== */}
      <SettingsSection title="组件下载源" icon={<Globe size={18} />}>
        {SOURCE_CATEGORIES.map(category => {
          // 动态计算对应的 state key (例如 vanillaSource, vanillaSourceUrl)
          const sourceKey = `${category.key}Source` as keyof typeof download;
          const urlKey = `${category.key}SourceUrl` as keyof typeof download;

          // 组装下拉选项
          const options = category.data.map(s => ({ label: s.name, value: s.id }));
          options.push({ label: '自定义源 (Custom)', value: 'custom' });

          const currentSourceValue = (download as any)[sourceKey] || 'official';
          const currentUrlValue = (download as any)[urlKey] || '';

          return (
            <React.Fragment key={category.key}>
              <FormRow 
                label={category.label} 
                control={
                  <OreDropdown 
                    options={options}
                    value={currentSourceValue}
                    onChange={(val) => {
                      if (val === 'custom') {
                        const confirmCustom = window.confirm(`⚠️ 警告：\n\n您正在修改 [${category.label}]。\n使用未知的自定义源可能导致下载到被篡改的游戏文件，面临账号被盗或系统感染木马的风险。\n\n您确定要知道自己在做什么吗？`);
                        if (!confirmCustom) return;
                        
                        updateDownloadSetting(sourceKey, val as any);
                        updateDownloadSetting(urlKey, '' as any); 
                      } else {
                        const targetSource = category.data.find(s => s.id === val);
                        if (targetSource) {
                          updateDownloadSetting(urlKey, targetSource.url as any);
                        }
                        updateDownloadSetting(sourceKey, val as any);
                      }
                    }}
                    className="w-56"
                  />
                }
              />

              {/* 当选中当前类别的“自定义源”时，展开警告与输入框 */}
              <div className={`transition-all duration-300 overflow-hidden ${currentSourceValue === 'custom' ? 'max-h-48 opacity-100 mb-2' : 'max-h-0 opacity-0'}`}>
                <div className="bg-red-500/10 border-l-4 border-red-500 p-3 mb-2 rounded-r-sm flex items-start">
                  <AlertTriangle size={16} className="text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-red-400 font-minecraft text-sm font-bold mb-1">危险操作提示</h4>
                    <p className="text-red-400/80 text-xs">您正在使用不受支持的自定义 API。请确保该地址使用 HTTPS 且来源绝对可靠。</p>
                  </div>
                </div>
                <FormRow 
                  label={`${category.key.toUpperCase()} API 地址`} 
                  control={
                    <OreInput 
                      value={currentUrlValue} 
                      onChange={(e) => updateDownloadSetting(urlKey, e.target.value as any)} 
                      placeholder={`https://your-${category.key}-mirror.com`}
                      className="w-64 font-mono text-xs"
                    />
                  }
                />
              </div>
            </React.Fragment>
          );
        })}

        {/* 测速设置放到底部 */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <FormRow 
            label="动态测速与自动切换" 
            description="下载前自动对可用节点进行 PING 测试，并优先分配到延迟最低的节点服务器。"
            control={<OreSwitch checked={download.autoCheckLatency} onChange={(v) => updateDownloadSetting('autoCheckLatency', v)} />}
          />
        </div>
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
                size="sm"
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
          control={<OreSwitch checked={download.verifyAfterDownload} onChange={(v) => updateDownloadSetting('verifyAfterDownload', v)} />}
        />
      </SettingsSection>

      {/* ==================== 4. 代理设置 ==================== */}
      <SettingsSection title="代理服务器" icon={<Network size={18} />}>
        <FormRow 
          label="代理模式" 
          description="配置启动器的全局网络代理（仅对下载与 API 请求生效，不影响游戏内的多人联机）。"
          control={
            <OreDropdown 
              options={proxyOptions}
              value={download.proxyType}
              onChange={(val) => updateDownloadSetting('proxyType', val as any)}
              className="w-48"
            />
          }
        />
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