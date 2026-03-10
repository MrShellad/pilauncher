import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Image as ImageIcon } from 'lucide-react';

import type { ModrinthProject, OreProjectDetail } from '../../../InstanceDetail/logic/modrinthApi';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreMotionTokens } from '../../../../style/tokens/motion';

interface ProjectGalleryProps {
  project: ModrinthProject;
  details: OreProjectDetail | null;
  isScrolled: boolean;
  showGallery: boolean;
  setShowGallery: (show: boolean) => void;
}

export const ProjectGallery: React.FC<ProjectGalleryProps> = ({
  project,
  details,
  isScrolled,
  showGallery,
  setShowGallery
}) => {
  const description = details?.description || project.description || '该资源暂无更多说明。';
  const galleryUrls = details?.gallery_urls ?? [];

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
              资源说明
            </div>
            <p className="line-clamp-2 text-[13px] leading-5 text-white/90">{description}</p>
          </div>

          {galleryUrls.length > 0 && (
            <div className="flex shrink-0 items-center justify-end">
              <OreButton
                size="sm"
                variant="secondary"
                className="!h-8 min-w-[132px] px-3 text-[11px]"
                onClick={() => setShowGallery(!showGallery)}
              >
                <ImageIcon size={14} className="mr-1.5" />
                {showGallery ? '收起预览' : `预览图 ${galleryUrls.length}`}
                <motion.span
                  initial={false}
                  animate={showGallery ? 'open' : 'closed'}
                  variants={OreMotionTokens.downloadDetailChevron}
                  className="ml-1.5 inline-flex"
                >
                  <ChevronDown size={14} />
                </motion.span>
              </OreButton>
            </div>
          )}
        </div>

        <AnimatePresence initial={false}>
          {galleryUrls.length > 0 && showGallery && !isScrolled && (
            <motion.div
              key="gallery-preview-strip"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={OreMotionTokens.downloadDetailPreview}
              className="overflow-hidden"
            >
              <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                {galleryUrls.map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`preview-${index}`}
                    className="h-20 w-auto shrink-0 border-[2px] border-[var(--ore-downloadDetail-divider)] object-cover lg:h-24"
                    style={{ boxShadow: 'var(--ore-downloadDetail-imageShadow)' }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
