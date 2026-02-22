import { Showtime } from '@/types/showtime';
import { Preference } from '@/app/generated/prisma/client';

/**
 * Check if a showtime matches any of a subscriber's preferences.
 *
 * Matching rules:
 * - "film": case-insensitive substring match against showtime.film
 * - "director": case-insensitive substring match against showtime.film or showtime.description
 * - "actor": case-insensitive substring match against showtime.description
 *
 * Returns the list of preferences that matched (empty if none).
 */
export function matchShowtime(
  showtime: Showtime,
  preferences: Preference[]
): Preference[] {
  const filmLower = showtime.film.toLowerCase();
  const descLower = (showtime.description || '').toLowerCase();
  const combined = `${filmLower} ${descLower}`;

  return preferences.filter((pref) => {
    const valueLower = pref.value.toLowerCase();
    switch (pref.type) {
      case 'film':
        return filmLower.includes(valueLower);
      case 'director':
        // Directors often appear in film title (e.g., "Giuseppe De Santis' BITTER RICE")
        // or in the description
        return combined.includes(valueLower);
      case 'actor':
        return descLower.includes(valueLower);
      default:
        return false;
    }
  });
}

export interface MatchedShowtime {
  showtime: Showtime;
  matchedPreferences: Preference[];
}

/**
 * Find all showtimes that match any of a subscriber's preferences.
 */
export function findMatches(
  showtimes: Showtime[],
  preferences: Preference[]
): MatchedShowtime[] {
  const results: MatchedShowtime[] = [];

  for (const showtime of showtimes) {
    const matched = matchShowtime(showtime, preferences);
    if (matched.length > 0) {
      results.push({ showtime, matchedPreferences: matched });
    }
  }

  return results;
}
