// @ts-nocheck
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import { FixedSizeGrid as Grid } from 'react-window';
import Fuse from 'fuse.js';
import { getAllTabs, switchToTab, closeTab as apiCloseTab } from '../lib/tabManager';
import type { TabInfo } from '../lib/tabManager';
import { useKeyboardNavigation, parseShortcut } from '../lib/keyboard';
import { TabCard } from './TabCard';
import { SearchBar } from './SearchBar';
import { prefetchThumbnails } from '../lib/thumbnailCache';

const MIN_CARD_WIDTH = 260;
const BASE_CARD_HEIGHT = 220;
const MAX_SEARCH_RESULTS = 300;
const MAX_VISIBLE_TABS = 18; // 3 rows × 6 columns max

/**
 * Compute a sliding window of tabs centered on the selected index.
 * Returns { windowStart, windowTabs } where windowTabs is the visible slice.
 */
function computeWindow(
  allTabs: any[],
  selectedIndex: number,
  maxVisible: number,
): { windowStart: number; windowTabs: any[] } {
  const total = allTabs.length;
  if (total <= maxVisible) {
    return { windowStart: 0, windowTabs: allTabs };
  }

  // Center the window: 8 before + selected + 9 after
  const before = 8;
  let start = selectedIndex - before;

  // Clamp to bounds
  start = Math.max(0, start);
  start = Math.min(start, total - maxVisible);

  return {
    windowStart: start,
    windowTabs: allTabs.slice(start, start + maxVisible),
  };
}

function computeGridLayout(
  itemCount: number,
  availableWidth: number,
  availableHeight: number,
) {
  if (itemCount <= 0) return { columns: 1, rows: 0, columnWidth: availableWidth, rowHeight: BASE_CARD_HEIGHT };

  const aspectRatio = BASE_CARD_HEIGHT / MIN_CARD_WIDTH;

  let bestCols: number;
  let bestRows: number;

  if (itemCount === 1) {
    bestCols = 1;
    bestRows = 1;
  } else {
    const maxCols = Math.max(1, Math.floor(availableWidth / MIN_CARD_WIDTH));

    bestCols = -1;
    bestRows = 1;
    let bestScore = -Infinity;

    for (let cols = 1; cols <= maxCols; cols++) {
      const rows = Math.ceil(itemCount / cols);
      const widthFromCols = availableWidth / cols;
      const widthFromRows = availableHeight / (rows * aspectRatio);
      const cardWidth = Math.min(widthFromCols, widthFromRows);

      if (cardWidth < MIN_CARD_WIDTH) continue;

      const cardHeight = cardWidth * aspectRatio;
      // Score by area of *actual* cards, not the full grid rectangle.
      // This naturally penalizes ragged layouts where empty cells waste space.
      const usedArea = cardWidth * cardHeight * itemCount;
      const viewArea = availableWidth * availableHeight;
      const score = usedArea / viewArea;

      if (score > bestScore) {
        bestScore = score;
        bestCols = cols;
      }
    }

    if (bestCols === -1) {
      bestCols = Math.max(1, Math.floor(availableWidth / MIN_CARD_WIDTH));
    }

    bestRows = Math.ceil(itemCount / bestCols);
  }

  // Mathematically guaranteed fit:
  // Floor the cell dimensions so total never exceeds available space.
  const columnWidth = Math.floor(availableWidth / bestCols);
  const maxRowHeight = Math.floor(availableHeight / bestRows);
  const rowHeight = Math.min(Math.floor(columnWidth * aspectRatio), maxRowHeight);

  return { columns: bestCols, rows: bestRows, columnWidth, rowHeight };
}

const Cell = ({ columnIndex, rowIndex, style, data }: any) => {
  const { windowTabs, windowStart, columns, columnWidth, globalSelectedIndex, query, uiScale, handleClick, handleHover, handleCloseTab } = data;
  const localIndex = rowIndex * columns + columnIndex;
  if (localIndex >= windowTabs.length) return null;

  const tab = windowTabs[localIndex];
  const globalIndex = windowStart + localIndex;

  // Only the selected card gets an entrance animation — it's the only thing
  // moving on load, so the eye is drawn directly to it.
  const isSelectedCard = globalIndex === globalSelectedIndex;

  return (
    <TabCard
      tab={tab}
      isSelected={isSelectedCard}
      style={style}
      uiScale={uiScale}
      columnWidth={columnWidth}
      isEnterAnim={isSelectedCard && !query}
      enterDelay={0}
      onClick={() => handleClick(globalIndex)}
      onMouseEnter={() => handleHover(globalIndex)}
      onClose={(e) => {
        e.stopPropagation();
        handleCloseTab(globalIndex);
      }}
    />
  );
};

export function Overview() {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isExiting, setIsExiting] = useState(false);
  const [shortcutKeys, setShortcutKeys] = useState<string[]>(['\u2318', '\u21e7', '.']);
  const [rawShortcut, setRawShortcut] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<any>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);
  const [gridAreaHeight, setGridAreaHeight] = useState(0);

  useEffect(() => {
    let mounted = true;
    let fetchTimeout: ReturnType<typeof setTimeout> | null = null;

    // Debounced fetch — coalesces rapid tab events into a single update
    const scheduleFetch = () => {
      if (fetchTimeout) clearTimeout(fetchTimeout);
      fetchTimeout = setTimeout(fetchTabs, 150);
    };

    const fetchTabs = () => {
      getAllTabs().then(async (res) => {
        if (!mounted) return;

        // Prefetch thumbnails BEFORE setting tabs state.
        // This populates the memory cache so TabCards render with
        // thumbnails on their very first paint — no placeholder flash.
        await prefetchThumbnails(res.map(t => t.id));

        // Only update state if the tab list actually changed.
        setTabs(prev => {
          const isSame = prev.length === res.length &&
            prev.every((t, i) => t.id === res[i].id && t.title === res[i].title && t.url === res[i].url && t.active === res[i].active && t.index === res[i].index && t.windowId === res[i].windowId);
          return isSame ? prev : res;
        });

        if (!initialLoadDone.current && res.length > 0) {
          const params = new URLSearchParams(window.location.search);
          const fromTabId = params.get('from') ? Number(params.get('from')) : null;

          let targetIdx = fromTabId ? res.findIndex(t => t.id === fromTabId) : -1;
          if (targetIdx === -1) {
            targetIdx = res.findIndex(t => t.active);
          }
          if (targetIdx !== -1) {
            setSelectedIndex(targetIdx);
          }
          initialLoadDone.current = true;
        }
      });
    };

    // Initial fetch is immediate
    fetchTabs();

    // Only listen for structural changes, not every update
    chrome.tabs.onMoved.addListener(scheduleFetch);
    chrome.tabs.onDetached.addListener(scheduleFetch);
    chrome.tabs.onAttached.addListener(scheduleFetch);
    chrome.tabs.onCreated.addListener(scheduleFetch);
    chrome.tabs.onRemoved.addListener(scheduleFetch);

    // onUpdated fires very frequently — only refetch on meaningful changes
    const handleUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
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

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        chrome.tabs.getCurrent((tab) => {
          if (tab?.id) {
            chrome.tabs.remove(tab.id).catch(() => {
              // Retry after a short delay — Chrome may reject during tab transitions
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

  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setGridAreaHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (chrome?.commands?.getAll) {
      chrome.commands.getAll((commands) => {
        const action = commands.find(c => c.name === '_execute_action');
        if (action?.shortcut) {
          const keys = action.shortcut.split('+').map(part => {
            if (part === 'Command' || part === 'MacCtrl') return '\u2318';
            if (part === 'Shift') return '\u21e7';
            if (part === 'Alt') return '\u2325';
            if (part === 'Ctrl') return '\u2303';
            if (part === 'Period') return '.';
            if (part === 'Comma') return ',';
            return part.toUpperCase();
          });
          setShortcutKeys(keys);
          setRawShortcut(action.shortcut);
        } else {
          setShortcutKeys([]);
          setRawShortcut('');
        }
      });
    }
  }, []);

  const closeShortcut = useMemo(() => rawShortcut ? parseShortcut(rawShortcut) : null, [rawShortcut]);

  const fuse = useMemo(() => new Fuse(tabs, {
    keys: ['title', 'url'],
    threshold: 0.3,
    ignoreLocation: true
  }), [tabs]);

  const filteredTabs = useMemo(() => {
    if (!query) return tabs;
    return fuse.search(query, { limit: MAX_SEARCH_RESULTS }).map(res => res.item);
  }, [query, tabs, fuse]);

  // Sliding window: show up to MAX_VISIBLE_TABS centered on selectedIndex
  const { windowStart, windowTabs } = useMemo(
    () => computeWindow(filteredTabs, selectedIndex, MAX_VISIBLE_TABS),
    [filteredTabs, selectedIndex]
  );

  const hasTabsBefore = windowStart > 0;
  const hasTabsAfter = windowStart + windowTabs.length < filteredTabs.length;

  // Grid layout is computed on the visible window, not all tabs
  const paddingX = 24;
  const maxContentWidth = 1600;
  const availableWidth = Math.min(windowSize.width - (paddingX * 2), maxContentWidth);
  const availableHeight = gridAreaHeight || (windowSize.height - 160);

  const { columns, rows, columnWidth, rowHeight } = useMemo(
    () => computeGridLayout(windowTabs.length, availableWidth, availableHeight),
    [windowTabs.length, availableWidth, availableHeight]
  );

  const handleSelect = useCallback((index: number) => {
    const tab = filteredTabs[index];
    if (tab) {
      setIsExiting(true);
      setTimeout(() => {
        switchToTab(tab.id, tab.windowId).then(() => {
          window.close();
        });
      }, 120);
    }
  }, [filteredTabs]);

  // Mouse click opens the tab
  const handleClick = useCallback((index: number) => {
    handleSelect(index);
  }, [handleSelect]);

  // Mouse hover selects the card (unifies with keyboard selection)
  const handleHover = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const handleCloseTab = useCallback((index: number) => {
    const tab = filteredTabs[index];
    if (tab) {
      apiCloseTab(tab.id);
      // Let the tab event listener handle the state update
    }
  }, [filteredTabs]);

  const handleFocusSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  const handleCloseOverview = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => window.close(), 120);
  }, []);

  const handleNewTab = useCallback(() => {
    const currentTab = filteredTabs[selectedIndex];
    if (currentTab) {
      chrome.tabs.create({ active: false, windowId: currentTab.windowId, index: currentTab.index + 1 });
    } else {
      chrome.tabs.create({ active: false });
    }
  }, [filteredTabs, selectedIndex]);

  const handleOpenShortcutSettings = useCallback(async () => {
    const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    const target = windows.at(-1);
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts', windowId: target?.id });
    window.close();
  }, []);

  // Clamp selectedIndex when tabs are removed
  useEffect(() => {
    if (filteredTabs.length === 0) return;
    if (selectedIndex >= filteredTabs.length) {
      setSelectedIndex(filteredTabs.length - 1);
    }
  }, [filteredTabs.length, selectedIndex]);

  // Keyboard navigation operates on the FULL filteredTabs list
  useKeyboardNavigation({
    totalItems: filteredTabs.length,
    columns,
    selectedIndex,
    onIndexChange: (idx) => {
      setSelectedIndex(idx);
    },
    onSelect: handleSelect,
    onCloseTab: handleCloseTab,
    onFocusSearch: handleFocusSearch,
    onCloseOverview: handleCloseOverview,
    onNewTab: handleNewTab,
    closeShortcut
  });

  const handleQueryChange = (q: string) => {
    setQuery(q);
    setSelectedIndex(0);
  };

  const uiScale = useMemo(() => Math.sqrt(columnWidth / MIN_CARD_WIDTH), [columnWidth]);

  // Separate stable data from volatile selection index.
  // itemData changes trigger react-window to re-render all cells.
  // By keeping handlers and layout stable, only selectedIndex changes cause updates.
  const itemData = useMemo(() => ({
    windowTabs,
    windowStart,
    columns,
    columnWidth,
    globalSelectedIndex: selectedIndex,
    query,
    uiScale,
    handleClick,
    handleHover,
    handleCloseTab
  }), [windowTabs, windowStart, columns, columnWidth, selectedIndex, query, uiScale, handleClick, handleHover, handleCloseTab]);

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      window.close();
    }
  }, []);

  return (
    <motion.div
      animate={isExiting ? { opacity: 0, scale: 0.97, filter: 'blur(4px)' } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.12, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col h-screen w-full bg-[#1A1A1A] text-white overflow-hidden p-6 font-sans"
      onClick={handleBackgroundClick}
    >
      <SearchBar
        query={query}
        onQueryChange={handleQueryChange}
        inputRef={searchInputRef}
      />

      <div
        className="flex-1 w-full mx-auto max-w-[1600px] outline-none flex flex-col"
        onClick={handleBackgroundClick}
      >
        <div className="flex justify-between items-center mb-5 px-3">
          <div className="flex items-center gap-3">
            <div className="text-[12px] font-medium text-white/40 tracking-wider uppercase">
              {filteredTabs.length} Tabs
            </div>
            {filteredTabs.length > MAX_VISIBLE_TABS && (
              <div className="flex items-center gap-1 text-[11px] text-white/30">
                {hasTabsBefore && <ChevronUp size={14} className="text-white/40" />}
                <span>{windowStart + 1}–{windowStart + windowTabs.length} of {filteredTabs.length}</span>
                {hasTabsAfter && <ChevronDown size={14} className="text-white/40" />}
              </div>
            )}
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

        {windowTabs.length > 0 ? (
          <div ref={gridContainerRef} className={`flex-1 flex justify-center overflow-hidden ${rows > 1 ? 'items-center' : 'items-start'}`}>
            <Grid
              ref={gridRef}
              className="outline-none scrollbar-hide overflow-hidden!"
              columnCount={columns}
              columnWidth={columnWidth}
              rowCount={rows}
              rowHeight={rowHeight}
              width={availableWidth}
              height={availableHeight}
              innerElementType="div"
              itemData={itemData}
            >
              {Cell}
            </Grid>
          </div>
        ) : query && tabs.length > 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/40">
            <p>No tabs found for "{query}"</p>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
