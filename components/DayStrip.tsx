'use client';

import { useMemo } from 'react';

interface DayStripProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  daysWithEvents: Set<string>;
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DayStrip({ selectedDate, onDateChange, daysWithEvents }: DayStripProps) {
  const todayStr = formatDateISO(new Date());

  const days = useMemo(() => {
    const result: { date: string; dayName: string; dayNum: number; monthName: string; isToday: boolean }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const iso = formatDateISO(d);
      result.push({
        date: iso,
        dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        monthName: d.toLocaleDateString('en-US', { month: 'short' }),
        isToday: iso === todayStr,
      });
    }
    return result;
  }, [todayStr]);

  return (
    <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide px-1">
      {days.map((day) => {
        const isSelected = day.date === selectedDate;
        const hasEvents = daysWithEvents.has(day.date);

        return (
          <button
            key={day.date}
            onClick={() => onDateChange(day.date)}
            className={`
              flex flex-col items-center min-w-[4.5rem] px-3 py-2.5 rounded-xl transition-all duration-150 shrink-0
              ${isSelected
                ? 'bg-red-700 text-white shadow-md'
                : 'bg-red-50/60 text-gray-500 hover:bg-red-100 hover:text-gray-800 hover:shadow-sm'
              }
            `}
          >
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${
              isSelected ? 'text-red-100' : 'text-gray-400'
            }`}>
              {day.dayName}
            </span>
            <span className={`text-xl font-bold mt-0.5 ${
              isSelected ? 'text-white' : 'text-gray-800'
            }`}>
              {day.dayNum}
            </span>
            <span className={`text-[10px] uppercase tracking-wide ${
              isSelected ? 'text-red-100' : 'text-gray-400'
            }`}>
              {day.monthName}
            </span>
            {hasEvents && !isSelected && (
              <div className="w-1 h-1 rounded-full bg-red-500 mt-1" />
            )}
          </button>
        );
      })}
    </div>
  );
}
