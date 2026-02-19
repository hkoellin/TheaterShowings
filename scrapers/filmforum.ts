import { Showtime } from '@/types/showtime';
import * as cheerio from 'cheerio';

/**
 * Scraper for Film Forum (https://filmforum.org/now_playing)
 * 
 * This scraper fetches the Film Forum now playing page and extracts:
 * - Film titles from current screenings
 * - Showtimes for each film
 * - Ticket purchase links
 * - Film images and descriptions
 * 
 * Note: Film Forum has a classic layout that may change. Update selectors as needed.
 */
export async function scrapeFilmForum(): Promise<Showtime[]> {
  try {
    const url = 'https://filmforum.org/now_playing';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`Film Forum: HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const showtimes: Showtime[] = [];

    // Film Forum typically has a list of currently playing films
    $('.film, .movie, .screening, .show, article').each((_, element) => {
      try {
        const $el = $(element);
        
        // Extract film title
        const film = $el.find('h2, h3, .title, .film-title').first().text().trim();
        if (!film) return;

        // Extract image
        const imageUrl = $el.find('img').first().attr('src') || 
                        $el.find('img').first().attr('data-src');

        // Extract description
        const description = $el.find('p, .description, .synopsis').first().text().trim();

        // Collect all showtimes and create Showtime entries
        const timeEntries: { date: string; time: string; ticketUrl: string }[] = [];
        const allTimesByDate: Record<string, string[]> = {};

        // Extract showtimes
        $el.find('.showtime, .time, time, a[href*="ticket"], a[href*="show"]').each((_, timeEl) => {
          const $time = $(timeEl);
          const timeText = $time.text().trim();
          const ticketUrl = $time.attr('href') || $time.closest('a').attr('href') || url;

          // Parse date and time
          const dateMatch = timeText.match(/(\d{1,2})\/(\d{1,2})/);
          const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);

          if (timeMatch) {
            const date = parseDateFromMatch(dateMatch);
            const time = `${timeMatch[1]}:${timeMatch[2]} ${timeMatch[3].toUpperCase()}`;

            // Track all times for this date
            if (!allTimesByDate[date]) {
              allTimesByDate[date] = [];
            }
            allTimesByDate[date].push(time);

            timeEntries.push({ date, time, ticketUrl });
          }
        });

        // Create Showtime entries
        timeEntries.forEach(({ date, time, ticketUrl }) => {
          showtimes.push({
            id: `filmforum-${film}-${date}-${time}`
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/gi, '')
              .toLowerCase(),
            film,
            theater: 'Film Forum',
            date,
            time,
            ticketUrl: ticketUrl.startsWith('http') ? ticketUrl : `https://filmforum.org${ticketUrl}`,
            allTimes: allTimesByDate[date],
            imageUrl,
            description
          });
        });
      } catch (err) {
        console.error('Film Forum: Error parsing film', err);
      }
    });

    return showtimes;
  } catch (error) {
    console.error('Film Forum scraper error:', error);
    return [];
  }
}

/**
 * Parse date from MM/DD format match with proper year rollover handling.
 * Handles December dates viewed in Jan/Feb correctly.
 */
function parseDateFromMatch(dateMatch: RegExpMatchArray | null): string {
  const now = new Date();
  let year = now.getFullYear();
  const nowMonth = now.getMonth();
  
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10);
    const day = parseInt(dateMatch[2], 10);
    const monthIdx = month - 1; // Convert to 0-indexed

    // Handle Dec dates viewed from Jan/Feb as belonging to the previous year,
    // otherwise, if the date appears to be far in the past, assume next year.
    if (monthIdx === 11 && (nowMonth === 0 || nowMonth === 1)) {
      // We're in Jan/Feb looking at a Dec date → treat as last year's December.
      year -= 1;
    } else {
      const candidate = new Date(year, monthIdx, day);
      if (candidate.getTime() < now.getTime() - 30 * 24 * 60 * 60 * 1000) {
        year += 1;
      }
    }

    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }
  
  // No date match, use today
  return now.toISOString().split('T')[0];
}
