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

        // Extract showtimes
        $el.find('.showtime, .time, time, a[href*="ticket"], a[href*="show"]').each((_, timeEl) => {
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
              id: `filmforum-${film}-${date}-${time}`.replace(/\s/g, '-').toLowerCase(),
              film,
              theater: 'Film Forum',
              date,
              time,
              ticketUrl: ticketUrl.startsWith('http') ? ticketUrl : `https://filmforum.org${ticketUrl}`,
              imageUrl,
              description
            });
          }
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
