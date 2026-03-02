import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { OreButton } from '../../../../ui/primitives/OreButton';
import type { ModrinthProject, OreProjectDetail } from '../../../InstanceDetail/logic/modrinthApi';

interface ProjectGalleryProps {
  project: ModrinthProject;
  details: OreProjectDetail | null;
  isScrolled: boolean;
  showGallery: boolean;
  setShowGallery: (show: boolean) => void;
}

export const ProjectGallery: React.FC<ProjectGalleryProps> = ({ project, details, isScrolled, showGallery, setShowGallery }) => {
  return (
    <div 
      className={`px-5 lg:px-6 border-b border-white/5 bg-[#141415] flex-shrink-0 transition-all duration-500 ease-in-out overflow-hidden
        ${isScrolled ? 'max-h-0 opacity-0 py-0 border-transparent' : 'max-h-[800px] opacity-100 py-3'}
      `}
    >
      <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed">{details?.description || project.description}</p>
      
      {details?.gallery_urls && details.gallery_urls.length > 0 && (
        <div className="mt-3">
          {!showGallery ? (
            <OreButton size="sm" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setShowGallery(true)}>
              <ImageIcon size={14} className="mr-2" /> 展开游戏内展示图 ({details.gallery_urls.length} 张)
            </OreButton>
          ) : (
            <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
              {details.gallery_urls.map((url: string, idx: number) => (
                <img key={idx} src={url} className="h-24 lg:h-32 rounded-sm border border-white/10 object-cover shadow-lg" alt="Gallery preview" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};