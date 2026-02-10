import { Showtime } from '@/types/showtime';
import * as cheerio from 'cheerio';

/**
 * Scraper for Low Cinema (https://lowcinema.com/calendar)
 * 
 * This scraper fetches the Low Cinema calendar page and extracts:
 * - Film titles from calendar events
 * - Showtimes and dates
 * - Ticket purchase links
 * - Film images if available
 * 
 * Note: Low Cinema may use a calendar widget. Selectors may need updates.
 */
export async function scrapeLowCinema(): Promise<Showtime[]> {
  try {
    const url = 'https://lowcinema.com/calendar';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`Low Cinema: HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const showtimes: Showtime[] = [];

    // Low Cinema likely uses a calendar or event listing
    $('.event, .calendar-event, .screening, article').each((_, element) => {
      try {
        const $el = $(element);
        
        // Extract film title
        const film = $el.find('h2, h3, .title, .event-title, .film-title').first().text().trim();
        if (!film) return;

        // Extract image
        const imageUrl = $el.find('img').first().attr('src') || 
                        $el.find('img').first().attr('data-src');

        // Extract description
        const description = $el.find('p, .description').first().text().trim();

        // Extract date and time info
        const dateTimeText = $el.find('.date, .time, time, .datetime').text().trim();
        const ticketLink = $el.find('a[href*="ticket"], a[href*="event"], a').first();
        const ticketUrl = ticketLink.attr('href') || url;

        // Parse date and time
        const dateMatch = dateTimeText.match(/(\d{1,2})\/(\d{1,2})/);
        const timeMatch = dateTimeText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);

        if (timeMatch) {
          const today = new Date();
          const date = dateMatch 
            ? `${today.getFullYear()}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`
            : today.toISOString().split('T')[0];
          
          const time = `${timeMatch[1]}:${timeMatch[2]} ${timeMatch[3].toUpperCase()}`;

          showtimes.push({
            id: `lowcinema-${film}-${date}-${time}`.replace(/\s/g, '-').toLowerCase(),
            film,
            theater: 'Low Cinema',
            date,
            time,
            ticketUrl: ticketUrl.startsWith('http') ? ticketUrl : `https://lowcinema.com${ticketUrl}`,
            imageUrl,
            description
          });
        }
      } catch (err) {
        console.error('Low Cinema: Error parsing event', err);
      }
    });

    return showtimes;
  } catch (error) {
    console.error('Low Cinema scraper error:', error);
    return [];
  }
}
