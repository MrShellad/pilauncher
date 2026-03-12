import React from 'react';
import { BadgeDollarSign, Headphones, Server, ShieldCheck } from 'lucide-react';

interface MultiplayerOverviewProps {
  onSwitchToOnlineServers: () => void;
}

export const MultiplayerOverview: React.FC<MultiplayerOverviewProps> = ({
  onSwitchToOnlineServers
}) => {
  return (
    <div className="grid flex-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
        <h2 className="text-xl font-semibold text-white">多人联机概览</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          这个分区用于承接在线服务器以外的多人功能，例如局域网联机、手动直连、白名单申请说明和语音协作入口。
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 inline-flex rounded-2xl bg-cyan-400/12 p-3 text-cyan-100">
              <Server size={20} />
            </div>
            <h3 className="text-lg font-semibold text-white">在线服务器大厅</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              从远端 API 拉取经过审核的服务器列表，统一渲染图标、在线人数、Ping、付费能力和社交入口。
            </p>
            <button
              type="button"
              onClick={onSwitchToOnlineServers}
              className="mt-4 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-300/15"
            >
              返回在线服务器
            </button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 inline-flex rounded-2xl bg-emerald-400/12 p-3 text-emerald-100">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-lg font-semibold text-white">白名单 / 审核</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              适合展示服务器是否需要申请、申请链接、审核周期和加入规则，减少玩家误入或重复咨询。
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 inline-flex rounded-2xl bg-violet-400/12 p-3 text-violet-100">
              <Headphones size={20} />
            </div>
            <h3 className="text-lg font-semibold text-white">语音协作</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              可以对接 Discord、QQ 语音或站内语音说明。当前在线服务器卡片已经保留“带语音”能力字段。
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 inline-flex rounded-2xl bg-amber-400/12 p-3 text-amber-100">
              <BadgeDollarSign size={20} />
            </div>
            <h3 className="text-lg font-semibold text-white">付费能力披露</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              可明确标注是否含会员、通行证、礼包或加速服务，避免玩家进入后才发现存在消费门槛。
            </p>
          </div>
        </div>
      </section>

      <aside className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
        <h2 className="text-xl font-semibold text-white">接入建议</h2>
        <div className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="font-medium text-white">接口字段建议</div>
            <p className="mt-2">
              建议后端至少返回 `name`、`icon`、`onlinePlayers`、`ping`、`serverType`、
              `isModded`、`requiresWhitelist`、`isSponsored`、`sponsoredUntil`、
              `hasPaidFeatures`、`hasVoiceChat`、`homepageUrl`、`socials`。
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="font-medium text-white">社交字段格式</div>
            <p className="mt-2">
              <code>socials</code> 支持数组或对象。数组示例可传
              <code>{'{ label, value, url }'}</code>，对象示例可传
              <code>{'qq: "123456"'}</code>、<code>{'discord: "https://discord.gg/xxx"'}</code>。
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="font-medium text-white">环境变量</div>
            <p className="mt-2">
              在运行环境中设置 `VITE_ONLINE_SERVERS_API_URL`，页面会在挂载时自动请求并可手动刷新。
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
};
