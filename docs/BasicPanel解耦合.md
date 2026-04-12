tabs/
 └── BasicPanel/
      ├── index.tsx                        # 页面入口（原 BasicPanel.tsx）
      ├── hooks/
      │    └── useVerifyInstance.ts        # 抽离复杂的文件校验逻辑与 Tauri 事件
      └── components/
           ├── BasicInfoSection.tsx        # 基础信息模块（名称、封面）
           ├── CustomLinksSection.tsx      # 自定义链接模块
           ├── ServerBindingSection.tsx    # 实例服务器模块
           ├── MaintenanceSection.tsx      # 实例维护模块（包含校验弹窗）
           └── DangerZoneSection.tsx       # 危险区域模块（包含删除弹窗）