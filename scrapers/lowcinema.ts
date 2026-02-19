import { Showtime } from '@/types/showtime';
import * as cheerio from 'cheerio';

/**
 * Scraper for Low Cinema (https://lowcinema.com)
 *
 * Strategy:
 *   1. Fetch /tickets/ to get the list of current films + their /movie/{uuid}/ links
 *   2. Fetch each movie page to extract showtimes
 *
 * Movie page structure:
 *   div.movie-showings
 *     div.showing-date-group          – one per date
 *       h3                            – date label ("SAT FEB 21")
 *       div.showtimes-list
 *         a.showtime-link             – time text + /checkout/{uuid}/ link
 *         span.showtime-sold-out      – sold-out time (no link)
 *
 * Movie info (first <p>): "Dir. Name, YYYY, XXmin. COUNTRY"
 */

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04',
  may: '05', jun: '06', jul: '07', aug: '08',
  sep: '09', oct: '10', nov: '11', dec: '12',
};

/** Parse "SAT FEB 21" → "2026-02-21" */
function parseLowDate(dateText: string): string | null {
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

/** Normalize "6 PM" or "8:15 PM" → "6:00 PM" or "8:15 PM" */
function normalizeTime(raw: string): string | null {
  const cleaned = raw.replace(/SOLD\s*OUT/i, '').trim();
  const match = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!match) return null;
  const hours = match[1];
  const minutes = match[2] || '00';
  const period = match[3].toUpperCase();
  return `${hours}:${minutes} ${period}`;
}

export async function scrapeLowCinema(): Promise<Showtime[]> {
  try {
    // Step 1: Get list of current films from /tickets/
    const ticketsUrl = 'https://lowcinema.com/tickets/';
    const ticketsRes = await fetch(ticketsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!ticketsRes.ok) {
      console.error(`Low Cinema: HTTP ${ticketsRes.status}`);
      return [];
    }

    const ticketsHtml = await ticketsRes.text();
    const $t = cheerio.load(ticketsHtml);

    // Collect unique movie URLs from .movie-card links
    const movieUrls = new Map<string, string>(); // path → title
    $t('div.movie-card').each((_, el) => {
      const $card = $t(el);
      const title = $card.find('h2 a').text().trim();
      const href = $card.find('h2 a').attr('href');
      if (title && href) {
        movieUrls.set(href, title);
      }
    });

    if (movieUrls.size === 0) {
      console.log('Low Cinema: No films found on /tickets/');
      return [];
    }

    // Step 2: Fetch each movie page in parallel
    const showtimes: Showtime[] = [];

    const movieFetches = Array.from(movieUrls.entries()).map(
      async ([path, fallbackTitle]) => {
        try {
          const movieUrl = `https://lowcinema.com${path}`;
          const res = await fetch(movieUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          if (!res.ok) return;

          const html = await res.text();
          const $ = cheerio.load(html);

          // Film title from movie-info section (not the site header)
          const film =
            $('div.movie-info h1').first().text().trim() ||
            $('div.movie-detail h1').first().text().trim() ||
            fallbackTitle;

          // Movie info: "Dir. Name, YYYY, XXmin. COUNTRY" (in .movie-description)
          const infoText = $('div.movie-description p').first().text().trim();
          const dirMatch = infoText.match(/Dir\.\s*([^,]+)/i);
          const director = dirMatch ? dirMatch[1].trim() : undefined;

          // Image from movie poster
          const imageUrl =
            $('div.movie-poster img').first().attr('src') || undefined;

          // Description: second paragraph in movie-description
          const paragraphs = $('div.movie-description p')
            .map((_, el) => $(el).text().trim())
            .get()
            .filter((t) => t.length > 30 && !t.startsWith('Dir.') && !t.startsWith('All sales'));
          const description = paragraphs.length > 0 ? paragraphs[0] : undefined;

          // Parse showings
          $('div.showing-date-group').each((_, group) => {
            const $group = $(group);
            const dateText = $group.find('h3').text().trim();
            const date = parseLowDate(dateText);
            if (!date) return;

            // Both available and sold-out showtimes
            $group
              .find('.showtimes-list .showtime-link')
              .each((_, timeEl) => {
                const $time = $(timeEl);
                const rawTime = $time.text().trim();
                const time = normalizeTime(rawTime);
                if (!time) return;

                const isSoldOut = $time.hasClass('showtime-sold-out');
                const checkoutHref = $time.attr('href') || '';
                const ticketUrl = isSoldOut
                  ? movieUrl
                  : checkoutHref.startsWith('http')
                    ? checkoutHref
                    : `https://lowcinema.com${checkoutHref}`;

                showtimes.push({
                  id: `lowcinema-${film}-${date}-${time}`
                    .replace(/\s+/g, '-')
                    .replace(/[^a-z0-9\-]/gi, '')
                    .toLowerCase(),
                  film,
                  theater: 'Low Cinema',
                  date,
                  time,
                  ticketUrl,
                  imageUrl,
                  description: director
                    ? `${director}${description ? ' — ' + description : ''}`
                    : description,
                });
              });
          });
        } catch (err) {
          console.error(`Low Cinema: Error fetching movie page ${path}`, err);
        }
      }
    );

    await Promise.all(movieFetches);

    console.log(`Low Cinema: Found ${showtimes.length} showtimes`);
    return showtimes;
  } catch (error) {
    console.error('Low Cinema scraper error:', error);
    return [];
  }
}
