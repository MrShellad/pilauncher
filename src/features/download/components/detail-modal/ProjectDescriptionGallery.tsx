import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { FocusItem } from '../../../../ui/focus/FocusItem';

interface ProjectDescriptionGalleryProps {
  galleryUrls: string[];
  activeImageIndex: number;
  isCollapsed: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
}

export const ProjectDescriptionGallery: React.FC<ProjectDescriptionGalleryProps> = ({
  galleryUrls,
  activeImageIndex,
  isCollapsed,
  onPrevious,
  onNext,
  onSelect,
}) => (
  <motion.div
    initial={{ height: 'auto', opacity: 1 }}
    animate={{
      height: isCollapsed ? 0 : 'auto',
      opacity: isCollapsed ? 0 : 1,
      marginBottom: isCollapsed ? 0 : 4,
      borderWidth: isCollapsed ? 0 : 2,
      padding: isCollapsed ? 0 : 6,
    }}
    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    className="relative flex flex-col items-center border-[var(--ore-border-color)] bg-[var(--ore-downloadDetail-surface)] shrink-0 overflow-hidden"
    style={{
      boxShadow: isCollapsed
        ? 'none'
        : 'inset 0 2px 0 rgba(255, 255, 255, 0.1), inset 0 -3px 0 rgba(0, 0, 0, 0.35)',
    }}
  >
    <div className="relative w-full h-[min(20rem,28vh)] flex items-center justify-center overflow-hidden border-[2px] border-[var(--ore-border-color)] bg-[var(--ore-downloadDetail-base)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
      <img
        src={galleryUrls[activeImageIndex]}
        alt={`Screenshot ${activeImageIndex + 1}`}
        className="w-full h-full object-contain"
      />

      <div className="absolute inset-y-0 left-2 flex items-center">
        <FocusItem focusKey="desc-gallery-btn-prev" onEnter={onPrevious} focusable={!isCollapsed}>
          {({ ref, focused }) => (
            <button
              ref={ref as React.RefObject<HTMLButtonElement>}
              type="button"
              onClick={onPrevious}
              className={`p-2 bg-[var(--ore-modal-bg)]/90 border-[2px] text-white transition-all cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ${
                focused
                  ? 'border-white bg-[#48494A] scale-110 shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                  : 'border-[var(--ore-border-color)] hover:bg-[#48494A]'
              }`}
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </FocusItem>
      </div>

      <div className="absolute inset-y-0 right-2 flex items-center">
        <FocusItem focusKey="desc-gallery-btn-next" onEnter={onNext} focusable={!isCollapsed}>
          {({ ref, focused }) => (
            <button
              ref={ref as React.RefObject<HTMLButtonElement>}
              type="button"
              onClick={onNext}
              className={`p-2 bg-[var(--ore-modal-bg)]/90 border-[2px] text-white transition-all cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ${
                focused
                  ? 'border-white bg-[#48494A] scale-110 shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                  : 'border-[var(--ore-border-color)] hover:bg-[#48494A]'
              }`}
            >
              <ChevronRight size={18} />
            </button>
          )}
        </FocusItem>
      </div>
    </div>

    <div className="mt-2 flex gap-1.5 overflow-x-auto overflow-y-hidden w-full max-w-full py-1 custom-scrollbar justify-center">
      {galleryUrls.map((url, index) => (
        <FocusItem
          key={index}
          focusKey={`desc-gallery-thumb-${index}`}
          onEnter={() => onSelect(index)}
          focusable={!isCollapsed}
        >
          {({ ref, focused }) => (
            <button
              type="button"
              ref={ref as React.RefObject<HTMLButtonElement>}
              onClick={() => onSelect(index)}
              className={`h-[2.75rem] w-[4.5rem] shrink-0 border-[2px] p-0.5 cursor-pointer transition-all overflow-hidden bg-[var(--ore-downloadDetail-base)] ${
                focused || activeImageIndex === index
                  ? 'border-[#B9FF8A] shadow-[0_0_8px_rgba(185,255,138,0.6),inset_0_0_4px_rgba(185,255,138,0.3)] scale-[1.04] z-10'
                  : 'border-[var(--ore-border-color)] opacity-65 hover:opacity-100'
              }`}
            >
              <img src={url} alt={`Thumbnail ${index + 1}`} className="h-full w-full object-cover" />
            </button>
          )}
        </FocusItem>
      ))}
    </div>
  </motion.div>
);
