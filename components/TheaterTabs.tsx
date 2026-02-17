'use client';

import { TheaterName, THEATERS } from '@/types/showtime';

interface TheaterTabsProps {
  selectedTheater: string; // 'all' or a TheaterName
  onTabChange: (theater: string) => void;
  theaterCounts: Record<string, number>;
}



export default function TheaterTabs({ selectedTheater, onTabChange, theaterCounts }: TheaterTabsProps) {
  const tabs = ['all', ...THEATERS] as const;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {tabs.map((tab) => {
        const isSelected = tab === selectedTheater;
        const count = tab === 'all'
          ? Object.values(theaterCounts).reduce((a, b) => a + b, 0)
          : (theaterCounts[tab] || 0);

        if (tab !== 'all' && count === 0) return null;

        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-150 shrink-0 whitespace-nowrap
              ${isSelected
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200'
              }
            `}
          >

            <span>{tab === 'all' ? 'All Venues' : tab}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              isSelected ? 'bg-black/10' : 'bg-white/5'
            }`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
