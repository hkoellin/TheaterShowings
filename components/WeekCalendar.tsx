'use client';

import { useState, useMemo } from 'react';
import { Showtime, TheaterName } from '@/types/showtime';

interface WeekCalendarProps {
  showtimes: Showtime[];
  selectedTheaters: TheaterName[];
}

const theaterColors: Record<string, { bg: string; border: string; text: string }> = {
  'Metrograph': { bg: 'bg-blue-500/15', border: 'border-l-blue-500', text: 'text-blue-700 dark:text-blue-300' },
  'BAM Rose Cinemas': { bg: 'bg-purple-500/15', border: 'border-l-purple-500', text: 'text-purple-700 dark:text-purple-300' },
  'Low Cinema': { bg: 'bg-green-500/15', border: 'border-l-green-500', text: 'text-green-700 dark:text-green-300' },
  'IFC Center': { bg: 'bg-red-500/15', border: 'border-l-red-500', text: 'text-red-700 dark:text-red-300' },
  'Film Forum': { bg: 'bg-amber-500/15', border: 'border-l-amber-500', text: 'text-amber-700 dark:text-amber-300' },
};

const theaterDotColors: Record<string, string> = {
  'Metrograph': 'bg-blue-500',
  'BAM Rose Cinemas': 'bg-purple-500',
  'Low Cinema': 'bg-green-500',
  'IFC Center': 'bg-red-500',
  'Film Forum': 'bg-amber-500',
};

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Start week on Sunday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekDays(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatMonthRange(days: Date[]): string {
  const first = days[0];
  const last = days[6];
  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
  if (first.getMonth() === last.getMonth()) {
    return monthFormatter.format(first);
  }
  const shortMonth = new Intl.DateTimeFormat('en-US', { month: 'short' });
  if (first.getFullYear() === last.getFullYear()) {
    return `${shortMonth.format(first)} – ${shortMonth.format(last)} ${first.getFullYear()}`;
  }
  const shortMonthYear = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
  return `${shortMonthYear.format(first)} – ${shortMonthYear.format(last)}`;
}

export default function WeekCalendar({ showtimes, selectedTheaters }: WeekCalendarProps) {
  const [weekStart, setWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [selectedEvent, setSelectedEvent] = useState<Showtime | null>(null);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const todayStr = formatDateISO(new Date());

  const filteredShowtimes = useMemo(() => {
    return showtimes.filter(s => selectedTheaters.includes(s.theater as TheaterName));
  }, [showtimes, selectedTheaters]);

  // Group showtimes by date
  const showtimesByDate = useMemo(() => {
    const map = new Map<string, Showtime[]>();
    for (const s of filteredShowtimes) {
      const dateKey = s.date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(s);
    }
    // Sort each day's showtimes by time
    for (const [, dayShowtimes] of map) {
      dayShowtimes.sort((a, b) => {
        const ta = convertTo24(a.time);
        const tb = convertTo24(b.time);
        return ta.localeCompare(tb);
      });
    }
    return map;
  }, [filteredShowtimes]);

  function convertTo24(time12: string): string {
    const parts = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!parts) return time12;
    let h = parseInt(parts[1], 10);
    const m = parts[2];
    const ampm = parts[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }

  const goToPrevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const goToNextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const goToToday = () => {
    setWeekStart(getStartOfWeek(new Date()));
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Toolbar */}
      <div className="flex items-center justify-between px-2 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Today
          </button>
          <div className="flex items-center">
            <button
              onClick={goToPrevWeek}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
              aria-label="Previous week"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={goToNextWeek}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
              aria-label="Next week"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {formatMonthRange(weekDays)}
          </h2>
        </div>
      </div>

      {/* Week Grid */}
      <div className="flex-1 grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {/* Day Headers */}
        {weekDays.map((day, i) => {
          const dateStr = formatDateISO(day);
          const isToday = dateStr === todayStr;
          return (
            <div
              key={i}
              className={`flex flex-col items-center py-2 border-r last:border-r-0 border-gray-200 dark:border-gray-700 ${
                isToday ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
              }`}
            >
              <span className={`text-xs font-medium uppercase tracking-wide ${
                isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {dayNames[i]}
              </span>
              <span className={`mt-1 flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                isToday
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Day Columns with Events */}
      <div className="flex-1 grid grid-cols-7 min-h-0">
        {weekDays.map((day, i) => {
          const dateStr = formatDateISO(day);
          const isToday = dateStr === todayStr;
          const dayShowtimes = showtimesByDate.get(dateStr) || [];

          return (
            <div
              key={i}
              className={`border-r last:border-r-0 border-gray-200 dark:border-gray-700 overflow-y-auto p-1 space-y-1 ${
                isToday ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''
              }`}
              style={{ minHeight: '320px' }}
            >
              {dayShowtimes.map((showtime) => {
                const colors = theaterColors[showtime.theater] || {
                  bg: 'bg-gray-500/15',
                  border: 'border-l-gray-500',
                  text: 'text-gray-700 dark:text-gray-300',
                };
                return (
                  <button
                    key={showtime.id}
                    onClick={() => setSelectedEvent(selectedEvent?.id === showtime.id ? null : showtime)}
                    className={`w-full text-left rounded-md border-l-3 px-2 py-1.5 transition-all cursor-pointer hover:shadow-md ${colors.bg} ${colors.border}`}
                  >
                    <div className={`text-xs font-semibold truncate ${colors.text}`}>
                      {showtime.film}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {showtime.time}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${theaterDotColors[showtime.theater] || 'bg-gray-500'}`} />
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                        {showtime.theater}
                      </span>
                    </div>
                  </button>
                );
              })}

              {dayShowtimes.length === 0 && (
                <div className="flex items-center justify-center h-full min-h-[60px]">
                  <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Event Detail Panel (slides in from right, Teams-style) */}
      {selectedEvent && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 z-50 flex flex-col animate-slide-in">
          {/* Panel Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate pr-4">
              {selectedEvent.film}
            </h3>
            <button
              onClick={() => setSelectedEvent(null)}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Film Image */}
            {selectedEvent.imageUrl && (
              <div className="rounded-lg overflow-hidden">
                <img
                  src={selectedEvent.imageUrl}
                  alt={selectedEvent.film}
                  className="w-full h-48 object-cover"
                />
              </div>
            )}

            {/* Theater Badge */}
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${theaterDotColors[selectedEvent.theater] || 'bg-gray-500'}`} />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {selectedEvent.theater}
              </span>
            </div>

            {/* Date & Time */}
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span>
                {new Date(selectedEvent.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{selectedEvent.time}</span>
            </div>

            {/* Description */}
            {selectedEvent.description && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  About
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {selectedEvent.description}
                </p>
              </div>
            )}
          </div>

          {/* Buy Tickets Button */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <a
              href={selectedEvent.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md text-sm font-semibold transition-colors"
            >
              Buy Tickets
            </a>
          </div>
        </div>
      )}

      {/* Backdrop for detail panel */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
