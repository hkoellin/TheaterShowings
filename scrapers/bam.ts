import { Showtime } from '@/types/showtime';
import * as cheerio from 'cheerio';

/**
 * Scraper for BAM Rose Cinemas (https://www.bam.org/film)
 * 
 * BAM's film page uses `.productionblock` divs with data attributes:
 *   - data-sort-title: film title
 *   - data-sort-date: start date (YYYY-MM-DD-HH:mm:ss)
 *   - data-sort-genre: "Film"
 * 
 * Each block contains:
 *   - .bam-block-2x2-title: film title (h3)
 *   - .bam-block-2x2-date: date range text (e.g., "Feb 6—Feb 19, 2026" or "Now Playing")
 *   - .bam-block-2x2-hover-content-body: description
 *   - a.buy-button: ticket purchase link
 *   - a.btn[href^="/film/"]: detail page link
 *   - picture img: film poster
 * 
 * Note: Specific showtimes (times of day) are loaded client-side and not
 * available in the server-rendered HTML. We create entries for each date
 * in the film's run with a "See Times" placeholder.
 */
export async function scrapeBAM(): Promise<Showtime[]> {
  try {
    const url = 'https://www.bam.org/film';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.error(`BAM: HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const showtimes: Showtime[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Select all film production blocks
    $('.productionblock[data-sort-genre="Film"]').each((_, element) => {
      try {
        const $el = $(element);

        // Extract film title from data attribute (most reliable)
        const film = $el.attr('data-sort-title')?.trim();
        if (!film) return;

        // Extract date range text
        const dateText = $el.find('.bam-block-2x2-date').first().text().trim();

        // Extract description
        const description = $el.find('.bam-block-2x2-hover-content-body').first().text().trim();

        // Extract ticket URL
        const ticketUrl = $el.find('a.buy-button').first().attr('href') || '';

        // Extract detail page URL
        const detailPath = $el.find('a.btn[href^="/film/"]').first().attr('href') || '';
        const detailUrl = detailPath ? `https://www.bam.org${detailPath}` : url;

        // Extract image URL
        const imgEl = $el.find('.bam-block-2x2-top img').first();
        let imageUrl = imgEl.attr('src') || '';
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = `https://www.bam.org${imageUrl}`;
        }
        // Clean up query params for a nicer image
        if (imageUrl) {
          imageUrl = imageUrl.split('?')[0];
        }

        // Parse the date range to generate individual date entries
        const dates = parseDateRange(dateText, $el.attr('data-sort-date') || '');

        // Filter to only include dates from today onward (within 2 weeks)
        const twoWeeksOut = new Date(today);
        twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);

        for (const date of dates) {
          const dateObj = new Date(date + 'T00:00:00');
          if (dateObj < today || dateObj > twoWeeksOut) continue;

          showtimes.push({
            id: `bam-${film}-${date}`.replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '').toLowerCase(),
            film: decodeHtmlEntities(film),
            theater: 'BAM Rose Cinemas',
            date,
            time: 'See Times',
            ticketUrl: ticketUrl || detailUrl,
            imageUrl: imageUrl || undefined,
            description: description || undefined,
          });
        }
      } catch (err) {
        console.error('BAM: Error parsing production block', err);
      }
    });

    return showtimes;
  } catch (error) {
    console.error('BAM scraper error:', error);
    return [];
  }
}

/**
 * Parse BAM date range text into individual ISO date strings.
 * 
 * Handles formats like:
 *   - "Feb 6—Feb 19, 2026" (date range)
 *   - "Wed, Feb 11, 2026" (single date)
 *   - "Now Playing" (use data-sort-date as start, assume 2 weeks)
 */
function parseDateRange(dateText: string, sortDate: string): string[] {
  const dates: string[] = [];
  const currentYear = new Date().getFullYear();

  // Try range format: "Feb 6—Feb 19, 2026" or "Feb 6 — Feb 19, 2026"
  const rangeMatch = dateText.match(
    /([A-Z][a-z]+)\s+(\d{1,2})\s*[—–-]\s*([A-Z][a-z]+)\s+(\d{1,2}),?\s*(\d{4})/
  );
  if (rangeMatch) {
    const [, startMonth, startDay, endMonth, endDay, year] = rangeMatch;
    const start = new Date(`${startMonth} ${startDay}, ${year}`);
    const end = new Date(`${endMonth} ${endDay}, ${year}`);
    
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const d = new Date(start);
      while (d <= end) {
        dates.push(formatISO(d));
        d.setDate(d.getDate() + 1);
      }
      return dates;
    }
  }

  // Try single date format: "Wed, Feb 11, 2026"
  const singleMatch = dateText.match(
    /(?:[A-Z][a-z]+,?\s+)?([A-Z][a-z]+)\s+(\d{1,2}),?\s*(\d{4})/
  );
  if (singleMatch) {
    const [, month, day, year] = singleMatch;
    const d = new Date(`${month} ${day}, ${year}`);
    if (!isNaN(d.getTime())) {
      dates.push(formatISO(d));
      return dates;
    }
  }

  // Fallback: "Now Playing" or unrecognized — use data-sort-date
  if (sortDate) {
    // sortDate format: "2025-11-26-00:00:00"
    const datePartMatch = sortDate.match(/^(\d{4}-\d{2}-\d{2})/);
    if (datePartMatch) {
      const start = new Date(datePartMatch[1] + 'T00:00:00');
      // For "Now Playing", generate dates for next 7 days from today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d = new Date(today);
      for (let i = 0; i < 7; i++) {
        dates.push(formatISO(d));
        d.setDate(d.getDate() + 1);
      }
      return dates;
    }
  }

  // Last resort: just today
  dates.push(formatISO(new Date()));
  return dates;
}

function formatISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&eacute;/g, 'é')
    .replace(/&aacute;/g, 'á')
    .replace(/&#226;/g, 'â')
    .replace(/&#\d+;/g, (match) => {
      const code = parseInt(match.replace('&#', '').replace(';', ''), 10);
      return String.fromCharCode(code);
    });
}
