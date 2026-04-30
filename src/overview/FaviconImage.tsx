import { useState } from 'react';
import { Globe } from 'lucide-react';

export const getFaviconUrl = (u: string, size: number) => {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', u);
  url.searchParams.set('size', size.toString());
  return url.toString();
};

export const FaviconImage = ({
  pageUrl,
  originalSrc,
  className,
  fallbackClassName,
  fallbackSize,
  maxDisplaySize,
}: {
  pageUrl?: string;
  originalSrc?: string;
  className: string;
  fallbackClassName: string;
  fallbackSize: number;
  maxDisplaySize?: number;
}) => {
  const [errorCount, setErrorCount] = useState(0);

  let srcToTry;
  if (errorCount === 0 && pageUrl) {
    srcToTry = getFaviconUrl(pageUrl, 32);
  } else if (errorCount <= 1 && originalSrc) {
    srcToTry = originalSrc;
  }

  if (!srcToTry) {
    return <Globe size={fallbackSize} className={fallbackClassName} />;
  }

  const dpr = window.devicePixelRatio || 1;
  const nativeCssSize = Math.round(32 / dpr);
  const displaySize = maxDisplaySize
    ? Math.min(maxDisplaySize, nativeCssSize)
    : nativeCssSize;

  return (
    <img
      src={srcToTry}
      className={className}
      style={{ width: displaySize, height: displaySize, imageRendering: 'auto' }}
      alt=""
      onError={() => setErrorCount((c) => c + 1)}
    />
  );
};
