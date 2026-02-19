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
                ? 'bg-red-700 text-white'
                : 'bg-red-50/60 text-gray-600 hover:bg-red-100 hover:text-gray-900 border border-red-200/50'
              }
            `}
          >

            <span>{tab === 'all' ? 'All Venues' : tab}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              isSelected ? 'bg-red-900/20' : 'bg-red-100/50'
            }`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
