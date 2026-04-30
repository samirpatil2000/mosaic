import { memo } from 'react';
import type { TabInfo } from '../lib/tabManager';
import { FaviconImage } from '../overview/FaviconImage';

interface CarouselCardProps {
  tab: TabInfo | null;
  thumbnailUrl: string | null;
}

export const CarouselCard = memo(({ tab, thumbnailUrl }: CarouselCardProps) => {
  if (!tab) return null;

  return (
    <div className="w-full h-full rounded-[14px] overflow-hidden bg-[#1e1e1e] will-change-transform backface-hidden">
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          className="w-full h-full object-contain bg-[#121212]"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
          <FaviconImage
            pageUrl={tab.url}
            originalSrc={tab.favIconUrl}
            className="opacity-30 grayscale"
            fallbackClassName="text-white/10"
            fallbackSize={48}
          />
        </div>
      )}
    </div>
  );
});
