import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NewsCard } from './NewsCard';
import { NEWS_PAGE_COPY, getNewsLocale, normalizeMinecraftNewsItems } from '../data/newsItems';
import { useLauncherStore } from '../../../store/useLauncherStore';
import { useNewsStore } from '../../../store/useNewsStore';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreButton } from '../../../ui/primitives/OreButton';

export const StartupNewsModal: React.FC = () => {
  const { i18n } = useTranslation();
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const { startupItem, isStartupModalOpen, dismissStartupModal, markAllRead } = useNewsStore();

  const locale = getNewsLocale(i18n.language);
  const pageCopy = NEWS_PAGE_COPY[locale];
  const normalizedItem = useMemo(
    () => (startupItem ? normalizeMinecraftNewsItems([startupItem], locale)[0] : null),
    [locale, startupItem]
  );

  if (!normalizedItem) {
    return null;
  }

  return (
    <OreModal
      isOpen={isStartupModalOpen}
      onClose={dismissStartupModal}
      title={locale === 'zh' ? '发现新更新日志' : 'New Update Log'}
      defaultFocusKey="startup-news-open"
      className="w-full max-w-[860px]"
      contentClassName="p-5 overflow-y-auto custom-scrollbar"
      actions={
        <>
          <OreButton focusKey="startup-news-later" variant="secondary" size="auto" onClick={dismissStartupModal}>
            {locale === 'zh' ? '稍后查看' : 'Later'}
          </OreButton>
          <OreButton
            focusKey="startup-news-open"
            variant="primary"
            size="auto"
            className="!text-white"
            onClick={() => {
              markAllRead();
              setActiveTab('news');
            }}
          >
            {locale === 'zh' ? '查看新闻页' : 'Open News'}
          </OreButton>
        </>
      }
    >
      <div className="mb-4 font-minecraft text-sm leading-6 text-ore-text-muted">
        {locale === 'zh'
          ? '启动器检测到新的 Minecraft 更新日志。你可以先快速查看这张卡片，或直接进入新闻页。'
          : 'PiLauncher detected a newly published Minecraft update log. Review the card below or open the full news page.'}
      </div>

      <NewsCard
        date={normalizedItem.date}
        version={normalizedItem.version}
        tag={normalizedItem.tag}
        title={normalizedItem.title}
        summary={normalizedItem.summary}
        coverImageUrl={normalizedItem.coverImageUrl}
        officialUrl={normalizedItem.officialUrl}
        wikiUrl={normalizedItem.wikiUrl}
        officialLabel={pageCopy.official}
        wikiLabel={pageCopy.wiki}
        officialFocusKey="startup-news-official"
        wikiFocusKey="startup-news-wiki"
        displayIndex={0}
      />
    </OreModal>
  );
};
