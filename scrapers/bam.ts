import { Showtime } from '@/types/showtime';
import * as cheerio from 'cheerio';

/**
 * Scraper for BAM Rose Cinemas (https://www.bam.org/film)
 * 
 * This scraper fetches the BAM film page and extracts:
 * - Film titles
 * - Showtimes and dates
 * - Ticket purchase links
 * - Film images and descriptions
 * 
 * Note: BAM's website structure may change. Update selectors accordingly.
 */
export async function scrapeBAM(): Promise<Showtime[]> {
  try {
    const url = 'https://www.bam.org/film';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`BAM: HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const showtimes: Showtime[] = [];

    // BAM typically has event listings with film information
    $('.event, .film-listing, article, .card').each((_, element) => {
      try {
        const $el = $(element);
        
        // Extract film title
        const film = $el.find('h2, h3, .title, .event-title').first().text().trim();
        if (!film) return;

        // Extract image
        const imageUrl = $el.find('img').first().attr('src') || 
                        $el.find('img').first().attr('data-src');

        // Extract description
        const description = $el.find('p, .description, .event-description').first().text().trim();

        // Extract showtimes
        $el.find('.showtime, .time, time, .date-time, a[href*="ticket"]').each((_, timeEl) => {
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
              id: `bam-${film}-${date}-${time}`.replace(/\s/g, '-').toLowerCase(),
              film,
              theater: 'BAM Rose Cinemas',
              date,
              time,
              ticketUrl: ticketUrl.startsWith('http') ? ticketUrl : `https://www.bam.org${ticketUrl}`,
              imageUrl,
              description
            });
          }
        });
      } catch (err) {
        console.error('BAM: Error parsing event', err);
      }
    });

    return showtimes;
  } catch (error) {
    console.error('BAM scraper error:', error);
    return [];
  }
}
