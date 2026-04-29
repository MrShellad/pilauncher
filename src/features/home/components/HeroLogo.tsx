// /src/features/home/components/HeroLogo.tsx
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { useAccountStore } from '../../../store/useAccountStore';
import { OreMotionTokens } from '../../../style/tokens/motion';

// 启动器默认 logo（静态资源，构建时打包进 bundle）
const logoFiles = import.meta.glob('../../../assets/home/herologo/*.{png,jpg,jpeg,webp,svg,gif}', {
  eager: true,
  import: 'default'
});

const defaultLogoPaths = Object.values(logoFiles) as string[];
const defaultLogo = defaultLogoPaths.length > 0 ? defaultLogoPaths[0] : null;

interface HeroLogoProps {
  /** 当前选中实例的 ID，有效时会尝试读取实例内的自定义 hero_logo */
  instanceId?: string | null;
}

let globalDonorsCache: any[] | null = null;
let globalDonorsPromise: Promise<any[]> | null = null;

export const HeroLogo: React.FC<HeroLogoProps> = ({ instanceId }) => {
  // customLogoSrc: 来自实例 instance.json 的自定义 logo 绝对路径（经过 convertFileSrc 处理）
  // undefined = 尚未加载完毕，null = 确认无自定义 logo，string = 已解析的 src
  const [customLogoSrc, setCustomLogoSrc] = useState<string | null | undefined>(undefined);

  const { settings } = useSettingsStore();
  const { accounts, activeAccountId } = useAccountStore();
  const currentAccount = accounts.find((a) => a.uuid === activeAccountId);
  const [isDonor, setIsDonor] = useState(() => {
    if (globalDonorsCache && currentAccount) {
      return globalDonorsCache.some((d: any) => d.mcUuid === currentAccount.uuid || d.mcName === currentAccount.name);
    }
    return false;
  });

  useEffect(() => {
    if (globalDonorsCache) {
      setIsDonor(currentAccount ? globalDonorsCache.some((d: any) => d.mcUuid === currentAccount.uuid || d.mcName === currentAccount.name) : false);
      return;
    }

    if (!globalDonorsPromise) {
      globalDonorsPromise = invoke('fetch_donors').then((data) => {
        globalDonorsCache = Array.isArray(data) ? data : [];
        return globalDonorsCache;
      }).catch(() => {
        globalDonorsPromise = null;
        return [];
      });
    }

    globalDonorsPromise.then((data) => {
      if (currentAccount) {
        setIsDonor(data.some((d: any) => d.mcUuid === currentAccount.uuid || d.mcName === currentAccount.name));
      }
    });
  }, [currentAccount]);


  useEffect(() => {
    if (!instanceId) {
      // 没有选中实例时，直接清空自定义 logo，回落到默认
      setCustomLogoSrc(null);
      return;
    }

    let cancelled = false;

    invoke<string | null>('get_instance_herologo', { id: instanceId })
      .then((absPath) => {
        if (cancelled) return;
        if (absPath) {
          // 将本地绝对路径转换为 asset:// 协议供 <img> 使用
          setCustomLogoSrc(convertFileSrc(absPath));
        } else {
          setCustomLogoSrc(null);
        }
      })
      .catch(() => {
        if (!cancelled) setCustomLogoSrc(null);
      });

    return () => { cancelled = true; };
  }, [instanceId]);

  // 最终展示的图片：优先使用实例自定义 logo，其次使用内置默认 logo
  
  const globalLogo = isDonor && settings.appearance.customLogo ? convertFileSrc(settings.appearance.customLogo) : defaultLogo;
  const displaySrc = customLogoSrc ?? globalLogo;


  // 当 instanceId 存在但尚未加载完毕时，渲染一个占位空元素避免闪烁
  const isLoading = instanceId && customLogoSrc === undefined;

  return (
    <motion.div
      // 宽度：小窗占60vw -> 中窗占45vw -> 大窗/最大化占35vw。最小不低于600px，最大不超过1080px
      // 高度：阶梯式增长，配合 img 的 object-contain 让图片完美等比放大
      className="flex items-center justify-center select-none cursor-pointer w-[60vw] md:w-[45vw] lg:w-[35vw] min-w-[50rem] max-w-[100rem] h-20 md:h-28 lg:h-40 xl:h-48"
      whileHover={OreMotionTokens.subtleHover}
    >
      {isLoading ? null : displaySrc ? (
        <img
          src={displaySrc}
          alt="PiLauncher Logo"
          // object-contain 保持图片原比例缩放并居中
          className="w-full h-full object-contain drop-shadow-2xl"
        />
      ) : (
        // 没有任何图片资源时显示文字 Logo
        <h1 className="font-bold tracking-tighter text-white drop-shadow-xl ore-text-shadow text-4xl md:text-6xl lg:text-7xl xl:text-8xl">
          PiLauncher
        </h1>
      )}
    </motion.div>
  );
};