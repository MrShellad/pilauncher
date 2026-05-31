import React from 'react';
import { motion } from 'framer-motion';
import { Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ModrinthProject, OreProjectDetail } from '../../../InstanceDetail/logic/modrinthApi';
import { useInputAction } from '../../../../ui/focus/InputDriver';
import { ControlHint } from '../../../../ui/components/ControlHint';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreMotionTokens } from '../../../../style/tokens/motion';

interface ProjectGalleryProps {
  project: ModrinthProject;
  details: OreProjectDetail | null;
  isScrolled: boolean;
  onOpenDescriptionModal: () => void;
  controlsEnabled?: boolean;
}

export const ProjectGallery: React.FC<ProjectGalleryProps> = ({
  project,
  details,
  isScrolled,
  onOpenDescriptionModal,
  controlsEnabled = true
}) => {
  const { t } = useTranslation();
  const description = details?.description || project.description || t('download.empty.noDescription', {
    defaultValue: 'No description provided yet.'
  });
  const galleryUrls = details?.gallery_urls ?? project.gallery_urls ?? [];
  const hasGallery = galleryUrls.length > 0;

  useInputAction('ACTION_Y', () => {
    if (!controlsEnabled) return;
    onOpenDescriptionModal();
  });

  return (
    <motion.div
      initial={false}
      animate={isScrolled ? 'collapsed' : 'expanded'}
      variants={OreMotionTokens.downloadDetailSection}
      className="flex-shrink-0 overflow-hidden border-b-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-base)] px-4"
    >
      <div
        className="border-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-surface)] px-3.5 py-2.5"
        style={{ boxShadow: 'var(--ore-downloadDetail-sectionInset)' }}
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[var(--ore-downloadDetail-labelText)]">
              {t('download.meta.description', { defaultValue: 'Description' })}
            </div>
            <p className="line-clamp-2 text-[13px] leading-5 text-white/90">{description}</p>
          </div>

          <div className="flex shrink-0 items-center justify-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="hidden items-center gap-2 [.intent-controller_&]:flex">
                <ControlHint label="Y" variant="face" tone="yellow" />
                <span className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-[var(--ore-downloadDetail-hintText)]">
                  {t('download.actions.details', { defaultValue: 'Details & Screenshots' })}
                </span>
              </div>
              <div className="flex items-center gap-2 [.intent-controller_&]:hidden">
                <ControlHint label="Y" variant="keyboard" tone="neutral" />
                <span className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-[var(--ore-downloadDetail-hintText)]">
                  {t('download.actions.details', { defaultValue: 'Details & Screenshots' })}
                </span>
              </div>
              <OreButton
                size="sm"
                variant="secondary"
                className="!h-8 min-w-[132px] px-3 text-[11px]"
                onClick={onOpenDescriptionModal}
              >
                <ImageIcon size={14} className="mr-1.5" />
                {t('download.actions.details', { defaultValue: 'Details' })}
                {hasGallery && ` (${galleryUrls.length})`}
              </OreButton>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
