import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ExternalLink,
  Plus,
  RefreshCw,
  Sparkles,
  Layers,
  Bug,
  AlertCircle,
  Search,
  BookOpen,
} from 'lucide-react';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreToggleButton } from '../../../ui/primitives/OreToggleButton';
import { OreInput } from '../../../ui/primitives/OreInput';
import { OreOverlayScrollArea } from '../../../ui/primitives/OreOverlayScrollArea';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { useInputAction } from '../../../ui/focus/InputDriver';
import { openExternalLink } from '../../../utils/openExternalLink';
import { fetchWikiStructuredChangelog } from '../../../services/wikiChangelogService';
import type { StructuredChangelog } from '../../../services/wikiChangelogService';
import { FormattedChangelogBullet } from './ChangelogRichText';

interface VersionChangelogViewProps {
  version: string;
  title?: string;
  date?: string;
  tag?: string;
  wikiUrl?: string;
  coverImageUrl?: string;
  lang?: 'zh' | 'en';
  onBack: () => void;
  onCreateInstance?: () => void;
}

export const VersionChangelogView: React.FC<VersionChangelogViewProps> = ({
  version,
  title,
  date,
  tag,
  wikiUrl,
  coverImageUrl,
  lang = 'zh',
  onBack,
  onCreateInstance,
}) => {
  const [data, setData] = useState<StructuredChangelog | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeMainCat, setActiveMainCat] = useState<'additions' | 'changes' | 'fixes' | 'other'>('additions');
  const [activeSubCat, setActiveSubCat] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 手柄 B 键或 ESC 返回
  useInputAction('CANCEL', () => {
    onBack();
  });

  const loadData = async () => {
    if (!version) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchWikiStructuredChangelog(version, lang);
      if (result) {
        setData(result);
        if (result.availableMainCategories.length > 0) {
          setActiveMainCat(result.availableMainCategories[0].id);
        }
      } else {
        setError('未在 Minecraft Wiki 上找到该版本的详细更新条目，可直接访问 Wiki 原网页查看。');
      }
    } catch (err: any) {
      setError(err?.message || '拉取更新日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [version, lang]);

  // 计算当前主分类下的子分类列表
  const currentSubCategories = useMemo(() => {
    if (!data) return [];
    const entriesInCat = data.entries.filter((e) => e.mainCategory === activeMainCat);
    return Array.from(new Set(entriesInCat.map((e) => e.subCategory)));
  }, [data, activeMainCat]);

  // 切换主分类时重置子分类
  useEffect(() => {
    setActiveSubCat('all');
  }, [activeMainCat]);

  // 过滤后的条目列表
  const filteredEntries = useMemo(() => {
    if (!data) return [];
    return data.entries.filter((entry) => {
      if (entry.mainCategory !== activeMainCat) return false;
      if (activeSubCat !== 'all' && entry.subCategory !== activeSubCat) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = entry.name.toLowerCase().includes(query);
        const matchBullets = entry.bullets.some((b) => b.toLowerCase().includes(query));
        return matchName || matchBullets;
      }
      return true;
    });
  }, [data, activeMainCat, activeSubCat, searchQuery]);

  const displayVersionTitle = title || `${version} 版本更新日志`;
  const resolvedWikiUrl = data?.wikiUrl || wikiUrl;

  return (
    <FocusBoundary
      id="changelog-detail-view"
      defaultFocusKey="btn-changelog-back"
      trapFocus
      className="relative flex h-full w-full flex-1 overflow-hidden font-minecraft select-none bg-transparent"
    >
      {/* 沉浸式背景过渡层：平滑渐变过渡到对应版本封面背景 */}
      {coverImageUrl && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            {/* 封面原图，适度模糊与色彩增强，清晰可见同时富有沉浸感 */}
            <div
              className="absolute inset-0 bg-cover bg-center transition-all duration-700 transform-gpu"
              style={{
                backgroundImage: `url("${coverImageUrl}")`,
                filter: 'blur(16px) brightness(0.65) saturate(1.2)',
                transform: 'scale(1.1)',
              }}
            />
            {/* 顶部与底部平滑渐变暗色遮罩，确保文字与卡片 100% 极佳对比度 */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/65 to-[#121314]/90" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,transparent_20%,rgba(0,0,0,0.65)_90%)]" />
          </motion.div>
        </div>
      )}

      <OreOverlayScrollArea
        ref={scrollRef}
        className="relative z-10 h-full w-full flex-1"
        viewportClassName="px-5 py-6 sm:px-7 sm:py-8 lg:px-8 lg:py-8"
        contentSafePaddingRight={0}
      >
        <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-5">
            {/* ================= 1. 顶部 Header 栏 (标题、返回与全局操作) ================= */}
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {/* 左侧：返回按钮 + 标题与版本徽章 */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <OreButton
                    focusKey="btn-changelog-back"
                    variant="secondary"
                    size="md"
                    className="!h-10 gap-2 !px-4 !m-0 font-bold text-sm shrink-0"
                    onClick={onBack}
                    autoScroll={false}
                  >
                    <ArrowLeft size={16} />
                    <span>返回列表</span>
                    <span className="ml-1 rounded bg-black/20 px-1.5 py-0.5 text-[0.65rem] text-ore-text-muted">B</span>
                  </OreButton>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#222324] text-[#6CC349] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
                    <BookOpen className="h-5 w-5 text-[#6CC349]" />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <h1 className="truncate text-xl sm:text-2xl font-bold tracking-wide text-white ore-text-shadow leading-none">
                        {displayVersionTitle}
                      </h1>
                      {tag && (
                        <span className="shrink-0 border border-white/15 bg-[#3C8527] px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                          {tag}
                        </span>
                      )}
                    </div>
                    {date && (
                      <span className="text-xs text-ore-text-muted mt-1">发布日期：{date}</span>
                    )}
                  </div>
                </div>

                {/* 右侧：创建实例与打开网页 (全部统一中等尺寸 md / h-10) */}
                <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
                  {onCreateInstance && (
                    <OreButton
                      focusKey="btn-changelog-create"
                      variant="primary"
                      size="md"
                      className="!h-10 gap-2 !px-4 !text-white !m-0 font-bold text-xs sm:text-sm shadow-md"
                      onClick={onCreateInstance}
                      autoScroll={false}
                    >
                      <Plus size={15} />
                      <span>创建对应实例</span>
                    </OreButton>
                  )}

                  {resolvedWikiUrl && (
                    <OreButton
                      focusKey="btn-changelog-wiki"
                      variant="secondary"
                      size="md"
                      className="!h-10 gap-2 !px-4 !m-0 font-bold text-xs sm:text-sm"
                      onClick={() => void openExternalLink(resolvedWikiUrl)}
                      autoScroll={false}
                    >
                      <ExternalLink size={14} />
                      <span>在浏览器打开 Wiki</span>
                    </OreButton>
                  )}
                </div>
              </div>

              {/* 下层：Tog 主分类切换在左，搜索框在右，严格统一等高中等尺寸 (md / h-10 / 40px) */}
              {data && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
                  {/* 左侧：主分类 Tog */}
                  <div className="flex items-center">
                    <OreToggleButton
                      options={data.availableMainCategories.map((cat) => ({
                        value: cat.id,
                        label: (
                          <span className="flex items-center gap-1.5 px-1 font-minecraft text-xs sm:text-sm font-bold">
                            {cat.id === 'additions' && <Sparkles size={14} className="text-[#6CC349]" />}
                            {cat.id === 'changes' && <Layers size={14} className="text-[#E5C158]" />}
                            {cat.id === 'fixes' && <Bug size={14} className="text-[#FF6565]" />}
                            <span>{cat.label}</span>
                            <span className="text-[11px] opacity-75">({cat.count})</span>
                          </span>
                        ),
                      }))}
                      value={activeMainCat}
                      onChange={(val) => setActiveMainCat(val as any)}
                      size="md"
                      focusKeyPrefix="btn-changelog-cat"
                      className="w-auto"
                      buttonClassName="!px-4"
                    />
                  </div>

                  {/* 右侧：搜索框 (统一高度 40px) */}
                  <div className="w-full sm:w-72">
                    <OreInput
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索更新特性或改动..."
                      prefixNode={<Search size={14} className="text-white/50 ml-2.5" />}
                      height="40px"
                      className="text-xs sm:text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ================= 2. 子分类筛选 Chip 栏 (可按方块/生物/物品等快速过滤) ================= */}
            {data && currentSubCategories.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSubCat('all')}
                  className={`h-9 px-3.5 text-xs sm:text-sm font-bold border-[2px] transition-colors cursor-pointer ${
                    activeSubCat === 'all'
                      ? 'border-[#6CC349] bg-[#3C8527] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.2)]'
                      : 'border-[#1E1E1F] bg-[#222324] text-[#D0D1D4] hover:border-white/30 hover:text-white'
                  }`}
                >
                  全部 ({data.entries.filter((e) => e.mainCategory === activeMainCat).length})
                </button>

                {currentSubCategories.map((sub) => {
                  const count = data.entries.filter(
                    (e) => e.mainCategory === activeMainCat && e.subCategory === sub
                  ).length;
                  const isActive = activeSubCat === sub;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setActiveSubCat(sub)}
                      className={`h-9 px-3.5 text-xs sm:text-sm font-bold border-[2px] transition-colors cursor-pointer ${
                        isActive
                          ? 'border-[#6CC349] bg-[#3C8527] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.2)]'
                          : 'border-[#1E1E1F] bg-[#222324] text-[#D0D1D4] hover:border-white/30 hover:text-white'
                      }`}
                    >
                      {sub} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* ================= 3. 加载态骨架屏 ================= */}
            {loading && (
              <div className="flex flex-col gap-4 py-8">
                <div className="flex items-center gap-3 text-sm text-white/80 font-bold">
                  <RefreshCw size={18} className="animate-spin text-[#6CC349]" />
                  <span>正在从 Minecraft Wiki 结构化解析 {version} 更新日志...</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="border-[2px] border-[#1E1E1F] bg-[#222324] p-5 shadow-[4px_4px_0_rgba(0,0,0,0.2)] space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-white/10 rounded-none animate-pulse" />
                        <div className="h-6 w-1/3 bg-white/15 rounded-none animate-pulse" />
                      </div>
                      <div className="h-4 w-full bg-white/5 rounded-none animate-pulse" />
                      <div className="h-4 w-4/5 bg-white/5 rounded-none animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ================= 4. 异常错误提示 ================= */}
            {error && !loading && (
              <div className="flex flex-col gap-4 border-[3px] border-[#5d2c2c] bg-[#2d1a1a]/95 px-6 py-5 text-sm text-[#ffd2d2] shadow-[8px_8px_0_rgba(0,0,0,0.24)]">
                <div className="flex items-center gap-3 font-bold text-base">
                  <AlertCircle size={22} className="text-[#FF6565]" />
                  <span>{error}</span>
                </div>
                <div className="flex items-center gap-3">
                  <OreButton variant="primary" size="md" className="font-bold text-xs sm:text-sm" onClick={() => void loadData()}>
                    <RefreshCw size={14} />
                    <span>重新拉取</span>
                  </OreButton>
                  {resolvedWikiUrl && (
                    <OreButton
                      variant="secondary"
                      size="md"
                      className="font-bold text-xs sm:text-sm"
                      onClick={() => void openExternalLink(resolvedWikiUrl)}
                    >
                      <ExternalLink size={14} />
                      <span>在浏览器打开 Wiki 原网页</span>
                    </OreButton>
                  )}
                </div>
              </div>
            )}

            {/* ================= 5. 结构化卡片流展示区 (高可读性 + 双列响应式网格) ================= */}
            {!loading && !error && data && (
              <div className="flex flex-col gap-4">
                {filteredEntries.length === 0 ? (
                  <div className="flex min-h-[16rem] items-center justify-center border-[3px] border-[#1E1E1F] bg-[#222324] px-8 py-10 text-center shadow-[4px_4px_0_rgba(0,0,0,0.2)]">
                    <p className="text-base text-ore-text-muted">没有找到与 “{searchQuery}” 匹配的改动条目。</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
                    {filteredEntries.map((entry, index) => (
                      <motion.article
                        key={entry.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
                        className="flex flex-col border-[2px] border-[#1E1E1F] bg-[#27282A] shadow-[4px_4px_0_rgba(0,0,0,0.25)] hover:border-white/25 transition-all overflow-hidden"
                      >
                        {/* 卡片头部：图标 + 条目名 + 子分类 Tag */}
                        <div className="flex items-center justify-between gap-3 border-b-[2px] border-[#1E1E1F] bg-[#222324] px-4 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {entry.iconUrl ? (
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#1E1E1F] bg-[#161718] p-1 shadow-inner">
                                <img
                                  src={entry.iconUrl}
                                  alt={entry.name}
                                  className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
                                />
                              </div>
                            ) : (
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#1E1E1F] bg-[#161718] text-[#6CC349] font-bold text-xs shadow-inner">
                                ✦
                              </div>
                            )}
                            <h3 className="truncate text-base sm:text-lg font-bold text-white ore-text-shadow">
                              {entry.name}
                            </h3>
                          </div>

                          <span className="shrink-0 border border-white/10 bg-black/40 px-2.5 py-1 text-xs font-bold text-[#6CC349]">
                            {entry.subCategory}
                          </span>
                        </div>

                        {/* 卡片内容：高对比度清晰文字点列 + 代码块与 ID 格式化 */}
                        <div className="p-4 sm:p-5 space-y-2.5">
                          {entry.bullets.map((bullet, idx) => (
                            <FormattedChangelogBullet key={idx} bullet={bullet} />
                          ))}
                        </div>
                      </motion.article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </OreOverlayScrollArea>
    </FocusBoundary>
  );
};

export default VersionChangelogView;
