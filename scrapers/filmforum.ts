import { Showtime } from '@/types/showtime';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://filmforum.org';
const NOW_PLAYING_URL = `${BASE_URL}/now_playing`;
const HOMEPAGE_URL = BASE_URL;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

/** 30-day threshold for rolling past dates to next year. */
const PAST_DATE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

/** Number of days in the past before a day-of-week is considered to be next week. */
const PAST_DOW_THRESHOLD_DAYS = -3;

/** Maximum description length to avoid capturing non-description page text. */
const MAX_DESCRIPTION_LENGTH = 2000;

/** Earliest plausible cinema showtime hour (9 AM). */
const CINEMA_OPENING_HOUR = 9;

/** Latest plausible cinema showtime hour (11 PM = 23). */
const CINEMA_CLOSING_HOUR = 23;

/** Day-of-week abbreviations → 0-based index */
const DOW_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

/** Resolve a possibly-relative href to an absolute URL. */
function toAbsoluteUrl(href: string): string {
  return href.startsWith('http') ? href : `${BASE_URL}${href}`;
}

/** Strip query strings, anchors, and trailing slashes to get a canonical URL. */
function toCanonicalUrl(url: string): string {
  return url.split('?')[0].split('#')[0].replace(/\/$/, '');
}

/**
 * Scraper for Film Forum (https://filmforum.org)
 *
 * The Film Forum homepage contains a "Playing This Week" schedule box that
 * lists each day of the week with all films and their actual showtimes.
 * This is the most data-rich source since it contains real times (not just
 * date ranges) and covers the whole current week.
 *
 * Strategy (in priority order):
 *   1. Homepage – parse the "playing this week" day-organized schedule box.
 *   2. /now_playing page – try film blocks (div.film) with embedded times.
 *   3. /now_playing page – follow /film/ or /tickets/ detail URLs for date ranges.
 *
 * If nothing works, log diagnostics (HTML preview, links, class names) so
 * the correct selectors can be identified.
 */
export async function scrapeFilmForum(): Promise<Showtime[]> {
  // ----------------------------------------------------------------
  // ATTEMPT 1: Homepage "playing this week" schedule
  // ----------------------------------------------------------------
  try {
    const homeRes = await fetch(HOMEPAGE_URL, { headers: HEADERS });
    if (homeRes.ok) {
      const homeHtml = await homeRes.text();
      console.log(`Film Forum: Fetched homepage (${homeHtml.length} bytes)`);
      const $home = cheerio.load(homeHtml);
      const homeShowtimes = extractWeekSchedule($home, homeHtml);
      if (homeShowtimes.length > 0) {
        console.log(`Film Forum: Found ${homeShowtimes.length} showtimes (homepage week-schedule strategy)`);
        return homeShowtimes;
      }
      console.log('Film Forum: Homepage week-schedule strategy found 0 showtimes');
    }
  } catch (err) {
    console.error('Film Forum: Homepage fetch failed:', err);
  }

  // ----------------------------------------------------------------
  // ATTEMPT 2 & 3: /now_playing page
  // ----------------------------------------------------------------
  try {
    const response = await fetch(NOW_PLAYING_URL, { headers: HEADERS });
    if (!response.ok) {
      console.error(`Film Forum: HTTP ${response.status} on now_playing`);
      return [];
    }

    const html = await response.text();
    console.log(`Film Forum: Fetched now_playing page (${html.length} bytes)`);
    const $ = cheerio.load(html);

    // Attempt 2: film blocks with embedded showtimes
    const indexShowtimes = extractFromIndexPage($, html);
    if (indexShowtimes.length > 0) {
      console.log(`Film Forum: Found ${indexShowtimes.length} showtimes (index film-block strategy)`);
      return indexShowtimes;
    }

    // Attempt 3: follow film detail URLs
    const filmUrls = collectFilmUrls($);
    console.log(`Film Forum: Found ${filmUrls.size} film URLs for detail scraping`);
    if (filmUrls.size === 0) {
      logDiagnostics($, html);
      return [];
    }

    const detailShowtimes: Showtime[] = [];
    await Promise.all(
      Array.from(filmUrls).map(async (filmUrl) => {
        try {
          const s = await scrapeFilmPage(filmUrl);
          detailShowtimes.push(...s);
        } catch (err) {
          console.error(`Film Forum: Error scraping ${filmUrl}`, err);
        }
      })
    );
    console.log(`Film Forum: Found ${detailShowtimes.length} showtimes (detail-page strategy)`);
    return detailShowtimes;
  } catch (error) {
    console.error('Film Forum scraper error:', error);
    return [];
  }
}

/**
 * Parse the "playing this week" schedule from the Film Forum homepage.
 *
 * The homepage has a weekly schedule organized by day-of-week, e.g.:
 *
 *   FRI
 *   BILLY PRESTON: THAT'S THE WAY GOD PLANNED IT  12:15  2:30  4:45  7:00
 *   CALLE MALAGA                                   12:20  2:50  5:30  8:00
 *
 *   SAT
 *   BILLY PRESTON: THAT'S THE WAY GOD PLANNED IT  11:00  1:15  3:30  5:45  8:00
 *   ...
 *
 * We try multiple selector strategies to find this structure.
 */
function extractWeekSchedule($: cheerio.CheerioAPI, html: string): Showtime[] {
  // Strategy A: look for a container that holds day-labeled sections.
  // Common class patterns: .schedule, .week-schedule, .showtimes-week, .playing-this-week
  const scheduleSel =
    '.schedule, .week-schedule, .showtimes-week, .playing-this-week, ' +
    '#schedule, #showtimes, .now-playing-schedule, .weekly-schedule';

  // Try common schedule container selectors
  if ($(scheduleSel).length) {
    const result = parseDayOrganizedSchedule($, scheduleSel);
    if (result.length > 0) return result;
  }

  // Try to find any element whose direct text contains "playing this week", use its parent
  let containerSel: string | null = null;
  $('*').each((_, el) => {
    if (containerSel) return;
    const text = $(el).clone().children().remove().end().text().toLowerCase();
    if (text.includes('playing this week')) {
      const parentClass = $(el).parent().attr('class');
      if (parentClass) containerSel = `.${parentClass.split(' ')[0]}`;
    }
  });
  if (containerSel) {
    const result = parseDayOrganizedSchedule($, containerSel);
    if (result.length > 0) return result;
  }

  // Strategy B: scan the full body for day-of-week labels followed by film rows
  const result = parseDayOrganizedSchedule($, 'body');
  if (result.length > 0) return result;

  // Strategy C: look for a table-based schedule
  const tableResult = parseScheduleTable($);
  if (tableResult.length > 0) return tableResult;

  return [];
}

/**
 * Scan a container for the day-of-week → film → times pattern.
 *
 * Looks for text that is a day abbreviation (FRI, SAT, etc.) or full day name,
 * then treats subsequent sibling/child elements as film+time rows until the
 * next day label is encountered.
 */
function parseDayOrganizedSchedule(
  $: cheerio.CheerioAPI,
  containerSel: string
): Showtime[] {
  const showtimes: Showtime[] = [];

  // Collect all text-bearing leaf-ish elements in document order
  const elements = $(containerSel).find('*').toArray();

  let currentDate: string | null = null;

  for (const el of elements) {
    const $el = $(el);
    // Get only this element's direct text (not children's text)
    const directText = $el.clone().children().remove().end().text().replace(/\s+/g, ' ').trim();
    if (!directText) continue;

    // Check if this element is a day-of-week label
    const dow = DOW_MAP[directText.toLowerCase()];
    if (dow !== undefined && directText.length <= 10) {
      currentDate = isoDateForDow(dow);
      continue;
    }

    if (!currentDate) continue;

    // Try to read film title + times from this element's text
    // Pattern: "FILM TITLE  12:15  2:30  4:45  7:00"
    const fullText = $el.text().replace(/\s+/g, ' ').trim();
    const times = extractTimesFromText(fullText);
    if (times.length === 0) continue;

    // Film title: text before the first time
    const firstTimeIdx = fullText.search(/\b\d{1,2}:\d{2}/);
    const film = firstTimeIdx > 0
      ? fullText.slice(0, firstTimeIdx).replace(/\s+/g, ' ').trim()
      : '';
    if (!film || film.length < 2) continue;

    // Ticket URL: nearest /tickets/ or /film/ link
    const href =
      $el.find('a[href*="/tickets/"], a[href*="/film/"]').first().attr('href') ||
      $el.closest('a[href*="/tickets/"], a[href*="/film/"]').first().attr('href') ||
      $el.parent().find('a[href*="/tickets/"], a[href*="/film/"]').first().attr('href') ||
      '';
    const ticketUrl = href ? toAbsoluteUrl(href) : HOMEPAGE_URL;

    for (const time of times) {
      const id = `filmforum-${film}-${currentDate}-${time}`.replace(/\s+/g, '-').replace(/[^a-z0-9\-]/gi, '').toLowerCase();
      // Avoid duplicates
      if (!showtimes.some(s => s.id === id)) {
        showtimes.push({ id, film, theater: 'Film Forum', date: currentDate!, time, ticketUrl });
      }
    }
  }

  return showtimes;
}

/** Parse a table-based schedule where rows are (day, film, times). */
function parseScheduleTable($: cheerio.CheerioAPI): Showtime[] {
  const showtimes: Showtime[] = [];

  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td, th');
    if (cells.length < 2) return;

    const firstCell = cells.eq(0).text().trim().toUpperCase();
    const dow = DOW_MAP[firstCell.toLowerCase()];
    const isoDate = dow !== undefined ? isoDateForDow(dow) : null;
    if (!isoDate) return;

    cells.each((i, td) => {
      if (i === 0) return;
      const text = $(td).text().trim();
      const times = extractTimesFromText(text);
      if (times.length === 0) return;

      const firstTimeIdx = text.search(/\b\d{1,2}:\d{2}/);
      const film = firstTimeIdx > 0 ? text.slice(0, firstTimeIdx).trim() : '';
      if (!film) return;

      const href = $(td).find('a').first().attr('href') || '';
      const ticketUrl = href ? toAbsoluteUrl(href) : HOMEPAGE_URL;

      for (const time of times) {
        const id = `filmforum-${film}-${isoDate}-${time}`.replace(/\s+/g, '-').replace(/[^a-z0-9\-]/gi, '').toLowerCase();
        if (!showtimes.some(s => s.id === id)) {
          showtimes.push({ id, film, theater: 'Film Forum', date: isoDate, time, ticketUrl });
        }
      }
    });
  });

  return showtimes;
}

/**
 * Return the ISO date of the next (or current) occurrence of a given day of
 * the week within the current week (Mon–Sun window).
 */
function isoDateForDow(dow: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = dow - today.getDay();
  // Keep within ±3 days of today to stay in the "this week" window
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  // If the day is more than 3 days in the past, it's next week
  if (diff < PAST_DOW_THRESHOLD_DAYS) d.setDate(d.getDate() + 7);
  return formatISO(d);
}

/**
 * Try to extract showtimes directly from the now_playing index page.
 * Film Forum currently wraps each film in a div.film block with embedded showtimes.
 */
function extractFromIndexPage($: cheerio.CheerioAPI, _html: string): Showtime[] {
  const showtimes: Showtime[] = [];
  const today = formatISO(new Date());

  const filmBlockSel = 'div.film, article.film, li.film, .film-listing, .now-playing-item';
  const filmBlocks = $(filmBlockSel);
  console.log(`Film Forum: Found ${filmBlocks.length} film blocks with selector "${filmBlockSel}"`);

  filmBlocks.each((_, block) => {
    const $block = $(block);

    const titleEl = $block.find('h1, h2, h3, h4, .film-title, .title').first().clone();
    titleEl.find('br').replaceWith(' ');
    const film = titleEl.text().replace(/\s+/g, ' ').trim();
    if (!film) return;

    const ticketHref =
      $block.find('a[href*="/tickets/"], a.buy-tickets, a[href*="ticket"]').first().attr('href') ||
      $block.find('a[href*="/film/"]').first().attr('href') ||
      $block.find('a').first().attr('href') || '';
    const ticketUrl = ticketHref ? toAbsoluteUrl(ticketHref) : NOW_PLAYING_URL;

    const imgSrc = $block.find('img').first().attr('src') || $block.find('img').first().attr('data-src');
    const imageUrl = imgSrc ? toAbsoluteUrl(imgSrc) : undefined;

    const showtimeText = $block.find('.showtimes, .showtime, .times, [class*="showtime"]').text().trim();
    const timeMatches = extractTimesFromText(showtimeText);

    for (const time of timeMatches) {
      showtimes.push({
        id: `filmforum-${film}-${today}-${time}`.replace(/\s+/g, '-').replace(/[^a-z0-9\-]/gi, '').toLowerCase(),
        film,
        theater: 'Film Forum',
        date: today,
        time,
        ticketUrl,
        imageUrl,
      });
    }
  });

  return showtimes;
}

/** Collect film detail page URLs from the now_playing page. */
function collectFilmUrls($: cheerio.CheerioAPI): Set<string> {
  const filmUrls = new Set<string>();
  $('a[href*="filmforum.org/film"], a[href*="/film/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href) return;
    const fullUrl = toAbsoluteUrl(href);
    if (fullUrl === `${BASE_URL}/film` || fullUrl === `${BASE_URL}/film/`) return;
    filmUrls.add(toCanonicalUrl(fullUrl));
  });
  if (filmUrls.size === 0) {
    $('a[href*="/tickets/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href) return;
      filmUrls.add(toCanonicalUrl(toAbsoluteUrl(href)));
    });
  }
  return filmUrls;
}

/** Log diagnostic information to help debug selector mismatches. */
function logDiagnostics($: cheerio.CheerioAPI, html: string): void {
  console.log('Film Forum: [DIAGNOSTIC] No films found. HTML preview:');
  console.log(html.slice(0, 500));
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('film') || href.includes('ticket') || href.includes('movie')) links.push(href);
  });
  console.log(`Film Forum: [DIAGNOSTIC] Film-related links (${links.length}):`, links.slice(0, 20));
  const classes = new Set<string>();
  $('[class]').each((_, el) => {
    const cls = $(el).attr('class') || '';
    cls.split(/\s+/).forEach(c => c && classes.add(c));
  });
  console.log('Film Forum: [DIAGNOSTIC] Classes on page:', Array.from(classes).slice(0, 50).join(', '));
}

/**
 * Fetch a single Film Forum film detail page and produce Showtime entries.
 * Used as a fallback when the homepage/index-page strategies don't yield results.
 */
async function scrapeFilmPage(filmUrl: string): Promise<Showtime[]> {
  const response = await fetch(filmUrl, { headers: HEADERS });
  if (!response.ok) return [];

  const html = await response.text();
  const $ = cheerio.load(html);

  const titleSelectors = ['h2.main-title', 'h1.main-title', 'h1.film-title', 'h2.film-title', 'h1', 'h2'];
  let film = '';
  for (const sel of titleSelectors) {
    const el = $(sel).first().clone();
    el.find('br').replaceWith(' ');
    const text = el.text().replace(/\s+/g, ' ').trim();
    if (text) { film = text; break; }
  }
  if (!film) return [];

  let description: string | undefined;
  let maxLen = 0;
  $('div.copy p, .description p, .synopsis p, p').each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > maxLen && t.length < MAX_DESCRIPTION_LENGTH) {
      maxLen = t.length;
      description = t;
    }
  });

  const imgSrc =
    $('img.poster, div.poster img, div.film-image img, .hero img').first().attr('src') ||
    $('img').first().attr('src') || undefined;
  const imageUrl = imgSrc ? toAbsoluteUrl(imgSrc) : undefined;

  const ticketHref = $('a[href*="/tickets/"], a.btn-tickets, a[href*="ticket"]').first().attr('href');
  const ticketUrl = ticketHref ? toAbsoluteUrl(ticketHref) : filmUrl;

  const dateText =
    $('h2.main-title + div.details p, h1.main-title + div.details p').first().text().trim() ||
    $('div.details p, .run-dates, .dates, .schedule-dates').first().text().trim();

  const dates = parseDateRange(dateText);
  if (dates.length === 0) return [];

  return dates.map((date) => ({
    id: `filmforum-${film}-${date}`.replace(/\s+/g, '-').replace(/[^a-z0-9\-]/gi, '').toLowerCase(),
    film,
    theater: 'Film Forum',
    date,
    time: 'See Times',
    ticketUrl,
    imageUrl,
    description,
  }));
}

/** Convert a 24-hour value to a 12-hour display string with AM/PM period. */
function convertTo12Hour(h24: number, min: string): string {
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${min} ${period}`;
}

/**
 * Extract time strings from raw text.
 * Handles "1:15 PM", "2:30 pm", "13:15", "12:15 2:30 4:45 7:00" (bare times without AM/PM).
 */
function extractTimesFromText(text: string): string[] {
  const times: string[] = [];
  // Match 12-hour with AM/PM first
  const re12 = /\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re12.exec(text)) !== null) {
    times.push(`${m[1]}:${m[2]} ${m[3].toUpperCase()}`);
  }
  if (times.length > 0) return times;

  // Bare HH:MM (no AM/PM) — convert to 12-hour assuming cinema hours (9am–midnight)
  const reBare = /\b(\d{1,2}):(\d{2})\b/g;
  while ((m = reBare.exec(text)) !== null) {
    const h = parseInt(m[1], 10);
    const min = m[2];
    if (h < CINEMA_OPENING_HOUR || h > CINEMA_CLOSING_HOUR) continue; // skip implausible hours
    times.push(convertTo12Hour(h, min));
  }
  return times;
}

function parseDateRange(text: string): string[] {
  if (!text) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const extractedDates = extractDatesFromText(text);
  if (extractedDates.length === 0) {
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
      if (d >= today) return [formatISO(d)];
      return [formatISO(today)];
    }
    return fillDateRange(today, d);
  }
  const [start, end] = extractedDates;
  return fillDateRange(start >= today ? start : today, end);
}

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
    if (!yearStr && candidate.getTime() < now.getTime() - PAST_DATE_THRESHOLD_MS) year += 1;
    found.push(new Date(year, monthIdx, day));
    if (found.length === 2) break;
  }
  return found;
}

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

function nextOccurrenceOfDay(dayName: string): Date | null {
  const target = DOW_MAP[dayName.toLowerCase()];
  if (target === undefined) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  let daysAhead = target - d.getDay();
  if (daysAhead < 0) daysAhead += 7;
  d.setDate(d.getDate() + daysAhead);
  return d;
}

function formatISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
