'use client';

import { Showtime } from '@/types/showtime';

interface ShowtimeCardProps {
  showtime: Showtime;
}

const theaterColors: Record<string, string> = {
  'Metrograph': 'bg-blue-600',
  'BAM Rose Cinemas': 'bg-purple-600',
  'Low Cinema': 'bg-green-600',
  'IFC Center': 'bg-red-600',
  'Film Forum': 'bg-yellow-600',
};

export default function ShowtimeCard({ showtime }: ShowtimeCardProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
      {showtime.imageUrl && (
        <div className="relative h-48 w-full">
          <img
            src={showtime.imageUrl}
            alt={showtime.film}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="p-4">
        <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">
          {showtime.film}
        </h3>
        
        <div className="flex items-center gap-2 mb-3">
          <span 
            className={`${theaterColors[showtime.theater] || 'bg-gray-600'} text-white text-xs px-2 py-1 rounded-full`}
          >
            {showtime.theater}
          </span>
        </div>

        {showtime.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
            {showtime.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <div className="font-semibold">{formatDate(showtime.date)}</div>
            <div>{showtime.time}</div>
          </div>

          <a
            href={showtime.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors"
          >
            Buy Tickets
          </a>
        </div>
      </div>
    </div>
  );
}
