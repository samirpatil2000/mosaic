import { memo, useEffect, useRef, useCallback } from 'react';
import type { TabInfo } from '../lib/tabManager';
import { getThumbnailSync } from '../lib/thumbnailCache';
import { FaviconImage } from '../overview/FaviconImage';

interface ContextStripProps {
  tabs: TabInfo[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const StripItem = memo(
  ({
    tab,
    isSelected,
    onClick,
    selectedRef,
  }: {
    tab: TabInfo;
    isSelected: boolean;
    onClick: () => void;
    selectedRef: React.RefObject<HTMLDivElement | null>;
  }) => {
    const thumbnailUrl = getThumbnailSync(tab.id);

    return (
      <div
        ref={isSelected ? selectedRef : undefined}
        onClick={onClick}
        className="shrink-0 flex flex-col items-center cursor-pointer w-[80px]"
      >
        {/* Favicon — container is always max size (24px), favicon scales within via transform */}
        <div className="w-[24px] h-[24px] flex items-center justify-center mb-1.5 overflow-hidden">
          <div
            className={`transition-[transform,opacity] duration-200 origin-center ${
              isSelected ? 'scale-100 opacity-100' : 'scale-75 opacity-40'
            }`}
          >
            <FaviconImage
              pageUrl={tab.url}
              originalSrc={tab.favIconUrl}
              className="object-contain"
              fallbackClassName="text-white/30"
              fallbackSize={18}
              maxDisplaySize={24}
            />
          </div>
        </div>

        {/* Thumbnail */}
        <div
          className={`w-[80px] aspect-video rounded-[6px] overflow-hidden transition-all duration-150 ${
            isSelected
              ? 'ring-1 ring-white/20'
              : 'hover:brightness-75'
          }`}
          style={{
            filter: isSelected ? 'brightness(1)' : 'brightness(0.5) grayscale(0.5)',
          }}
        >
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
                fallbackSize={16}
              />
            </div>
          )}
        </div>
      </div>
    );
  },
);

export const ContextStrip = memo(({ tabs, selectedIndex, onSelect }: ContextStripProps) => {
  const selectedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (index: number) => {
      onSelect(index);
    },
    [onSelect],
  );

  return (
    <div className="w-full max-w-[700px] mx-auto px-6">
      <div className="bg-white/4 border border-white/10 rounded-[14px] backdrop-blur-xl overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex gap-3 items-end p-2 w-fit">
          {tabs.map((tab, index) => (
            <StripItem
              key={tab.id}
              tab={tab}
              isSelected={index === selectedIndex}
              onClick={() => handleSelect(index)}
              selectedRef={selectedRef}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
