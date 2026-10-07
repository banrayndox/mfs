import React from 'react';

/**
 * Original placeholder brandmark component for Guardian MFS
 * Adheres to AGENTS.md rule 10: never use upay's real logo/assets.
 */
export function BrandMark({ size = 'md', showWordmark = true, className = '' }) {
  const sizeMap = {
    sm: { icon: 'w-7 h-7', text: 'text-base' },
    md: { icon: 'w-9 h-9', text: 'text-lg font-bold' },
    lg: { icon: 'w-12 h-12', text: 'text-2xl font-extrabold' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <div
        className={`${currentSize.icon} rounded-full bg-brand-yellow border-2 border-brand-blue flex items-center justify-center shadow-soft shrink-0 relative overflow-hidden`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full p-1" fill="none">
          {/* Shield silhouette */}
          <path
            d="M50 15 L78 28 V52 C78 70 50 85 50 85 C50 85 22 70 22 52 V28 Z"
            fill="#0B4DA2"
          />
          {/* Guardian golden heart/star */}
          <circle cx="50" cy="45" r="9" fill="#FFD400" />
          <path
            d="M38 65 C38 56 43 53 50 53 C57 53 62 56 62 65 Z"
            fill="#FFD400"
          />
        </svg>
      </div>

      {showWordmark && (
        <div className="flex flex-col leading-tight">
          <div className={`tracking-tight ${currentSize.text} text-slate-900 dark:text-white font-sans flex items-baseline gap-1.5`}>
            <span className="text-brand-blue dark:text-brand-yellow font-black">Upay</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-yellow/20 text-brand-blue dark:text-brand-yellow dark:bg-brand-yellow/10">powered by AI</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default BrandMark;
