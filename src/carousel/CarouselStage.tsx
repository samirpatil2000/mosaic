import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TabInfo } from '../lib/tabManager';
import { getThumbnailSync } from '../lib/thumbnailCache';
import { CarouselCard } from './CarouselCard';
import { TabInfoBar } from './TabInfoBar';

interface CarouselStageProps {
  tabs: TabInfo[];
  selectedIndex: number;
  onAnimationComplete: () => void;
}

const positionVariants = {
  left: {
    x: '-55%',
    z: -200,
    rotateY: 35,
    scale: 0.75,
    opacity: 0.6,
  },
  center: {
    x: '0%',
    z: 0,
    rotateY: 0,
    scale: 1,
    opacity: 1,
  },
  right: {
    x: '55%',
    z: -200,
    rotateY: -35,
    scale: 0.75,
    opacity: 0.6,
  },
  offLeft: {
    x: '-120%',
    z: -400,
    rotateY: 55,
    scale: 0.5,
    opacity: 0,
  },
  offRight: {
    x: '120%',
    z: -400,
    rotateY: -55,
    scale: 0.5,
    opacity: 0,
  },
};

const slideTransition = { type: 'tween' as const, duration: 0.2, ease: 'easeOut' as const };

/** Determine whether a card entering from offscreen should come from left or right */
function getInitialVariant(position: 'left' | 'center' | 'right'): 'offLeft' | 'offRight' {
  return position === 'right' ? 'offRight' : 'offLeft';
}

/** Determine where a card exits to */
function getExitVariant(position: 'left' | 'center' | 'right'): 'offLeft' | 'offRight' {
  return position === 'left' ? 'offLeft' : 'offRight';
}

const selectedStyle = {
  backgroundColor: '#282828',
  filter: 'brightness(1)',
  boxShadow: '0 0 0 1px rgba(255,255,255,0.18), 0 4px 8px rgba(0,0,0,0.5)',
};

const sideStyle = {
  backgroundColor: '#1e1e1e',
  filter: 'brightness(0.68)',
  boxShadow: '0 0 0 1px rgba(255,255,255,0), 0 2px 6px rgba(0,0,0,0.3)',
};

interface CardSlot {
  tab: TabInfo;
  position: 'left' | 'center' | 'right';
}

export const CarouselStage = memo(({ tabs, selectedIndex, onAnimationComplete }: CarouselStageProps) => {
  const slots: CardSlot[] = [];

  if (tabs.length === 0) return null;

  // Build visible card slots — wraps around for infinite carousel feel
  if (tabs.length > 1) {
    const prevIndex = selectedIndex === 0 ? tabs.length - 1 : selectedIndex - 1;
    slots.push({ tab: tabs[prevIndex], position: 'left' });
  }
  slots.push({ tab: tabs[selectedIndex], position: 'center' });
  if (tabs.length > 1) {
    const nextIndex = selectedIndex === tabs.length - 1 ? 0 : selectedIndex + 1;
    slots.push({ tab: tabs[nextIndex], position: 'right' });
  }

  const selectedTab = tabs[selectedIndex];

  return (
    <div className="relative w-full flex-1 flex items-center justify-center">
      {/* Card + caption as one centered unit */}
      <div className="flex flex-col items-center">
        {/* 3D card container — perspective on direct parent of transformed cards */}
        <div
          className="relative w-[60vw] max-w-[700px] aspect-video"
          style={{
            perspective: '1200px',
            perspectiveOrigin: '50% 50%',
            transformStyle: 'preserve-3d',
          }}
        >
          <AnimatePresence mode="popLayout">
            {slots.map(({ tab, position }) => {
              const isCenter = position === 'center';
              const treatment = isCenter ? selectedStyle : sideStyle;
              const thumbnailUrl = getThumbnailSync(tab.id);

              return (
                <motion.div
                  key={tab.id}
                  className="absolute inset-0 rounded-[14px] overflow-hidden"
                  style={{
                    ...treatment,
                    transformStyle: 'preserve-3d',
                  }}
                  initial={positionVariants[getInitialVariant(position)]}
                  animate={positionVariants[position]}
                  exit={positionVariants[getExitVariant(position)]}
                  transition={slideTransition}
                  onAnimationComplete={() => {
                    if (isCenter) {
                      onAnimationComplete();
                    }
                  }}
                >
                  <CarouselCard tab={tab} thumbnailUrl={thumbnailUrl} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Caption — directly beneath the card, same visual group */}
        {selectedTab && (
          <div className="mt-4">
            <TabInfoBar
              tab={selectedTab}
              currentIndex={selectedIndex}
              totalCount={tabs.length}
            />
          </div>
        )}
      </div>
    </div>
  );
});
