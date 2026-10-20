import React from 'react';

export const EulaZh: React.FC<{ currentDate: string }> = ({ currentDate }) => {
  return (
    <>
      <h1 className="text-lg text-white border-b border-[#2a2f3a] pb-2 mb-2 font-bold">PiLauncher 用户许可协议与隐私政策</h1>
      <p className="mb-4">最后更新日期：{currentDate}</p>

      <div className="bg-[#2a2115] p-3 rounded-md border border-[#d89b38] mb-5 text-white">
        <p className="font-bold text-[#f4c76b]">重要提示：PiLauncher 仅面向年满 18 周岁且具备完全民事行为能力的用户。</p>
        <p className="mt-1">
          点击“我已年满 18 周岁并同意”即表示您已阅读本协议，并郑重声明您的实际年龄已满 18 周岁、具备签署和履行本协议的法定资格。未满 18 周岁或不具备完全民事行为能力者，请勿点击同意、安装或继续使用本软件。
        </p>
      </div>

      <div className="mt-8">
        <h2 className="text-base text-white border-l-4 border-[#4da3ff] pl-2 mb-3 font-bold">第一部分：用户许可协议（License Agreement）</h2>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">1. 软件性质声明</h3>
        <p className="my-1">PiLauncher 是一个第三方启动工具，用于管理和启动 Minecraft 游戏。</p>
        <p className="my-1">本软件与 Microsoft、Mojang Studios 无任何隶属或官方关联关系。</p>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">2. 用户资格与年龄声明</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>本软件及相关在线服务仅供年满 18 周岁且具备完全民事行为能力的自然人使用</li>
          <li>点击同意即构成您对年龄和民事行为能力的明确声明与保证</li>
          <li>如果该声明不真实，我们可拒绝或终止服务；虚假声明不使未成年人取得成年人身份，也不免除任何一方依法承担的责任</li>
          <li>监护人发现未成年人使用本软件或提交个人信息时，可通过本协议所列邮箱联系我们处理停止服务与数据请求</li>
        </ul>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">3. 合法使用前提</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>您必须拥有合法购买的 Minecraft 正版账号</li>
          <li>必须通过官方认证服务登录</li>
          <li>不得绕过验证、传播盗版、侵犯知识产权或利用本软件从事违法活动</li>
          <li>您应遵守 Microsoft、Mojang Studios、资源平台及所在地区适用的协议与法律法规</li>
        </ul>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">4. 账号与认证</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>登录通过官方系统完成</li>
          <li>本软件不会存储账号密码</li>
          <li>用户需自行确保账号安全</li>
        </ul>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">5. 资源、下载与版权</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>本软件仅提供资源管理、索引和下载技术，不授予任何游戏或第三方内容的权利</li>
          <li>资源可能来自官方接口、第三方平台或用户指定位置，权利归相应权利人所有</li>
          <li>禁止非法传播游戏资源</li>
          <li>因法律法规、权利人要求、接口政策或安全风险，我们可暂停、限制或移除下载、索引及相关功能</li>
        </ul>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">6. 第三方平台、服务器与交易</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>本软件可能展示或接入 Mod 平台、游戏服务器、认证服务、云存储或其他第三方服务，其内容、运营和交易由相应第三方负责</li>
          <li>展示、搜索结果或外部链接不代表 PiLauncher 对第三方作出推荐、担保、审核或共同运营</li>
          <li>请勿向来源不明的服务器或个人付款、提供账号凭据或参与诱导充值；发生第三方交易争议时，应优先联系实际收款方、平台及支付机构</li>
          <li>如发现欺诈、诱导未成年人消费、违法内容或侵权资源，请停止访问并向相关平台或主管机关举报，也可向我们反馈以便处理入口</li>
        </ul>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">7. PiLauncher 付费服务</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>云同步</li>
          <li>多设备管理</li>
          <li>高级功能</li>
        </ul>
        <p className="my-1 font-bold text-[#4da3ff]">所有由 PiLauncher 明示提供的付费仅针对软件功能，不涉及游戏本体或第三方服务器权益，且仅向符合本协议资格的成年人提供。</p>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">8. 服务变更与可用性</h3>
        <p className="my-1">
          为确保合规、安全或适配第三方接口，我们可能更新、暂停或终止部分功能，并在可行时通过软件内提示说明重大变更。第三方接口、资源和网络服务可能随时变化，本软件不保证其永久可用。
        </p>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">9. 责任限制</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>软件按“现状”提供</li>
          <li>不保证无错误或持续可用</li>
          <li>您应在执行安装、迁移、删除或同步前自行备份重要数据</li>
          <li>在法律允许的范围内，我们不对第三方服务、用户自行操作或不可抗力直接造成的损失承担责任</li>
          <li>本条不排除因故意或重大过失造成损害、人身损害，或其他依法不得限制或免除的责任</li>
        </ul>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">10. 暂停与终止</h3>
        <p className="my-1">如用户不符合年龄资格、作出虚假声明、违反本协议或存在安全与合规风险，我们有权限制或终止相关服务，并依法保留必要记录。</p>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">11. 协议更新与适用</h3>
        <p className="my-1">重大更新将通过软件内提示并要求重新同意。若您不同意更新内容，应停止使用。本协议适用中华人民共和国大陆地区法律；强制性法律另有规定的，从其规定。</p>
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
        <p className="my-1">
          本软件及相关在线服务不面向未满 18 周岁者，我们不会以明知方式收集未成年人个人信息。若我们发现或经监护人通知确认误收集了未成年人个人信息，将停止相关处理并在法律要求的保存范围之外及时删除或匿名化。监护人可通过下列邮箱提出查阅、更正、删除或停止处理请求。
        </p>

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
