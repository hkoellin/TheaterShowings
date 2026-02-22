import { Showtime } from '@/types/showtime';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://filmforum.org';
const NOW_PLAYING_URL = `${BASE_URL}/now_playing`;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

/** Day-of-week names to JS Date day index (0=Sun). */
const DOW_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/**
 * Scraper for Film Forum (https://filmforum.org)
 *
 * Film Forum's now_playing page (and every film detail page) includes a
 * sidebar with the "Playing This Week" schedule box structured as:
 *
 *   <div class="module showtimes-table">
 *     <div id="tabs">
 *       <ul>
 *         <li class=sat><a href="#tabs-0">SAT</a></li>
 *         <li class=sun><a href="#tabs-1">SUN</a></li>
 *         ...
 *       </ul>
 *       <div class="showtimes-container">
 *         <div id="tabs-0">
 *           <!-- 21 -->                          ← day-of-month number
 *           <p>
 *             <strong><a href="/film/...">FILM TITLE</a></strong><br />
 *             <span>12:15</span> <span>2:30</span> <span>4:45</span>
 *           </p>
 *           ...
 *         </div>
 *         ...
 *       </div>
 *     </div>
 *   </div>
 *
 * This gives us exact showtimes for every film for each day of the current week.
 */
export async function scrapeFilmForum(): Promise<Showtime[]> {
  try {
    const response = await fetch(NOW_PLAYING_URL, { headers: HEADERS });
    if (!response.ok) {
      console.error(`Film Forum: HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    console.log(`Film Forum: Fetched now_playing page (${html.length} bytes)`);
    const $ = cheerio.load(html);

    // ----------------------------------------------------------------
    // Step 1: Build ordered list of day-of-week from tab headers
    // Tab list: <li class=sat><a href="#tabs-0">SAT</a></li> ...
    // ----------------------------------------------------------------
    const tabDays: { tabId: string; dow: number }[] = [];
    $('#tabs > ul > li').each((_, li) => {
      const $li = $(li);
      const href = $li.find('a').attr('href') || '';
      const tabId = href.replace('#', ''); // e.g., "tabs-0"
      // The class on the <li> is the day abbreviation (e.g., "sat")
      const classAttr = $li.attr('class') || '';
      const dowKey = classAttr.trim().toLowerCase();
      const dow = DOW_MAP[dowKey];
      if (dow !== undefined && tabId) {
        tabDays.push({ tabId, dow });
      }
    });

    if (tabDays.length === 0) {
      console.error('Film Forum: Could not find tab day-of-week headers');
      logDiagnostics($, html);
      return [];
    }

    console.log(`Film Forum: Found ${tabDays.length} day tabs: ${tabDays.map(t => t.tabId).join(', ')}`);

    // ----------------------------------------------------------------
    // Step 2: For each tab, resolve the actual calendar date
    // Each tab div has an HTML comment like <!-- 21 --> with the day number
    // ----------------------------------------------------------------
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Collect film detail URLs → OG image map for enrichment later
    const filmImageCache = new Map<string, string>();

    const showtimes: Showtime[] = [];

    for (const { tabId, dow } of tabDays) {
      const $tab = $(`#${tabId}`);
      if (!$tab.length) continue;

      // Extract day-of-month from HTML comment (e.g., <!-- 21 -->)
      const tabHtml = $tab.html() || '';
      const commentMatch = tabHtml.match(/<!--\s*(\d{1,2})\s*-->/);
      let isoDate: string;
      if (commentMatch) {
        const dayOfMonth = parseInt(commentMatch[1], 10);
        isoDate = resolveDate(dow, dayOfMonth, today);
      } else {
        // Fallback: compute date from day-of-week relative to today
        isoDate = isoDateForDow(dow, today);
      }

      // ----------------------------------------------------------------
      // Step 3: Parse film entries within this tab
      // Each <p> has: <strong><a href="/film/...">TITLE</a></strong><br /><span>TIME</span>...
      // Some also have a series link before the film title
      // ----------------------------------------------------------------
      $tab.find('p').each((_, p) => {
        const $p = $(p);

        // Film title: the <strong><a> text (last <strong> if there's a series prefix)
        const $titleLink = $p.find('strong > a[href*="/film/"]').last();
        if (!$titleLink.length) return;

        // Clean up film title (remove <br> artifacts)
        const rawFilm = $titleLink.text().replace(/\s+/g, ' ').trim();
        if (!rawFilm) return;

        // Check for director prefix (e.g., "Giuseppe De Santis' BITTER RICE")
        // The <strong> may contain text before the <a>
        const $strong = $titleLink.closest('strong');
        const strongText = $strong.text().replace(/\s+/g, ' ').trim();
        const film = strongText.length > rawFilm.length ? strongText : rawFilm;

        // Film detail URL
        const filmHref = $titleLink.attr('href') || '';
        const filmUrl = filmHref.startsWith('http') ? filmHref : `${BASE_URL}${filmHref}`;

        // Ticket URL: use my.filmforum.org/events/ pattern if available
        const filmSlug = filmHref.split('/').pop() || '';
        const ticketUrl = `https://my.filmforum.org/events/${filmSlug}`;

        // Series name (optional)
        const seriesLink = $p.find('a[href*="/series/"]').first();
        const series = seriesLink.length ? seriesLink.text().trim() : undefined;

        // Extract showtimes from <span> elements
        const times: string[] = [];
        $p.find('span').each((_, span) => {
          const timeText = $(span).text().trim();
          const parsed = parseTime(timeText);
          if (parsed) times.push(parsed);
        });

        if (times.length === 0) return;

        // Create a showtime entry for each time
        for (const time of times) {
          const displayFilm = series ? `${film} (${series})` : film;
          const id = `filmforum-${film}-${isoDate}-${time}`
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/gi, '')
            .toLowerCase();

          if (!showtimes.some(s => s.id === id)) {
            showtimes.push({
              id,
              film: displayFilm,
              theater: 'Film Forum',
              date: isoDate,
              time,
              ticketUrl,
              imageUrl: undefined, // Will try to enrich below
              description: undefined,
            });
          }
        }

        // Track film URL for image enrichment
        if (filmUrl && !filmImageCache.has(filmUrl)) {
          filmImageCache.set(filmUrl, '');
        }
      });
    }

    console.log(`Film Forum: Found ${showtimes.length} showtimes from week schedule`);

    // ----------------------------------------------------------------
    // Step 4 (optional): Enrich with OG images from film detail pages
    // We fetch a small batch of film pages in parallel for images
    // ----------------------------------------------------------------
    if (showtimes.length > 0) {
      const uniqueFilmUrls = Array.from(filmImageCache.keys()).slice(0, 10);
      const imageResults = await Promise.allSettled(
        uniqueFilmUrls.map(async (url) => {
          try {
            const res = await fetch(url, { headers: HEADERS });
            if (!res.ok) return { url, imageUrl: '' };
            const detailHtml = await res.text();
            const $detail = cheerio.load(detailHtml);
            const ogImage = $detail('meta[property="og:image"]').attr('content') || '';
            const imageUrl = ogImage.startsWith('http') ? ogImage : ogImage ? `${BASE_URL}${ogImage}` : '';
            // Also grab description from .copy p
            const description = $detail('.copy > p').first().text().trim().slice(0, 300);
            return { url, imageUrl, description };
          } catch {
            return { url, imageUrl: '', description: '' };
          }
        })
      );

      // Build lookup maps
      const imageMap = new Map<string, string>();
      const descMap = new Map<string, string>();
      for (const result of imageResults) {
        if (result.status === 'fulfilled') {
          const { url, imageUrl, description } = result.value;
          if (imageUrl) imageMap.set(url, imageUrl);
          if (description) descMap.set(url, description);
        }
      }

      // Apply images and descriptions to showtimes
      for (const s of showtimes) {
        // Find the matching film URL
        for (const [url, img] of imageMap) {
          const slug = url.split('/').pop() || '';
          if (s.id.includes(slug.replace(/-/g, ''))) {
            s.imageUrl = img;
            const desc = descMap.get(url);
            if (desc) s.description = desc;
            break;
          }
        }
      }
    }

    return showtimes;
  } catch (error) {
    console.error('Film Forum scraper error:', error);
    return [];
  }
}

/**
 * Resolve a calendar date from day-of-week + day-of-month, using today as anchor.
 *
 * Film Forum's schedule runs Fri–Thu (or Sat–Fri). We find the date that matches
 * both the given day-of-week and day-of-month within ±7 days of today.
 */
function resolveDate(dow: number, dayOfMonth: number, today: Date): string {
  // Try offsets from -6 to +7 days from today
  for (let offset = -6; offset <= 7; offset++) {
    const candidate = new Date(today);
    candidate.setDate(today.getDate() + offset);
    if (candidate.getDay() === dow && candidate.getDate() === dayOfMonth) {
      return formatISO(candidate);
    }
  }
  // Fallback: just use day-of-week relative to today
  return isoDateForDow(dow, today);
}

/**
 * Return the ISO date of the nearest occurrence of a given day-of-week,
 * within ±3 days of today (the current week window).
 */
function isoDateForDow(dow: number, today: Date): string {
  const diff = dow - today.getDay();
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  if (diff < -3) d.setDate(d.getDate() + 7);
  return formatISO(d);
}

/**
 * Parse a bare time string like "12:15" or "2:30" into 12-hour format.
 * Film Forum uses bare hours without AM/PM — we assume cinema hours (before 12 = PM matinee if ≥ 1, else AM).
 */
function parseTime(text: string): string | null {
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const min = match[2];
  if (h < 0 || h > 23) return null;

  // Film Forum bare times: 9-11 = AM, 12+ = PM, 1-8 = PM (afternoon/evening)
  let period: string;
  let h12: number;
  if (h >= 12) {
    period = 'PM';
    h12 = h > 12 ? h - 12 : 12;
  } else if (h >= 9) {
    period = 'AM';
    h12 = h;
  } else {
    // 1:00–8:59 → PM (matinee/evening)
    period = 'PM';
    h12 = h;
  }
  return `${h12}:${min} ${period}`;
}

function formatISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Log diagnostic information if parsing fails. */
function logDiagnostics($: cheerio.CheerioAPI, html: string): void {
  console.log('Film Forum: [DIAGNOSTIC] HTML preview (first 500 chars):');
  console.log(html.slice(0, 500));
  const tabLinks: string[] = [];
  $('#tabs a').each((_, el) => {
    tabLinks.push($(el).text().trim());
  });
  console.log(`Film Forum: [DIAGNOSTIC] Tab links found: ${tabLinks.join(', ') || 'none'}`);
  const classes = new Set<string>();
  $('[class]').each((_, el) => {
    const cls = $(el).attr('class') || '';
    cls.split(/\s+/).forEach(c => {
      if (c.includes('showtime') || c.includes('schedule') || c.includes('tabs') || c.includes('film')) {
        classes.add(c);
      }
    });
  });
  console.log('Film Forum: [DIAGNOSTIC] Relevant classes:', Array.from(classes).join(', '));
}
