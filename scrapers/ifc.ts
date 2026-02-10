import { Showtime } from '@/types/showtime';
import * as cheerio from 'cheerio';

/**
 * Scraper for IFC Center (https://www.ifccenter.com)
 * 
 * This scraper fetches the IFC Center showtimes and extracts:
 * - Film titles from movie listings
 * - Showtimes for each film
 * - Ticket purchase links
 * - Film posters and descriptions
 * 
 * Note: IFC Center's structure may change. Monitor and update selectors as needed.
 */
export async function scrapeIFC(): Promise<Showtime[]> {
  try {
    const url = 'https://www.ifccenter.com';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`IFC Center: HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const showtimes: Showtime[] = [];

    // IFC typically has a grid of current films with showtime buttons
    $('.film, .movie, .showing, article').each((_, element) => {
      try {
        const $el = $(element);
        
        // Extract film title
        const film = $el.find('h2, h3, .title, .film-title, .movie-title').first().text().trim();
        if (!film) return;

        // Extract image
        const imageUrl = $el.find('img').first().attr('src') || 
                        $el.find('img').first().attr('data-src');

        // Extract description
        const description = $el.find('p, .description, .synopsis').first().text().trim();

        // Extract showtimes - IFC often has time buttons
        $el.find('.showtime, .time-button, time, button, a[href*="ticket"]').each((_, timeEl) => {
          const $time = $(timeEl);
          const timeText = $time.text().trim();
          const ticketUrl = $time.attr('href') || $time.closest('a').attr('href') || url;

          // Parse date and time
          const dateMatch = timeText.match(/(\d{1,2})\/(\d{1,2})/);
          const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);

          if (timeMatch) {
            const today = new Date();
            const date = dateMatch 
              ? `${today.getFullYear()}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`
              : today.toISOString().split('T')[0];
            
            const time = `${timeMatch[1]}:${timeMatch[2]} ${timeMatch[3].toUpperCase()}`;

            showtimes.push({
              id: `ifc-${film}-${date}-${time}`.replace(/\s/g, '-').toLowerCase(),
              film,
              theater: 'IFC Center',
              date,
              time,
              ticketUrl: ticketUrl.startsWith('http') ? ticketUrl : `https://www.ifccenter.com${ticketUrl}`,
              imageUrl,
              description
            });
          }
        });
      } catch (err) {
        console.error('IFC: Error parsing film', err);
      }
    });

    return showtimes;
  } catch (error) {
    console.error('IFC scraper error:', error);
    return [];
  }
}
