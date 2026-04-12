import React from 'react';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { FileText, CheckCircle2 } from 'lucide-react';
import { useSettingsStore } from '../../../../store/useSettingsStore';
import { CURRENT_EULA_DATE } from '../../../../hooks/useSetupWizard';

interface LegalAgreementStepProps {
  onAgree: () => void;
}

export const LegalAgreementStep: React.FC<LegalAgreementStepProps> = ({ onAgree }) => {
  const lastAgreedDate = useSettingsStore(state => state.settings.general.lastAgreedLegalDate);
  const isUpdate = lastAgreedDate !== '' && lastAgreedDate !== CURRENT_EULA_DATE;

  return (
    <div className="flex w-full flex-col items-center">
      <div className="mb-4 flex flex-col items-center">
        <div className="mb-2 rounded-full bg-[#3C8527]/20 p-3">
          <FileText className="text-[#3C8527]" size={28} />
        </div>
        <h2 className="text-xl font-bold text-white tracking-widest">用户许可协议</h2>
        <p className="mt-1 text-center text-[0.8rem] text-gray-400">
          为了继续使用 PiLauncher，您必须阅读并同意以下条款
        </p>
      </div>

      {isUpdate && (
        <div className="mb-3 w-full rounded border border-[#EAB308]/50 bg-[#EAB308]/10 p-2 text-center text-[0.75rem] text-[#EAB308]">
          由于用户协议或隐私政策发生了变更，请您重新阅读并同意后方可继续使用。
        </div>
      )}

      <div className="relative mb-6 block w-[480px] h-[300px] overflow-hidden rounded-[0.25rem] border-[0.1875rem] border-black bg-[#0f1115]">
        <div className="h-full w-full overflow-y-auto p-5 text-[#cfcfcf] custom-scrollbar text-xs leading-[1.7] select-text">
          <h1 className="text-lg text-white border-b border-[#2a2f3a] pb-2 mb-2 font-bold">PiLauncher 用户许可协议与隐私政策</h1>
          <p className="mb-4">最后更新日期：{CURRENT_EULA_DATE}</p>

          <div className="bg-[#1a1f2b] p-3 rounded-md border border-[#2a2f3a] mb-5 text-white">
            使用本软件即表示您已阅读并同意本协议的全部内容。
          </div>

          <div className="mt-8">
            <h2 className="text-base text-white border-l-4 border-[#4da3ff] pl-2 mb-3 font-bold">第一部分：用户许可协议（License Agreement）</h2>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">1. 软件性质声明</h3>
            <p className="my-1">PiLauncher 是一个第三方启动工具，用于管理和启动 Minecraft 游戏。</p>
            <p className="my-1">本软件与 Microsoft、Mojang Studios 无任何隶属或官方关联关系。</p>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">2. 使用前提</h3>
            <ul className="list-disc pl-5 my-1 space-y-1">
              <li>您必须拥有合法购买的 Minecraft 正版账号</li>
              <li>必须通过官方认证服务登录</li>
              <li>不得绕过验证或使用盗版</li>
            </ul>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">3. 账号与认证</h3>
            <ul className="list-disc pl-5 my-1 space-y-1">
              <li>登录通过官方系统完成</li>
              <li>本软件不会存储账号密码</li>
              <li>用户需自行确保账号安全</li>
            </ul>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">4. 资源与版权</h3>
            <ul className="list-disc pl-5 my-1 space-y-1">
              <li>所有资源来源于官方或用户本地</li>
              <li>本软件不分发版权内容</li>
              <li>禁止非法传播游戏资源</li>
            </ul>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">5. 第三方服务</h3>
            <p className="my-1">本软件可能接入 Mod 平台等第三方服务，其内容受各自协议约束。</p>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">6. 付费服务</h3>
            <ul className="list-disc pl-5 my-1 space-y-1">
              <li>云同步</li>
              <li>多设备管理</li>
              <li>高级功能</li>
            </ul>
            <p className="my-1 font-bold text-[#4da3ff]">所有付费仅针对软件功能，不涉及游戏本体。</p>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">7. 免责声明</h3>
            <ul className="list-disc pl-5 my-1 space-y-1">
              <li>软件按“现状”提供</li>
              <li>不保证无错误或持续可用</li>
              <li>不承担数据或账号损失责任</li>
            </ul>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">8. 终止</h3>
            <p className="my-1">如违反协议，本软件有权限制或终止服务。</p>
          </div>

          <div className="mt-8">
            <h2 className="text-base text-white border-l-4 border-[#4da3ff] pl-2 mb-3 font-bold">第二部分：隐私政策（Privacy Policy）</h2>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">1. 我们收集的信息</h3>

            <p className="mt-2 font-bold text-[#4da3ff]">（1）设备与系统信息</p>
            <ul className="list-disc pl-5 my-1 space-y-1">
              <li>设备型号</li>
              <li>操作系统类型及版本</li>
              <li>匿名设备标识</li>
            </ul>

            <p className="mt-2 font-bold text-[#4da3ff]">（2）使用行为数据</p>
            <ul className="list-disc pl-5 my-1 space-y-1">
              <li>功能使用情况</li>
              <li>启动记录</li>
              <li>游戏版本统计（Minecraft版本、Loader等）</li>
            </ul>

            <p className="mt-2 font-bold text-[#4da3ff]">（3）日志信息</p>
            <ul className="list-disc pl-5 my-1 space-y-1">
              <li>崩溃日志</li>
              <li>错误日志</li>
            </ul>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">2. 信息用途</h3>
            <ul className="list-disc pl-5 my-1 space-y-1">
              <li>优化性能与兼容性</li>
              <li>改进功能设计</li>
              <li>统计版本使用情况</li>
              <li>问题排查</li>
            </ul>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">3. 数据处理原则</h3>
            <ul className="list-disc pl-5 my-1 space-y-1">
              <li>不收集敏感信息</li>
              <li>不存储账号密码</li>
              <li>尽可能匿名化处理</li>
            </ul>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">4. 信息共享</h3>
            <ul className="list-disc pl-5 my-1 space-y-1">
              <li>法律要求时</li>
              <li>提供必要服务时</li>
              <li>用户授权情况下</li>
            </ul>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">5. 数据安全</h3>
            <ul className="list-disc pl-5 my-1 space-y-1">
              <li>加密传输</li>
              <li>合理安全措施保护数据</li>
            </ul>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">6. 用户权利</h3>
            <ul className="list-disc pl-5 my-1 space-y-1">
              <li>查看或删除数据</li>
              <li>关闭数据收集（如支持）</li>
              <li>撤回授权</li>
            </ul>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">7. 未成年人保护</h3>
            <p className="my-1">未成年人需在监护人同意下使用。</p>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">8. 政策更新</h3>
            <p className="my-1">本政策可能更新，更新后将在软件中提示。</p>

            <h3 className="text-sm text-white mt-4 mb-1 font-bold">9. 联系方式</h3>
            <p className="my-1">邮箱：admail1024@gmail.com</p>
          </div>

          <div className="mt-10 mb-2 border-t border-[#2a2f3a] pt-4 text-[0.7rem] text-[#888] text-center">
            PiLauncher © 2026 — 本软件仅作为工具提供，请支持正版游戏。
          </div>
        </div>
        {/* Scroll shadow indicator overlay to look more integrated */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#0f1115] to-transparent"></div>
      </div>

      <div className="flex w-full flex-col items-center space-y-3">
        <FocusItem focusKey="setup-btn-agree" onEnter={onAgree}>
          {({ ref, focused }) => (
            <OreButton
              ref={ref}
              variant="primary"
              size="lg"
              className={`w-full ${focused ? 'ring-[0.1875rem] ring-white ring-offset-2 ring-offset-[#18181B] border-black' : ''}`}
              onClick={onAgree}
            >
              <CheckCircle2 size={18} className="mr-2" />
              我已阅读并完全同意
            </OreButton>
          )}
        </FocusItem>
      </div>
    </div>
  );
};
