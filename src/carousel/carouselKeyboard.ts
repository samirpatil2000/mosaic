import { useEffect, useCallback } from 'react';
import type { ParsedShortcut } from '../lib/keyboard';
import { matchesShortcut } from '../lib/keyboard';

interface CarouselKeyboardProps {
  totalItems: number;
  selectedIndex: number;
  query: string;
  onNext: () => void;
  onPrev: () => void;
  onSelect: () => void;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onFocusSearch?: () => void;
  closeShortcut?: ParsedShortcut | null;
}

function isPrintableKey(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  return e.key.length === 1;
}

export function useCarouselKeyboard({
  totalItems,
  selectedIndex,
  query,
  onNext,
  onPrev,
  onSelect,
  onClose,
  onQueryChange,
  onFocusSearch,
  closeShortcut,
}: CarouselKeyboardProps) {

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const activeEl = document.activeElement;
    const inInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';

    // Extension close shortcut (e.g. Alt+W)
    if (closeShortcut && matchesShortcut(e, closeShortcut)) {
      e.preventDefault();
      onClose();
      return;
    }

    // Escape — clear query first, close on second press
    if (e.key === 'Escape') {
      e.preventDefault();
      if (inInput) {
        (activeEl as HTMLElement).blur();
        if (query) {
          onQueryChange('');
        }
      } else if (query) {
        onQueryChange('');
      } else {
        onClose();
      }
      return;
    }

    // Arrow keys always navigate the carousel, blurring input if needed
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (inInput) (activeEl as HTMLElement).blur();
      onNext();
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (inInput) (activeEl as HTMLElement).blur();
      onPrev();
      return;
    }

    // Enter → select current tab
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inInput) (activeEl as HTMLElement).blur();
      onSelect();
      return;
    }

    // If in input, let it handle all other keys naturally
    if (inInput) return;

    // Backspace outside input — focus the input
    if (e.key === 'Backspace') {
      onFocusSearch?.();
      return;
    }

    // Printable characters outside input — focus the input and let the key land there
    if (isPrintableKey(e)) {
      onFocusSearch?.();
      return;
    }
  }, [totalItems, selectedIndex, query, onNext, onPrev, onSelect, onClose, onQueryChange, onFocusSearch, closeShortcut]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
