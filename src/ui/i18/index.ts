// /src/ui/i18/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// 引入你刚才创建的 JSON 翻译文件
import zhCN from './zh-CN.json';
import enUS from './en-US.json';

// 组装资源对象
const resources = {
  'zh-CN': {
    translation: zhCN, // translation 是默认的命名空间
  },
  'en-US': {
    translation: enUS,
  },
};

i18n
  .use(initReactI18next) // 绑定 react-i18next
  .init({
    resources,
    lng: 'zh-CN', // 默认语言：中文
    fallbackLng: 'en-US', // 兜底语言：如果中文里找不到某个 Key，就去英文里找
    
    interpolation: {
      escapeValue: false, // React 已经自带防 XSS 注入，这里关掉即可
    },
  });

export default i18n;