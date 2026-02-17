'use client';

import { useState, useEffect, useMemo } from 'react';
import { Showtime, TheaterName, THEATERS } from '@/types/showtime';
import DayStrip from '@/components/DayStrip';
import TheaterTabs from '@/components/TheaterTabs';
import EventCard from '@/components/EventCard';

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDayHeader(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDateISO(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateISO(tomorrow);

  if (dateStr === todayStr) {
    return 'Today · ' + date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }
  if (dateStr === tomorrowStr) {
    return 'Tomorrow · ' + date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export default function Home() {
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => formatDateISO(new Date()));
  const [selectedTheater, setSelectedTheater] = useState<string>('all');

  useEffect(() => {
    fetchShowtimes();
  }, []);

  const fetchShowtimes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/showtimes');
      if (!response.ok) throw new Error('Failed to fetch showtimes');
      const data = await response.json();
      setShowtimes(data.showtimes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // All dates that have events
  const daysWithEvents = useMemo(() => {
    const days = new Set<string>();
    for (const s of showtimes) {
      days.add(s.date);
    }
    return days;
  }, [showtimes]);

  // Group showtimes by film+theater+date so a single card shows all times
  const groupedShowtimes = useMemo(() => {
    const dateFiltered = showtimes.filter(s => s.date === selectedDate);
    const theaterFiltered = selectedTheater === 'all'
      ? dateFiltered
      : dateFiltered.filter(s => s.theater === selectedTheater);

    // Group by film + theater
    const map = new Map<string, Showtime>();
    for (const s of theaterFiltered) {
      const key = `${s.film}|||${s.theater}`;
      if (!map.has(key)) {
        map.set(key, { ...s, allTimes: [s.time] });
      } else {
        const existing = map.get(key)!;
        if (!existing.allTimes) existing.allTimes = [existing.time];
        if (!existing.allTimes.includes(s.time)) {
          existing.allTimes.push(s.time);
        }
        // Keep higher popularity
        if (s.popularity !== undefined) {
          existing.popularity = Math.max(existing.popularity || 0, s.popularity);
        }
      }
    }

    // Sort: popularity (desc), then alphabetical
    const results = Array.from(map.values());
    results.sort((a, b) => {
      const pa = a.popularity ?? -1;
      const pb = b.popularity ?? -1;
      if (pb !== pa) return pb - pa;
      return a.film.localeCompare(b.film);
    });

    return results;
  }, [showtimes, selectedDate, selectedTheater]);

  // Theater counts for selected date
  const theaterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const dateFiltered = showtimes.filter(s => s.date === selectedDate);

    // Count unique films per theater
    for (const theater of THEATERS) {
      const films = new Set(dateFiltered.filter(s => s.theater === theater).map(s => s.film));
      counts[theater] = films.size;
    }
    return counts;
  }, [showtimes, selectedDate]);

  return (
    <div className="min-h-screen bg-[#f5f0e8] text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#f5f0e8]/90 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4">
          {/* Top bar */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
                <span className="text-lg">🎬</span>
              </div>
              <div>
                <h1 className="text-[17px] font-bold tracking-tight text-gray-900">NYC Screenings</h1>
                <p className="text-[12px] text-gray-500">Independent cinema showtimes</p>
              </div>
            </div>
            <button
              onClick={fetchShowtimes}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium rounded-lg bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 transition-all disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
              </svg>
              Refresh
            </button>
          </div>

          {/* Day strip */}
          <div className="py-2">
            <DayStrip
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              daysWithEvents={daysWithEvents}
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Day heading + theater tabs */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 tracking-tight">
            {formatDayHeader(selectedDate)}
          </h2>
          <TheaterTabs
            selectedTheater={selectedTheater}
            onTabChange={setSelectedTheater}
            theaterCounts={theaterCounts}
          />
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-900 border-t-transparent" />
            <span className="text-sm text-gray-500 mt-4">Loading showtimes...</span>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-2">{error}</p>
            <button
              onClick={fetchShowtimes}
              className="text-sm text-red-600 hover:text-red-500 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Event list */}
        {!loading && !error && (
          <>
            {groupedShowtimes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="w-16 h-16 rounded-2xl bg-gray-200 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 0A1.125 1.125 0 014.5 4.5h15a1.125 1.125 0 011.125 1.125v12.75M3.375 19.5h17.25m0 0a1.125 1.125 0 001.125-1.125M20.625 19.5h-1.5A1.875 1.875 0 0117.25 17.625V5.625m3.375 0v12.75" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">No screenings on this date</p>
                <p className="text-xs text-gray-400 mt-1">Try selecting another day</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Results count */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] text-gray-500 uppercase tracking-wider font-semibold">
                    {groupedShowtimes.length} screening{groupedShowtimes.length !== 1 ? 's' : ''}
                  </p>
                  {groupedShowtimes.some(s => s.popularity !== undefined) && (
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                      Sorted by demand
                    </p>
                  )}
                </div>

                {groupedShowtimes.map((showtime, i) => (
                  <EventCard
                    key={showtime.id}
                    showtime={showtime}
                    rank={i + 1}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            NYC Screenings — Independent cinema showtimes
          </p>
          <p className="text-[10px] text-gray-400">
            {showtimes.length} total showtime{showtimes.length !== 1 ? 's' : ''} from {THEATERS.length} theaters
          </p>
        </div>
      </footer>
    </div>
  );
}
