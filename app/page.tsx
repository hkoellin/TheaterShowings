'use client';

import { useState, useEffect } from 'react';
import { Showtime, TheaterName, THEATERS } from '@/types/showtime';
import ShowtimeCard from '@/components/ShowtimeCard';
import TheaterFilter from '@/components/TheaterFilter';
import DateFilter from '@/components/DateFilter';

export default function Home() {
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTheaters, setSelectedTheaters] = useState<TheaterName[]>(THEATERS);
  const [selectedDate, setSelectedDate] = useState('all');

  useEffect(() => {
    fetchShowtimes();
  }, []);

  const fetchShowtimes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/showtimes');
      
      if (!response.ok) {
        throw new Error('Failed to fetch showtimes');
      }
      
      const data = await response.json();
      setShowtimes(data.showtimes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching showtimes:', err);
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

  const filterShowtimes = () => {
    let filtered = showtimes.filter(showtime =>
      selectedTheaters.includes(showtime.theater as TheaterName)
    );

    if (selectedDate !== 'all') {
      if (selectedDate === 'week') {
        const today = new Date();
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        
        filtered = filtered.filter(showtime => {
          const showtimeDate = new Date(showtime.date + 'T00:00:00');
          return showtimeDate >= today && showtimeDate <= weekFromNow;
        });
      } else {
        filtered = filtered.filter(showtime => showtime.date === selectedDate);
      }
    }

    return filtered;
  };

  const filteredShowtimes = filterShowtimes();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            🎬 NYC Theater Showtimes
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Independent cinema showtimes across New York City
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Filters */}
          <aside className="lg:col-span-1 space-y-4">
            <TheaterFilter
              selectedTheaters={selectedTheaters}
              onToggle={toggleTheater}
            />
            <DateFilter
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />
            
            <button
              onClick={fetchShowtimes}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors"
            >
              Refresh
            </button>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3">
            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
                <p className="text-red-800 dark:text-red-200 font-semibold">
                  {error}
                </p>
                <button
                  onClick={fetchShowtimes}
                  className="mt-4 text-red-600 dark:text-red-400 hover:underline text-sm"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && filteredShowtimes.length === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  No showtimes found matching your filters.
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
                  Try adjusting your theater or date selection.
                </p>
              </div>
            )}

            {/* Showtimes Grid */}
            {!loading && !error && filteredShowtimes.length > 0 && (
              <>
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  Showing {filteredShowtimes.length} {filteredShowtimes.length === 1 ? 'showtime' : 'showtimes'}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredShowtimes.map((showtime) => (
                    <ShowtimeCard key={showtime.id} showtime={showtime} />
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
