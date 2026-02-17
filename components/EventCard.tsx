'use client';

import { Showtime } from '@/types/showtime';

interface EventCardProps {
  showtime: Showtime;
  rank?: number;
}

const theaterColors: Record<string, { text: string; chip: string; border: string }> = {
  'BAM Rose Cinemas': { text: 'text-blue-700', chip: 'bg-blue-50 text-blue-700 border-blue-200', border: 'border-l-blue-600' },
  'Metrograph': { text: 'text-red-700', chip: 'bg-red-50 text-red-700 border-red-200', border: 'border-l-red-600' },
  'IFC Center': { text: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', border: 'border-l-emerald-600' },
  'Film Forum': { text: 'text-amber-700', chip: 'bg-amber-50 text-amber-700 border-amber-200', border: 'border-l-amber-600' },
  'Low Cinema': { text: 'text-violet-700', chip: 'bg-violet-50 text-violet-700 border-violet-200', border: 'border-l-violet-600' },
};

const defaultColors = { text: 'text-gray-600', chip: 'bg-gray-100 text-gray-600 border-gray-200', border: 'border-l-gray-400' };

const popularityLabel = (score: number | undefined) => {
  if (score === undefined) return null;
  if (score >= 80) return { text: 'Selling Fast', color: 'text-red-600 bg-red-50' };
  if (score >= 50) return { text: 'Popular', color: 'text-amber-700 bg-amber-50' };
  if (score >= 20) return { text: 'Available', color: 'text-emerald-700 bg-emerald-50' };
  return { text: 'Plenty Left', color: 'text-gray-500 bg-gray-100' };
};

export default function EventCard({ showtime, rank }: EventCardProps) {
  const popInfo = popularityLabel(showtime.popularity);
  const colors = theaterColors[showtime.theater] || defaultColors;
  const times = showtime.allTimes && showtime.allTimes.length > 0
    ? showtime.allTimes
    : [showtime.time];

  return (
    <a
      href={showtime.ticketUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex gap-4 p-4 rounded-lg bg-white hover:bg-gray-50 border-l-4 ${colors.border} shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer`}
    >
      {/* Rank number */}
      {rank !== undefined && (
        <div className="flex items-start pt-1">
          <span className="text-2xl font-bold text-gray-300 tabular-nums w-8 text-right">
            {rank}
          </span>
        </div>
      )}

      {/* Popularity badge */}
      {popInfo && (
        <div className="flex items-start pt-1.5">
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${popInfo.color}`}>
            {popInfo.text}
          </span>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <h3 className="text-[17px] font-bold text-gray-900 leading-tight">
            {showtime.film}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[13px] font-semibold ${colors.text}`}>
              {showtime.theater}
            </span>
          </div>
          {showtime.description && (
            <p className="text-[13px] text-gray-500 mt-1 line-clamp-2 leading-snug">
              {showtime.description}
            </p>
          )}
        </div>

        {/* Showtimes chips */}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {times.map((t, i) => (
            <span
              key={i}
              className={`px-2.5 py-1 rounded text-[13px] font-medium border ${colors.chip}`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Popularity bar (right side) */}
      {showtime.popularity !== undefined && (
        <div className="hidden sm:flex flex-col items-center justify-center gap-1.5 pl-3 border-l border-gray-200">
          <div className="w-6 h-16 bg-gray-100 rounded-full overflow-hidden relative">
            <div
              className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-500 bg-red-500"
              style={{ height: `${showtime.popularity}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400 font-medium">
            {showtime.popularity}%
          </span>
        </div>
      )}

      {/* Arrow */}
      <div className="flex items-center pl-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg className={`w-5 h-5 ${colors.text}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </a>
  );
}
