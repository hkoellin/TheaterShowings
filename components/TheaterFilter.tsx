'use client';

import { TheaterName, THEATERS } from '@/types/showtime';

interface TheaterFilterProps {
  selectedTheaters: TheaterName[];
  onToggle: (theater: TheaterName) => void;
}

export default function TheaterFilter({ selectedTheaters, onToggle }: TheaterFilterProps) {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Theaters</h3>
      <div className="space-y-2">
        {THEATERS.map((theater) => (
          <label key={theater} className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={selectedTheaters.includes(theater)}
              onChange={() => onToggle(theater)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              {theater}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
