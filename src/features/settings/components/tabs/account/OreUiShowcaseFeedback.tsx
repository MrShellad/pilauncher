import React from 'react';
import { OreAccordion } from '../../../../../ui/primitives/OreAccordion';
import { OreBanner } from '../../../../../ui/primitives/OreBanner';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreCard } from '../../../../../ui/primitives/OreCard';
import { OreTag } from '../../../../../ui/primitives/OreTag';
import { OreTooltip } from '../../../../../ui/primitives/OreTooltip';

export const OreUiShowcaseFeedback: React.FC = () => (
  <div className="space-y-6">
    <section className="space-y-3">
      <div className="border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white">OreTag 状态徽标体系</h3>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 p-5 bg-black/30 border border-white/5">
        <OreTag variant="primary">Primary 正常</OreTag>
        <OreTag variant="success">Success 成功</OreTag>
        <OreTag variant="warning">Warning 警告</OreTag>
        <OreTag variant="error">Error 错误</OreTag>
        <OreTag variant="informative">Informative 提示</OreTag>
        <OreTag variant="neutral">Neutral 中性</OreTag>
        <OreTag variant="realms">Realms 领域</OreTag>
      </div>
    </section>

    <section className="space-y-3">
      <div className="border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white">OreBanner 通知信息条</h3>
      </div>
      <div className="space-y-3 p-5 bg-black/30 border border-white/5">
        <OreBanner variant="info">
          PiLauncher v0.9.8 已发布，包含全新的 OreUI 3D 像素拟态组件库！
        </OreBanner>
        <OreBanner variant="warning">
          检测到您正在使用 Java 8 运行 1.21 实例，建议切换至 Java 21。
        </OreBanner>
        <OreBanner variant="danger">
          OptiFine 与 Sodium 存在严重着色器管线冲突，无法同时载入。
        </OreBanner>
      </div>
    </section>

    <section className="space-y-3">
      <div className="border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white">OreCard 卡片与 OreAccordion 折叠面板</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-black/30 border border-white/5">
        <OreCard
          title="Minecraft 实例卡片"
          subtitle="Fabric 1.21.4 • 48 个模组"
          description="基于 OreUI 9-Slice 方块网格构建的高保真卡片容器。"
          className="p-4"
        />

        <div className="space-y-2">
          <OreAccordion title="折叠面板 1: 内存优化参数" defaultExpanded>
            <p className="text-xs text-ore-text-muted p-2">
              推荐 JVM 参数：-XX:+UseG1GC -XX:+ParallelRefProcEnabled
            </p>
          </OreAccordion>
          <OreAccordion title="折叠面板 2: 渲染优化配置">
            <p className="text-xs text-ore-text-muted p-2">
              开启 Sodium 块更新批处理与 GPU 实例化渲染管线。
            </p>
          </OreAccordion>
        </div>
      </div>
    </section>

    <section className="space-y-3">
      <div className="border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white">OreTooltip 悬浮提示</h3>
      </div>
      <div className="flex items-center gap-4 p-5 bg-black/30 border border-white/5">
        <OreTooltip content="这里是 OreUI 悬浮提示框">
          <OreButton size="sm" variant="secondary">
            将鼠标悬停在我身上
          </OreButton>
        </OreTooltip>
      </div>
    </section>
  </div>
);
