import React from 'react';

export const EulaZh: React.FC<{ currentDate: string }> = ({ currentDate }) => {
  return (
    <>
      <h1 className="text-lg text-white border-b border-[#2a2f3a] pb-2 mb-2 font-bold">PiLauncher 用户许可协议与隐私政策</h1>
      <p className="mb-4">最后更新日期：{currentDate}</p>

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

        <p className="mt-2 font-bold text-[#4da3ff]">（1）安装遥测数据</p>
        <p className="my-1">
          安装遥测默认开启，您可以在“设置 - 数据 - 隐私与遥测”中随时关闭。开启时，PiLauncher 最多每 3 天上传一次以下内容：
        </p>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>installationId：随机生成的客户端安装 ID</li>
          <li>platform：操作系统平台，例如 Windows、macOS 或 Linux</li>
          <li>memoryBytes：设备内存容量</li>
          <li>gpu：显卡名称</li>
          <li>appVersion：PiLauncher 版本</li>
          <li>firstInstalledAt：首次安装或首次生成安装 ID 的时间</li>
        </ul>
        <p className="my-1">
          安装遥测不会上传 Minecraft 账号、用户名、访问令牌、游戏存档、日志正文、启动器本地目录路径或任何可直接登录账号的凭据。
        </p>

        <p className="mt-2 font-bold text-[#4da3ff]">（2）用户主动上传的数据</p>
        <p className="my-1">
          当您主动使用远程日志、诊断分享等功能时，相关内容会按功能说明上传；这些主动上传行为不属于安装遥测。
        </p>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">2. 信息用途</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>安装遥测仅用于安装量分析</li>
          <li>安装遥测仅用于不同平台、内存与显卡环境下的兼容性测试</li>
          <li>不会用于广告画像、账号追踪或向第三方出售</li>
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
          <li>在数据设置中关闭安装遥测上传</li>
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
    </>
  );
};
