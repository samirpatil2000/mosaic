# Changelog

All notable changes to Mosaic are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - Unreleased

### Added

- **Tab-based overview**: opens as a regular browser tab instead of a popup window; auto-closes when you navigate away (Ctrl+T, tab switch, Alt+Tab)
- **Immediate keyboard search**: typing anywhere focuses the search input instantly — no Ctrl+F needed; arrow keys at text boundaries seamlessly transition between input and grid
- **New keyboard shortcuts**: Delete (close tab), Insert (new tab after current), Home/End (first/last tab), PageUp/PageDown (move left/right)
- **Content-driven adaptive grid**: layout determined by tab count — cards scale up to fill available space while maintaining aspect ratio; mathematically guaranteed to never overflow
- **Sliding window**: max 18 tabs visible at once (3×6); window slides to stay centered on the selected tab with a position indicator for large tab counts
- **Proportional UI scaling**: footer elements scale with card size via CSS `calc()` and a `--s` custom property; `sqrt()` easing prevents oversized text on large cards
- **Unified hover and keyboard selection**: mouse hover updates the same `selectedIndex` as keyboard navigation — one selection model, two input methods
- **Per-section desaturation**: unselected thumbnails at 15% grayscale, footer at 80% grayscale; selected card at full color and brightness
- **Focused entry animation**: only the selected card animates in on load — all others appear instantly, drawing the eye to the active tab
- **In-memory thumbnail cache**: `Map` layer above IndexedDB with batch prefetch via `getMany()` for zero-flash initial render
- **Synchronous thumbnail init**: `TabCard` reads from memory cache during `useState` initializer — no `useEffect` delay or placeholder flash

### Changed

- **Default shortcut**: Alt+Q (Windows/Linux), Ctrl+Q (Mac) — behavioral nudge from Alt+Tab muscle memory
- **Single click to open**: clicking a tab card opens it immediately instead of select-then-click
- **Selection visual treatment**: replaced blue ring with subtle white border, surface brightness lift, shadow only on selected card, and controlled scale overshoot (backOut easing)
- **Thumbnail capture**: stored at full native resolution (no downscaling); cache keyed by tab ID instead of URL
- **Favicon rendering**: displayed at native resolution to prevent upscale blur; removed `chrome://` URL filters from both capture and favicon APIs
- **Search input styling**: restyled to match shortcut pill — rounded-full, translucent background, no blue focus ring
- **Scale transforms**: restored with mathematical safety guarantees — max scale derived from cell padding, overshoot bounded so peak never exceeds cell boundary

### Fixed

- Wrong screenshots on tabs sharing the same URL (e.g. multiple new tab pages)
- Stale thumbnails showing during search reorder
- Cards overlapping neighbors due to unbounded scale transforms
- Grid overflow on wide screens (1900px+) and single-item layouts
- Text jitter during scale animations (GPU compositing fix)
- Brightness/filter flash on initial render (framer-motion initial state matching)
- "No tabs found" flash before initial tab load completes

### Performance

- Debounced tab event handling (150ms coalescing)
- Filtered `onUpdated` — only refetches on title, URL, or status:complete changes
- Referential equality on tab state — preserves array reference when nothing changed, preventing downstream recomputation (Fuse index, filteredTabs, grid layout)
- Batch IDB reads via `getMany()` — one transaction instead of N
- Memoized `uiScale` keyed on `columnWidth`

### Removed

- `yarn.lock` — consolidated on npm to simplify the dev workflow; using `--legacy-peer-deps` for react-window React 19 compatibility
- Ctrl+W shortcut (browser-reserved, was closing the extension tab)
- Thumbnail downscaling (was causing blurry images at larger card sizes)

## [1.1.1] - 2025

### Changed

- Revised shortcuts and customization details in README

### Added

- Close overview with custom shortcut support

## [1.1.0] - 2025

### Changed

- Updated overview shortcut from 'Y' to '.'
- Dynamically fetch and display the browser extension's keyboard shortcut

### Added

- `.` and `>` as keyboard shortcuts to toggle close
- `yarn.lock` for dependency management

### Removed

- `storage` and `tabCapture` permissions from manifest

## [1.0.0] - 2024

### Added

- Initial release of Mosaic (renamed from Tab Exposé)
- Tab overview with keyboard navigation and thumbnail caching
- Browser action to toggle the overview window
- Favicon loading via `favicon` permission
- Single-click highlighting, double-click to open
- Scroll to active tab on initial load
- Framer-motion entry/selection animations
- Extension icons and build/pack script
- Privacy policy
