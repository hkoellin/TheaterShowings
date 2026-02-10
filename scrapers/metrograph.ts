import { Showtime } from '@/types/showtime';
import * as cheerio from 'cheerio';

/**
 * Scraper for Metrograph (https://metrograph.com/now-showing)
 * 
 * This scraper fetches the Metrograph showtimes page and extracts:
 * - Film titles from the movie cards
 * - Showtimes from the time slots
 * - Ticket URLs for each showing
 * - Film images and descriptions if available
 * 
 * Note: The scraper targets specific CSS selectors and may break if Metrograph
 * redesigns their website. Update the selectors as needed.
 */
export async function scrapeMetrograph(): Promise<Showtime[]> {
  try {
    const url = 'https://metrograph.com/now-showing';
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

    // Metrograph typically has a grid of film cards with showtimes
    // This is a generic approach - actual selectors may need adjustment
    $('.film-card, .movie-card, article').each((_, element) => {
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
        $el.find('.showtime, .time, time, a[href*="ticket"]').each((_, timeEl) => {
          const $time = $(timeEl);
          const timeText = $time.text().trim();
          const ticketUrl = $time.attr('href') || $time.closest('a').attr('href') || url;

          // Try to parse date and time
          // Format may vary - this is a flexible approach
          const dateMatch = timeText.match(/(\d{1,2})\/(\d{1,2})/);
          const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);

          if (timeMatch) {
            const today = new Date();
            const date = dateMatch 
              ? `${today.getFullYear()}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`
              : today.toISOString().split('T')[0];
            
            const time = `${timeMatch[1]}:${timeMatch[2]} ${timeMatch[3].toUpperCase()}`;

            showtimes.push({
              id: `metrograph-${film}-${date}-${time}`.replace(/\s/g, '-').toLowerCase(),
              film,
              theater: 'Metrograph',
              date,
              time,
              ticketUrl: ticketUrl.startsWith('http') ? ticketUrl : `https://metrograph.com${ticketUrl}`,
              imageUrl,
              description
            });
          }
        });
      } catch (err) {
        console.error('Metrograph: Error parsing film card', err);
      }
    });

    return showtimes;
  } catch (error) {
    console.error('Metrograph scraper error:', error);
    return [];
  }
}
