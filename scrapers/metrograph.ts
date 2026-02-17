import { Showtime } from '@/types/showtime';
import * as cheerio from 'cheerio';

/**
 * Scraper for Metrograph (https://metrograph.com/film/)
 * 
 * Structure:
 *   div.homepage-in-theater-movie   – one per film
 *     h3.movie_title > a            – title + detail link
 *     div.showtimes                  – contains date/time blocks
 *       h5.sr-only / h6             – date label ("Tue Feb 17")
 *       div.film_day                – contains time links for that date
 *         a[title="Buy Tickets"]    – time text + ticket URL
 *     h5 (Director: ...)            – director info
 *     h5 (YYYY / XXmin / FORMAT)    – year, runtime, format
 *     p.synopsis                    – description
 */

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04',
  may: '05', jun: '06', jul: '07', aug: '08',
  sep: '09', oct: '10', nov: '11', dec: '12',
};

/**
 * Parse a date string like "Tue Feb 17" into YYYY-MM-DD.
 * Infers year from proximity to today.
 */
function parseMetrographDate(dateText: string): string | null {
  const match = dateText.match(/([A-Za-z]+)\s+(\d{1,2})/);
  if (!match) return null;

  const monthStr = match[1].toLowerCase().slice(0, 3);
  const month = MONTH_MAP[monthStr];
  if (!month) return null;

  const day = match[2].padStart(2, '0');
  const now = new Date();
  let year = now.getFullYear();

  // If the month is much earlier than the current month, it's likely next year
  const monthNum = parseInt(month);
  if (monthNum < now.getMonth() - 1) {
    year += 1;
  }

  return `${year}-${month}-${day}`;
}

export async function scrapeMetrograph(): Promise<Showtime[]> {
  try {
    const url = 'https://metrograph.com/film/';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`Metrograph: HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const showtimes: Showtime[] = [];

    $('div.homepage-in-theater-movie').each((_, element) => {
      try {
        const $el = $(element);

        // Film title
        const film = $el.find('h3.movie_title a').first().text().trim();
        if (!film) return;

        // Image URL
        const imageUrl = $el.find('img').first().attr('src') || undefined;

        // Description
        const description = $el.find('p.synopsis').text().trim() || undefined;

        // Director
        let director: string | undefined;
        $el.find('h5').each((_, h5) => {
          const text = $(h5).text().trim();
          const dirMatch = text.match(/Director:\s*(.+)/i);
          if (dirMatch) director = dirMatch[1].trim();
        });

        // Film detail URL
        const filmPath = $el.find('h3.movie_title a').attr('href') || '';
        const filmUrl = filmPath.startsWith('http')
          ? filmPath
          : `https://metrograph.com${filmPath}`;

        // Parse showtimes: iterate through date headers and their film_day divs
        const $showtimesContainer = $el.find('div.showtimes');

        // Collect date sections: each h5.sr-only or h6 is followed by a div.film_day
        let currentDate: string | null = null;

        $showtimesContainer.children().each((_, child) => {
          const $child = $(child);
          const tagName = (child as cheerio.Element).tagName?.toLowerCase();

          // Date header: h5.sr-only or h6
          if ((tagName === 'h5' && $child.hasClass('sr-only')) || tagName === 'h6') {
            const dateText = $child.text().trim();
            currentDate = parseMetrographDate(dateText);
            return; // continue
          }

          // Time block: div.film_day
          if (tagName === 'div' && $child.hasClass('film_day') && currentDate) {
            $child.find('a').each((_, timeLink) => {
              const $link = $(timeLink);
              const timeText = $link.text().trim();
              if (!timeText) return;

              // Normalize time: "3:00pm" → "3:00 PM"
              const timeMatch = timeText.match(/(\d{1,2}:\d{2})\s*(am|pm)/i);
              if (!timeMatch) return;

              const time = `${timeMatch[1]} ${timeMatch[2].toUpperCase()}`;
              const ticketUrl = $link.attr('href') || filmUrl;

              showtimes.push({
                id: `metrograph-${film}-${currentDate}-${time}`
                  .replace(/\s+/g, '-')
                  .replace(/[^a-z0-9\-]/gi, '')
                  .toLowerCase(),
                film,
                theater: 'Metrograph',
                date: currentDate!,
                time,
                ticketUrl: ticketUrl.startsWith('http')
                  ? ticketUrl
                  : `https://metrograph.com${ticketUrl}`,
                imageUrl,
                description: director
                  ? `${director}${description ? ' — ' + description : ''}`
                  : description,
              });
            });
          }
        });
      } catch (err) {
        console.error('Metrograph: Error parsing film card', err);
      }
    });

    console.log(`Metrograph: Found ${showtimes.length} showtimes`);
    return showtimes;
  } catch (error) {
    console.error('Metrograph scraper error:', error);
    return [];
  }
}
