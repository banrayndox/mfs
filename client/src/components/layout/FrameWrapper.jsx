import React from 'react';

export function FrameWrapper({ children }) {
  return (
    <div
      className="min-h-screen bg-slate-100 dark:bg-slate-950 flex justify-center selection:bg-brand-yellow selection:text-slate-900 no-scrollbar"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div
        className="w-full max-w-[480px] min-h-screen bg-surface-light dark:bg-surface-dark flex flex-col relative shadow-2xl overflow-x-clip border-x border-slate-200/60 dark:border-slate-800/60 no-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>
    </div>
  );
}

export default FrameWrapper;
