import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import '../index.css';
import Fuse from 'fuse.js';
import { getAllTabs, switchToTab } from '../lib/tabManager';
import type { TabInfo } from '../lib/tabManager';
import { prefetchThumbnails } from '../lib/thumbnailCache';
import { useCarouselKeyboard } from './carouselKeyboard';
import { parseShortcut } from '../lib/keyboard';
import type { ParsedShortcut } from '../lib/keyboard';
import { CarouselStage } from './CarouselStage';
import { ContextStrip } from './ContextStrip';
import { SearchBar } from '../overview/SearchBar';

const MAX_SEARCH_RESULTS = 300;

export function Carousel() {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [closeShortcut, setCloseShortcut] = useState<ParsedShortcut | null>(null);
  const [shortcutKeys, setShortcutKeys] = useState<string[]>([]);

  const initialLoadDone = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Animation queue system (Task 9)
  const animationQueue = useRef<number[]>([]);
  const isAnimating = useRef(false);

  // --- Tab data fetching (Task 8.2) ---
  // Reuses the exact same debounced pattern from Overview.tsx
  useEffect(() => {
    let mounted = true;
    let fetchTimeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleFetch = () => {
      if (fetchTimeout) clearTimeout(fetchTimeout);
      fetchTimeout = setTimeout(fetchTabs, 150);
    };

    const fetchTabs = () => {
      getAllTabs().then(async (res) => {
        if (!mounted) return;

        // Prefetch thumbnails BEFORE setting tabs state
        await prefetchThumbnails(res.map(t => t.id));

        // Referential equality check — only update if changed
        setTabs(prev => {
          const isSame = prev.length === res.length &&
            prev.every((t, i) =>
              t.id === res[i].id &&
              t.title === res[i].title &&
              t.url === res[i].url &&
              t.active === res[i].active &&
              t.index === res[i].index &&
              t.windowId === res[i].windowId
            );
          return isSame ? prev : res;
        });

        // Initial selection from ?from= URL parameter (Task 8.3)
        if (!initialLoadDone.current && res.length > 0) {
          const params = new URLSearchParams(window.location.search);
          const fromTabId = params.get('from') ? Number(params.get('from')) : null;

          let targetIdx = fromTabId ? res.findIndex(t => t.id === fromTabId) : -1;
          if (targetIdx === -1) {
            targetIdx = res.findIndex(t => t.active);
          }
          if (targetIdx === -1) {
            targetIdx = 0;
          }
          setSelectedIndex(targetIdx);
          initialLoadDone.current = true;
        }
      });
    };

    // Initial fetch is immediate
    fetchTabs();

    // Structural change listeners
    chrome.tabs.onMoved.addListener(scheduleFetch);
    chrome.tabs.onDetached.addListener(scheduleFetch);
    chrome.tabs.onAttached.addListener(scheduleFetch);
    chrome.tabs.onCreated.addListener(scheduleFetch);
    chrome.tabs.onRemoved.addListener(scheduleFetch);

    // onUpdated — only refetch on meaningful changes
    const handleUpdated = (_tabId: number, changeInfo: { title?: string; url?: string; status?: string }) => {
      if (changeInfo.title || changeInfo.url || changeInfo.status === 'complete') {
        scheduleFetch();
      }
    };
    chrome.tabs.onUpdated.addListener(handleUpdated);

    return () => {
      mounted = false;
      if (fetchTimeout) clearTimeout(fetchTimeout);
      chrome.tabs.onMoved.removeListener(scheduleFetch);
      chrome.tabs.onDetached.removeListener(scheduleFetch);
      chrome.tabs.onAttached.removeListener(scheduleFetch);
      chrome.tabs.onCreated.removeListener(scheduleFetch);
      chrome.tabs.onRemoved.removeListener(scheduleFetch);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
    };
  }, []);

  // --- Auto-close on visibilitychange (Task 8.4) ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        chrome.tabs.getCurrent((tab) => {
          if (tab?.id) {
            chrome.tabs.remove(tab.id).catch(() => {
              setTimeout(() => {
                chrome.tabs.remove(tab.id!).catch(() => {});
              }, 100);
            });
          }
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // --- Fetch extension shortcut (Task 8.5) ---
  useEffect(() => {
    if (chrome?.commands?.getAll) {
      chrome.commands.getAll((commands) => {
        const carouselCmd = commands.find(c => c.name === 'open-carousel');
        if (carouselCmd?.shortcut) {
          setCloseShortcut(parseShortcut(carouselCmd.shortcut));
          const keys = carouselCmd.shortcut.split('+').map(part => {
            if (part === 'Command' || part === 'MacCtrl') return '\u2318';
            if (part === 'Shift') return '\u21e7';
            if (part === 'Alt') return '\u2325';
            if (part === 'Ctrl') return '\u2303';
            if (part === 'Period') return '.';
            if (part === 'Comma') return ',';
            return part.toUpperCase();
          });
          setShortcutKeys(keys);
        }
      });
    }
  }, []);

  // --- Fuzzy search (same as Overview) ---
  const fuse = useMemo(() => new Fuse(tabs, {
    keys: ['title', 'url'],
    threshold: 0.3,
    ignoreLocation: true
  }), [tabs]);

  const filteredTabs = useMemo(() => {
    if (!query) return tabs;
    return fuse.search(query, { limit: MAX_SEARCH_RESULTS }).map(res => res.item);
  }, [query, tabs, fuse]);

  // --- Animation queue: navigateTo (Task 9.2) ---
  const navigateTo = useCallback((newIndex: number) => {
    if (isAnimating.current) {
      animationQueue.current.push(newIndex);
      return;
    }
    isAnimating.current = true;
    setSelectedIndex(newIndex);
  }, []);

  // --- Animation queue: onAnimationComplete (Task 9.3) ---
  const onAnimationComplete = useCallback(() => {
    isAnimating.current = false;
    if (animationQueue.current.length > 0) {
      const next = animationQueue.current.shift()!;
      navigateTo(next);
    }
  }, [navigateTo]);

  // --- Navigation callbacks with wrapping (Task 9.4) ---
  const handleNext = useCallback(() => {
    const next = selectedIndex >= filteredTabs.length - 1 ? 0 : selectedIndex + 1;
    navigateTo(next);
  }, [filteredTabs.length, selectedIndex, navigateTo]);

  const handlePrev = useCallback(() => {
    const prev = selectedIndex <= 0 ? filteredTabs.length - 1 : selectedIndex - 1;
    navigateTo(prev);
  }, [filteredTabs.length, selectedIndex, navigateTo]);

  // --- Exit animation + tab selection (Task 8.7) ---
  const onSelect = useCallback(() => {
    const tab = filteredTabs[selectedIndex];
    if (tab) {
      setIsExiting(true);
      setTimeout(() => {
        switchToTab(tab.id, tab.windowId).then(() => {
          window.close();
        });
      }, 120);
    }
  }, [filteredTabs, selectedIndex]);

  const onClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => window.close(), 120);
  }, []);

  const handleQueryChange = useCallback((q: string) => {
    setQuery(q);
    setSelectedIndex(0);
  }, []);

  const handleOpenShortcutSettings = useCallback(async () => {
    const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    const target = windows.at(-1);
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts', windowId: target?.id });
    window.close();
  }, []);

  // --- ContextStrip onSelect goes through navigateTo (Task 9) ---
  const onStripSelect = useCallback((index: number) => {
    navigateTo(index);
  }, [navigateTo]);

  // --- Wire up useCarouselKeyboard (Task 8.5) ---
  const handleFocusSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  useCarouselKeyboard({
    totalItems: filteredTabs.length,
    selectedIndex,
    query,
    onNext: handleNext,
    onPrev: handlePrev,
    onSelect,
    onClose,
    onQueryChange: handleQueryChange,
    onFocusSearch: handleFocusSearch,
    closeShortcut,
  });

  // --- Handle external tab changes: clamp selectedIndex (Task 10.2) ---
  useEffect(() => {
    if (filteredTabs.length === 0) return;
    if (selectedIndex >= filteredTabs.length) {
      setSelectedIndex(filteredTabs.length - 1);
    }
  }, [filteredTabs, selectedIndex]);

  // --- Empty state when all tabs closed (Task 10.3) ---
  if (initialLoadDone.current && tabs.length === 0) {
    return (
      <motion.div
        animate={isExiting ? { opacity: 0, scale: 0.97, filter: 'blur(4px)' } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.12, ease: [0.4, 0, 0.2, 1] }}
        className="flex flex-col items-center justify-center h-screen w-full bg-[#1A1A1A] text-white overflow-hidden p-6 font-sans"
      >
        <p className="text-white/40 text-lg">No tabs open</p>
      </motion.div>
    );
  }

  // --- Compose layout (Task 8.6) ---
  return (
    <motion.div
      animate={isExiting ? { opacity: 0, scale: 0.97, filter: 'blur(4px)' } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.12, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col h-screen w-full bg-[#1A1A1A] text-white overflow-hidden p-6 font-sans"
    >
      {/* Search bar — same component as overview */}
      <SearchBar
        query={query}
        onQueryChange={handleQueryChange}
        inputRef={searchInputRef}
      />

      {/* Header row — same position as overview: tab count left, shortcut pill right */}
      <div className="w-full mx-auto max-w-[1600px]">
        <div className="flex justify-between items-center mb-5 px-3">
          <div className="text-[12px] font-medium text-white/40 tracking-wider uppercase">
            {filteredTabs.length} Tabs
          </div>
          <div
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-full bg-white/4 border border-white/10 backdrop-blur-xl shadow-2xl ring-1 ring-black/40 cursor-pointer hover:bg-white/8 transition-colors duration-200 group"
            onClick={handleOpenShortcutSettings}
            title="Click to configure shortcut"
          >
            <div className="flex items-center gap-1.5 pl-1">
              {shortcutKeys.length === 0 ? (
                <span className="text-[12px] text-[#4c9aff] font-medium animate-pulse">Set shortcut</span>
              ) : (
                shortcutKeys.map((key, i) => (
                  <kbd
                    key={i}
                    className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-[5px] border border-white/15 bg-linear-to-b from-white/10 to-white/5 text-white/90 text-[10px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md"
                  >
                    {key}
                  </kbd>
                ))
              )}
            </div>
            <div className="flex items-center justify-center text-white/30 group-hover:text-white/80 transition-colors duration-300 pr-1">
              <ExternalLink size={14} strokeWidth={2.5} />
            </div>
          </div>
        </div>
      </div>

      {/* CarouselStage takes flex-1, includes caption beneath the center card */}
      <CarouselStage
        tabs={filteredTabs}
        selectedIndex={selectedIndex}
        onAnimationComplete={onAnimationComplete}
      />

      {/* ContextStrip */}
      {filteredTabs.length > 0 && (
        <div className="pb-3">
          <ContextStrip
            tabs={filteredTabs}
            selectedIndex={selectedIndex}
            onSelect={onStripSelect}
          />
        </div>
      )}

      {/* No results */}
      {query && filteredTabs.length === 0 && tabs.length > 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/40">No tabs found for "{query}"</p>
        </div>
      )}
    </motion.div>
  );
}
