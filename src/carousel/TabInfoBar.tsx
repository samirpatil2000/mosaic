import { memo } from 'react';
import type { TabInfo } from '../lib/tabManager';
import { FaviconImage } from '../overview/FaviconImage';

interface TabInfoBarProps {
  tab: TabInfo;
  currentIndex: number;
  totalCount: number;
}

export const TabInfoBar = memo(({ tab, currentIndex, totalCount }: TabInfoBarProps) => {
  const domain = tab.url
    ? (() => {
        try {
          return new URL(tab.url).hostname;
        } catch {
          return '';
        }
      })()
    : '';

  return (
    <div className="flex items-center justify-center gap-3 px-6 py-3 max-w-[700px] mx-auto w-full">
      <div className="shrink-0 flex items-center justify-center rounded-sm bg-white/5 w-[24px] h-[24px]">
        <FaviconImage
          pageUrl={tab.url}
          originalSrc={tab.favIconUrl}
          className="object-contain"
          fallbackClassName="text-white/50"
          fallbackSize={16}
        />
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-3">
        <h3 className="text-[18px] font-medium text-white truncate leading-tight">
          {tab.title || 'Untitled'}
        </h3>
        {domain && (
          <span className="text-[14px] text-white/40 truncate shrink-0">
            {domain}
          </span>
        )}
      </div>

      <span className="text-[12px] font-medium text-white/40 shrink-0">
        {currentIndex + 1} / {totalCount}
      </span>
    </div>
  );
});
