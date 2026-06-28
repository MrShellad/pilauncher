// /src/features/home/components/HeroLogo.tsx
import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { PhysicalPosition } from '@tauri-apps/api/dpi';
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

  const { settings, updateGeneralSetting } = useSettingsStore();
  const { accounts, activeAccountId } = useAccountStore();
  const currentAccount = accounts.find((a) => a.uuid === activeAccountId);
  const [isDonor, setIsDonor] = useState(() => {
    if (globalDonorsCache && currentAccount) {
      return globalDonorsCache.some((d: any) => d.mcUuid === currentAccount.uuid || d.mcName === currentAccount.name);
    }
    return false;
  });

  // 彩蛋相关状态与 Refs
  const [isBouncing, setIsBouncing] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [isMirrored, setIsMirrored] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [uiShake, setUiShake] = useState({ x: 0, y: 0 });

  const animFrameRef = useRef<number | null>(null);
  const clickCountRef = useRef<number>(0);
  const firstClickTimeRef = useRef<number>(0);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // 组件卸载时清理定时器和动画帧
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (returnTimeoutRef.current) clearTimeout(returnTimeoutRef.current);
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current);
    };
  }, []);

  const triggerUiShake = (dir: { x: number; y: number }) => {
    if (shakeIntervalRef.current) {
      clearInterval(shakeIntervalRef.current);
    }

    const shakeSteps = [
      { x: dir.x * 12, y: dir.y * 12 },
      { x: -dir.x * 8, y: -dir.y * 8 },
      { x: dir.x * 4, y: dir.y * 4 },
      { x: 0, y: 0 },
    ];

    let step = 0;
    shakeIntervalRef.current = setInterval(() => {
      if (step < shakeSteps.length) {
        setUiShake(shakeSteps[step]);
        step++;
      } else {
        if (shakeIntervalRef.current) {
          clearInterval(shakeIntervalRef.current);
          shakeIntervalRef.current = null;
        }
      }
    }, 30);
  };

  const shakeWindow = (dir: { x: number; y: number }) => {
    const appWindow = getCurrentWindow();
    Promise.all([appWindow.isMaximized(), appWindow.isFullscreen(), appWindow.outerPosition()])
      .then(([maximized, fullscreen, pos]) => {
        if (maximized || fullscreen) {
          // 全屏或最大化时，抖动 UI 组件本身
          triggerUiShake(dir);
          return;
        }
        const shakeOffset = 12; // 抖动 12 像素
        const dx = dir.x * shakeOffset;
        const dy = dir.y * shakeOffset;
        const newPos = new PhysicalPosition(pos.x + dx, pos.y + dy);
        void appWindow.setPosition(newPos).then(() => {
          setTimeout(() => {
            void appWindow.setPosition(pos).catch(() => {});
          }, 45); // 45 毫秒后还原位置
        }).catch(() => {});
      })
      .catch(() => {
        // 获取窗口状态失败时，回落到组件自身抖动
        triggerUiShake(dir);
      });
  };

  const startBounce = (clickDuration: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    setIsBouncing(true);
    setIsReturning(false);

    // 随机初始水平与垂直速度 (像素/秒)，大小在 600 到 1000 之间
    const speedX = 600 + Math.random() * 400;
    const speedY = 600 + Math.random() * 400;
    let curVx = (Math.random() > 0.5 ? 1 : -1) * speedX;
    let curVy = (Math.random() > 0.5 ? 1 : -1) * speedY;

    let curX = 0;
    let curY = 0;
    let lastTime = performance.now();
    const duration = 10000; // 撞击窗口边缘的彩蛋动画持续 10 秒
    const startTime = performance.now();

    // 辅助函数：根据当前时间戳算出一个干扰权值 (使每次碰撞后的角度和速度都略微不同，避免死循环轨道)
    const getPerturbation = () => {
      const timeFactor = performance.now();
      return Math.sin(timeFactor * 0.05) * 40 + Math.cos(timeFactor * 0.01) * 20;
    };

    // 限制单轴速度在 500 到 1100 像素/秒 之间，保持动感又不至于飞出屏幕外
    const clampSpeed = (speed: number) => {
      const sign = Math.sign(speed);
      const absVal = Math.abs(speed);
      const clamped = Math.max(500, Math.min(absVal, 1100));
      return sign * clamped;
    };

    const update = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      // 计算当前的加速度与减速比例系数 (0 到 1)
      const elapsed = time - startTime;
      const t = Math.min(elapsed / duration, 1);
      
      // 根据用户的点击总耗时算出一个速度加权系数 (点击越快，数值越大)
      // 正常 8 次点击耗时在 1.0 秒到 4.0 秒之间，映射为 1.6 倍到 0.6 倍的初速度权重
      const clickWeight = Math.max(0.6, Math.min(1.6, 1.6 - (clickDuration - 1.0) * (1.0 / 3.0)));

      let speedScale = 1.0;
      if (t < 0.15) {
        // 前 15% 时间 (0s - 1.5s)：初始高速度爆发并平滑衰减到巡航速度 (3.2 * clickWeight -> 1.0)
        const p = t / 0.15;
        const initialPeak = 1.0 + 2.2 * clickWeight;
        speedScale = 1.0 + (initialPeak - 1.0) * (1 - p) * (1 - p); // 二次方衰减
      } else if (t > 0.8) {
        // 后 20% 时间 (8s - 10s)：平滑减速到 0
        const p = (1 - t) / 0.2;
        speedScale = p * p; // 二次方减速
      }

      // 计算带加减速效果的当前帧速度
      const vx = curVx * speedScale;
      const vy = curVy * speedScale;

      curX += vx * dt;
      curY += vy * dt;

      // 实时获取当前视口大小
      const winW = window.innerWidth;
      const winH = window.innerHeight;

      // 计算当前元素在视口中的边界位置
      const currentLeft = rect.left + curX;
      const currentTop = rect.top + curY;
      const currentRight = currentLeft + rect.width;
      const currentBottom = currentTop + rect.height;

      // 碰撞检测、边缘反弹、扰动更新以及窗口抖动效果
      if (currentLeft <= 0) {
        curVx = Math.abs(curVx);
        curVy = clampSpeed(curVy + getPerturbation());
        curX = -rect.left;
        shakeWindow({ x: -1, y: 0 });
      } else if (currentRight >= winW) {
        curVx = -Math.abs(curVx);
        curVy = clampSpeed(curVy + getPerturbation());
        curX = winW - rect.left - rect.width;
        shakeWindow({ x: 1, y: 0 });
      }

      if (currentTop <= 0) {
        curVy = Math.abs(curVy);
        curVx = clampSpeed(curVx + getPerturbation());
        curY = -rect.top;
        shakeWindow({ x: 0, y: -1 });
      } else if (currentBottom >= winH) {
        curVy = -Math.abs(curVy);
        curVx = clampSpeed(curVx + getPerturbation());
        curY = winH - rect.top - rect.height;
        shakeWindow({ x: 0, y: 1 });
      }

      setOffset({ x: curX, y: curY });

      if (elapsed < duration) {
        animFrameRef.current = requestAnimationFrame(update);
      } else {
        // 弹球动画结束，平滑返回原位，并开始镜像翻转
        setIsReturning(true);
        setOffset({ x: 0, y: 0 });
        setIsMirrored((prev) => !prev);

        // 随机语言修改
        const LANGUAGES = ['zh-CN', 'zh-HK', 'zh-TW', 'en-US', 'ja', 'ko', 'ru'];
        const currentLang = settings.general.language || 'zh-CN';
        const candidateLangs = LANGUAGES.filter((lang) => lang !== currentLang);
        const randomLang = candidateLangs[Math.floor(Math.random() * candidateLangs.length)];
        updateGeneralSetting('language', randomLang);

        returnTimeoutRef.current = setTimeout(() => {
          setIsBouncing(false);
          setIsReturning(false);
        }, 1000); // 1.0s 与外层 transition 时间保持一致
      }
    };

    animFrameRef.current = requestAnimationFrame(update);
  };

  const handleClick = () => {
    if (isBouncing) return;

    if (clickCountRef.current === 0) {
      firstClickTimeRef.current = performance.now();
    }

    clickCountRef.current += 1;

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    if (clickCountRef.current >= 8) {
      const clickDuration = (performance.now() - firstClickTimeRef.current) / 1000; // 秒为单位
      clickCountRef.current = 0;
      startBounce(clickDuration);
    } else {
      // 1.5 秒内无后续点击则重置计数
      clickTimeoutRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 1500);
    }
  };

  // 最终展示的图片：优先使用实例自定义 logo，其次使用内置默认 logo
  const globalLogo = isDonor && settings.appearance.customLogo ? convertFileSrc(settings.appearance.customLogo) : defaultLogo;
  const displaySrc = customLogoSrc ?? globalLogo;

  // 当 instanceId 存在但尚未加载完毕时，渲染一个占位空元素避免闪烁
  const isLoading = instanceId && customLogoSrc === undefined;

  return (
    <div
      ref={containerRef}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        transition: isReturning ? 'transform 1s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
      }}
      className={isBouncing ? 'pointer-events-none' : ''}
    >
      <div
        style={{
          transform: `translate(${uiShake.x}px, ${uiShake.y}px)`,
        }}
      >
        <motion.div
          // 宽度：小窗占60vw -> 中窗占45vw -> 大窗/最大化占35vw。最小不低于600px，最大不超过1080px
          // 高度：阶梯式增长，配合 img 的 object-contain 让图片完美等比放大
          className="flex items-center justify-center select-none cursor-pointer w-[60vw] md:w-[45vw] lg:w-[35vw] min-w-[50rem] max-w-[100rem] h-20 md:h-28 lg:h-40 xl:h-48"
          whileHover={isBouncing ? undefined : OreMotionTokens.subtleHover}
          onClick={handleClick}
        >
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              transform: isMirrored ? 'scaleX(-1)' : 'scaleX(1)',
              transition: 'transform 0.5s ease-in-out',
            }}
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
          </div>
        </motion.div>
      </div>
    </div>
  );
};