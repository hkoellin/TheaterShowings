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

/**
 * 30-day threshold for rolling past dates to next year.
 */
const PAST_DATE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

/** Resolve a possibly-relative href to an absolute URL. */
function toAbsoluteUrl(href: string): string {
  return href.startsWith('http') ? href : `${BASE_URL}${href}`;
}

/** Strip query strings, anchors, and trailing slashes to get a canonical URL. */
function toCanonicalUrl(url: string): string {
  return url.split('?')[0].split('#')[0].replace(/\/$/, '');
}

/**
 * Scraper for Film Forum (https://filmforum.org/now_playing)
 *
 * Real site structure (verified from HTML inspection):
 *
 * now_playing page:
 *   a[href*="filmforum.org/film"]  – links to individual film detail pages
 *
 * Film detail page (e.g. https://filmforum.org/film/some-film):
 *   h2.main-title                 – film title
 *   h2.main-title + div.details p – date information text (e.g. "Feb 21 – Mar 5")
 *   div.copy p                    – description paragraphs (longest chosen)
 *   a[href*="filmforum.org/tickets"] or a.btn-tickets – ticket purchase link
 *
 * Film Forum does not embed individual daily showtimes in the page HTML;
 * each film runs across a date range with "See Times" linking to the film page.
 */
export async function scrapeFilmForum(): Promise<Showtime[]> {
  try {
    const response = await fetch(NOW_PLAYING_URL, { headers: HEADERS });

    if (!response.ok) {
      console.error(`Film Forum: HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Collect unique film detail page URLs from the now_playing page.
    // Film detail links match href containing "filmforum.org/film" or "/film/".
    const filmUrls = new Set<string>();

    $('a[href*="filmforum.org/film"], a[href*="/film/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href) return;
      const fullUrl = toAbsoluteUrl(href);
      // Exclude the /film/ listing page itself or anchor-only fragments
      if (fullUrl === `${BASE_URL}/film` || fullUrl === `${BASE_URL}/film/`) return;
      const canonical = toCanonicalUrl(fullUrl);
      filmUrls.add(canonical);
    });

    if (filmUrls.size === 0) {
      console.log('Film Forum: No film links found on now_playing page');
      return [];
    }

    // Fetch each film detail page concurrently
    const showtimes: Showtime[] = [];
    await Promise.all(
      Array.from(filmUrls).map(async (filmUrl) => {
        try {
          const filmShowtimes = await scrapeFilmPage(filmUrl);
          showtimes.push(...filmShowtimes);
        } catch (err) {
          console.error(`Film Forum: Error scraping film page ${filmUrl}`, err);
        }
      })
    );

    console.log(`Film Forum: Found ${showtimes.length} showtimes`);
    return showtimes;
  } catch (error) {
    console.error('Film Forum scraper error:', error);
    return [];
  }
}

/**
 * Fetch a single Film Forum film detail page and produce Showtime entries.
 *
 * Film detail page HTML:
 *   <h2 class="main-title">FILM TITLE</h2>
 *   <div class="details">
 *     <p>Feb 21 – Mar 5, 2026</p>     ← date range or single date text
 *   </div>
 *   <div class="copy">
 *     <p>...</p>                       ← description paragraphs
 *   </div>
 *
 * Since Film Forum does not expose per-showing times in the HTML, we create
 * one "See Times" entry per day in the film's run (today through closing date).
 */
async function scrapeFilmPage(filmUrl: string): Promise<Showtime[]> {
  const response = await fetch(filmUrl, { headers: HEADERS });
  if (!response.ok) return [];

  const html = await response.text();
  const $ = cheerio.load(html);

  // Film title from h2.main-title
  // Replace <br> elements with spaces via Cheerio DOM, then use .text() to avoid HTML injection
  const titleEl = $('h2.main-title').first().clone();
  titleEl.find('br').replaceWith(' ');
  const film = titleEl.text().replace(/\s+/g, ' ').trim();
  if (!film) return [];

  // Description: longest <p> inside div.copy
  let description: string | undefined;
  let maxLen = 0;
  $('div.copy p').each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > maxLen) {
      maxLen = t.length;
      description = t;
    }
  });

  // Image URL
  const imgSrc = $('img.poster, div.poster img, div.film-image img, .hero img').first().attr('src') ||
    $('img').first().attr('src') || undefined;
  const imageUrl = imgSrc ? toAbsoluteUrl(imgSrc) : undefined;

  // Ticket URL: prefer explicit ticket link, else the film page itself
  const ticketHref = $('a[href*="filmforum.org/tickets"], a.btn-tickets, a[href*="ticket"]').first().attr('href');
  const ticketUrl = ticketHref ? toAbsoluteUrl(ticketHref) : filmUrl;

  // Date range text from the div.details following h2.main-title
  const dateText = $('h2.main-title + div.details p').first().text().trim() ||
    $('div.details p').first().text().trim();

  const dates = parseDateRange(dateText);
  if (dates.length === 0) return [];

  return dates.map((date) => ({
    id: `filmforum-${film}-${date}`
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/gi, '')
      .toLowerCase(),
    film,
    theater: 'Film Forum',
    date,
    time: 'See Times',
    ticketUrl,
    imageUrl,
    description,
  }));
}

/**
 * Parse Film Forum date text into an array of ISO date strings (YYYY-MM-DD).
 *
 * Handles formats like:
 *   "Tuesday, February 21"                         – single date
 *   "Friday, February 21 – Wednesday, March 5"    – date range  
 *   "Wednesday, November 1 - Tuesday, November 14" – date range with hyphen
 *   "Feb 21 – Mar 5, 2026"                        – abbreviated range
 *   "HELD OVER! MUST END THURSDAY!"               – closing day-of-week only
 *   "Opens Friday, February 21"                   – opening date
 */
function parseDateRange(text: string): string[] {
  if (!text) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Try to find one or two calendar dates in the text
  const extractedDates = extractDatesFromText(text);

  if (extractedDates.length === 0) {
    // Try "MUST END DAY_OF_WEEK" or "ENDS DAY_OF_WEEK"
    const dowMatch = text.match(
      /(?:must\s+end|ends?|through|thru)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
    );
    if (dowMatch) {
      const closing = nextOccurrenceOfDay(dowMatch[1]);
      if (closing) return fillDateRange(today, closing);
    }
    return [];
  }

  if (extractedDates.length === 1) {
    const d = extractedDates[0];
    if (text.match(/open(?:s|ing)/i)) {
      // Opening date – just return that one day if it's today or future;
      // if the film already opened, show from today (film is still running)
      if (d >= today) return [formatISO(d)];
      return [formatISO(today)];
    }
    // Single run date
    return fillDateRange(today, d);
  }

  // Two dates → range
  const [start, end] = extractedDates;
  const rangeStart = start >= today ? start : today;
  return fillDateRange(rangeStart, end);
}

/**
 * Extract up to two Date objects from a free-form date string.
 * Handles "February 21", "Feb 21", "February 21, 2026", day-of-week prefixes, etc.
 */
function extractDatesFromText(text: string): Date[] {
  const months: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  const pattern =
    /(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:,?\s*(\d{4}))?/gi;

  const found: Date[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const monthStr = match[0].split(/\s+/)[0].toLowerCase();
    const monthIdx = months[monthStr];
    if (monthIdx === undefined) continue;

    const day = parseInt(match[1], 10);
    const yearStr = match[2];
    const now = new Date();
    let year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

    const candidate = new Date(year, monthIdx, day);
    // Roll to next year if the date is more than 30 days in the past
    if (!yearStr && candidate.getTime() < now.getTime() - PAST_DATE_THRESHOLD_MS) {
      year += 1;
    }

    found.push(new Date(year, monthIdx, day));
    if (found.length === 2) break;
  }

  return found;
}

/** Fill in every calendar date from start through end (inclusive), capped at 2 weeks out. */
function fillDateRange(start: Date, end: Date): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoWeeksOut = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

  const effectiveEnd = end > twoWeeksOut ? twoWeeksOut : end;
  const dates: string[] = [];
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);

  while (d <= effectiveEnd) {
    dates.push(formatISO(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

/** Return the next occurrence of a named day of the week, including today if it matches. */
function nextOccurrenceOfDay(dayName: string): Date | null {
  const days: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };
  const target = days[dayName.toLowerCase()];
  if (target === undefined) return null;

  const d = new Date();
  d.setHours(0, 0, 0, 0);
  let daysAhead = target - d.getDay();
  if (daysAhead < 0) daysAhead += 7;
  // daysAhead === 0 means today matches; include today as the closing day
  d.setDate(d.getDate() + daysAhead);
  return d;
}

/** Format a Date as YYYY-MM-DD. */
function formatISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
