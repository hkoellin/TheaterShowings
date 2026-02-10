'use client';

import { useState, useEffect } from 'react';
import { Showtime, TheaterName, THEATERS } from '@/types/showtime';
import WeekCalendar from '@/components/WeekCalendar';

export default function Home() {
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTheaters, setSelectedTheaters] = useState<TheaterName[]>([...THEATERS]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const toggleTheater = (theater: TheaterName) => {
    setSelectedTheaters(prev =>
      prev.includes(theater)
        ? prev.filter(t => t !== theater)
        : [...prev, theater]
    );
  };

  const theaterDotColors: Record<string, string> = {
    'Metrograph': 'bg-blue-500',
    'BAM Rose Cinemas': 'bg-purple-500',
    'Low Cinema': 'bg-green-500',
    'IFC Center': 'bg-red-500',
    'Film Forum': 'bg-amber-500',
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Top Bar — Teams-style */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#ebebeb] dark:bg-[#1f1f1f] border-b border-gray-300 dark:border-gray-700">
        <div className="flex items-center gap-3">
          {/* Hamburger for mobile theater filter */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            aria-label="Toggle filters"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg">🎬</span>
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              NYC Theater Showtimes
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchShowtimes}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
            </svg>
            Refresh
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar — Theater Filter */}
        <aside className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 
          fixed lg:static inset-y-0 left-0 z-30
          w-56 bg-[#f5f5f5] dark:bg-[#181818] border-r border-gray-200 dark:border-gray-700
          transition-transform duration-200 ease-in-out
          flex flex-col
        `}>
          {/* Mobile close */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1 lg:hidden">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Filters</span>
            <button onClick={() => setSidebarOpen(false)} className="p-1 text-gray-500 hover:text-gray-700">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
              Theaters
            </h3>
            <div className="space-y-1">
              {THEATERS.map((theater) => (
                <label
                  key={theater}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-200/70 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedTheaters.includes(theater)}
                    onChange={() => toggleTheater(theater)}
                    className="w-3.5 h-3.5 rounded text-blue-600 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:ring-1"
                  />
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${theaterDotColors[theater] || 'bg-gray-500'}`} />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {theater}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="px-4 pt-2 pb-3 border-t border-gray-200 dark:border-gray-700 mt-auto">
            <div className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
              Showing {showtimes.length} total showtime{showtimes.length !== 1 ? 's' : ''} from {THEATERS.length} theaters
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Calendar Area */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Loading showtimes...</span>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="text-red-500 mb-2">
                  <svg className="w-10 h-10 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{error}</p>
                <button
                  onClick={fetchShowtimes}
                  className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <WeekCalendar
              showtimes={showtimes}
              selectedTheaters={selectedTheaters}
            />
          )}
        </main>
      </div>
    </div>
  );
}
