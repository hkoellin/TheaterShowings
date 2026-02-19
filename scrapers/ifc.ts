import { Showtime } from '@/types/showtime';
import * as cheerio from 'cheerio';

/**
 * Scraper for IFC Center (https://www.ifccenter.com)
 *
 * The homepage contains server-rendered daily schedule blocks:
 *   div.daily-schedule.{day} (e.g. "daily-schedule wed active")
 *     h3 → "Wed Feb 18" (date header)
 *     ul > li > div.details
 *       h3 > a[href] → film title & link
 *       ul.times > li > a[href] → showtime text & ticket URL
 */
export async function scrapeIFC(): Promise<Showtime[]> {
  try {
    const response = await fetch('https://www.ifccenter.com', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      console.error(`IFC Center: HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const showtimes: Showtime[] = [];

    // Each .daily-schedule block represents one day
    $('.daily-schedule').each((_, dayEl) => {
      const $day = $(dayEl);

      // Date header: "Wed Feb 18", "Thu Feb 19", etc.
      const dateHeaderText = $day.find('> h3').first().text().trim();
      const isoDate = parseDateHeader(dateHeaderText);
      if (!isoDate) return;

      // Each div.details is one film entry
      $day.find('div.details').each((_, filmEl) => {
        try {
          const $film = $(filmEl);
          const titleLink = $film.find('h3 a').first();
          const film = titleLink.text().trim();
          if (!film) return;

          const filmUrl =
            titleLink.attr('href') || 'https://www.ifccenter.com';

          // Extract image URL if available
          const imageUrl = $film.find('img').first().attr('src');

          // Extract description if available
          const description = $film.find('p, .description, .synopsis').first().text().trim();

          // Collect all showtimes and create Showtime entries in a single loop
          const allTimes: string[] = [];
          const timeEntries: { time: string; ticketUrl: string }[] = [];

          $film.find('ul.times li a').each((_, timeEl) => {
            const $t = $(timeEl);
            const raw = $t.text().trim();
            const match = raw.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
            if (!match) return;

            const time = match[1].toUpperCase();
            allTimes.push(time);

            const ticketUrl = $t.attr('href') || filmUrl;
            timeEntries.push({ time, ticketUrl });
          });

          // Create a Showtime entry per individual time
          timeEntries.forEach(({ time, ticketUrl }) => {
            showtimes.push({
              id: `ifc-${film}-${isoDate}-${time}`
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/gi, '')
                .toLowerCase(),
              film,
              theater: 'IFC Center',
              date: isoDate,
              time,
              ticketUrl: ticketUrl.startsWith('http')
                ? ticketUrl
                : `https://www.ifccenter.com${ticketUrl}`,
              allTimes,
              imageUrl,
              description,
            });
          });
        } catch (err) {
          console.error('IFC: Error parsing film entry', err);
        }
      });
    });

    return showtimes;
  } catch (error) {
    console.error('IFC scraper error:', error);
    return [];
  }
}

/**
 * Parse "Wed Feb 18" style date headers into ISO date strings.
 * Assumes the current year; handles Dec→Jan year rollover.
 */
function parseDateHeader(text: string): string | null {
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };

  const match = text.match(
    /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i,
  );
  if (!match) return null;

  const monthName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  const monthIdx = months[monthName];
  if (monthIdx === undefined) return null;
  const day = parseInt(match[2], 10);

  const now = new Date();
  let year = now.getFullYear();
  const nowMonth = now.getMonth();

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

  const mm = String(monthIdx + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}
