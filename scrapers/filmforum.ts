import { Showtime } from '@/types/showtime';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://filmforum.org';
const NOW_PLAYING_URL = `${BASE_URL}/now_playing`;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** 30-day threshold for rolling past dates to next year */
const PAST_DATE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Scraper for Film Forum (https://filmforum.org/now_playing)
 *
 * Strategy:
 *   1. Fetch /now_playing to get the list of currently playing films and their
 *      detail-page links (each film's page has the actual daily showtimes).
 *   2. Fetch each film detail page concurrently to extract per-day showtimes.
 *
 * Film Forum now-playing page structure:
 *   div.film (or li.film-listing, article, etc.)  – one per film
 *     h1/h2/h3 > a                                 – title + detail link
 *     img                                           – poster
 *     a[href*="/film/"]                             – detail page link fallback
 *
 * Film detail page showtime structure:
 *   div.showtimes, table.showtimes, ul.showtimes, etc.
 *     Each date group contains:
 *       date label (e.g. "FRI FEB 21" or "Feb 21")
 *       time links  (e.g. "1:15 PM", "4:45 PM")
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

    // Collect film entries: (title, detailUrl, imageUrl)
    const filmEntries: { film: string; detailUrl: string; imageUrl?: string }[] = [];

    // Try multiple container selectors to find film blocks
    const filmContainerSel =
      '.film, .film-listing, .now-playing-film, .now-playing-item, ' +
      'li.film, article.film, div[class*="film"], div[class*="movie"]';

    $(filmContainerSel).each((_, el) => {
      const $el = $(el);

      // Title: prefer heading > a, fallback to heading text
      const titleLink = $el.find('h1 a, h2 a, h3 a, h4 a, .film-title a, .title a').first();
      const titleHeading = $el.find('h1, h2, h3, h4, .film-title, .title').first();
      const film =
        (titleLink.text().trim() || titleHeading.text().trim()).replace(/\s+/g, ' ');
      if (!film) return;

      // Detail page link
      const hrefRaw =
        titleLink.attr('href') ||
        $el.find('a[href*="/film/"]').first().attr('href') ||
        $el.find('a').first().attr('href') ||
        '';
      if (!hrefRaw) return;

      const detailUrl = hrefRaw.startsWith('http')
        ? hrefRaw
        : `${BASE_URL}${hrefRaw}`;

      // Poster image
      const imgSrc =
        $el.find('img').first().attr('src') ||
        $el.find('img').first().attr('data-src') ||
        undefined;
      const imageUrl = imgSrc
        ? imgSrc.startsWith('http')
          ? imgSrc
          : `${BASE_URL}${imgSrc}`
        : undefined;

      // Avoid duplicates
      if (!filmEntries.some((e) => e.detailUrl === detailUrl)) {
        filmEntries.push({ film, detailUrl, imageUrl });
      }
    });

    // If the film-block approach found nothing, try heading-level scan
    if (filmEntries.length === 0) {
      $('h1 a[href*="/film/"], h2 a[href*="/film/"], h3 a[href*="/film/"]').each((_, el) => {
        const $a = $(el);
        const film = $a.text().trim().replace(/\s+/g, ' ');
        const hrefRaw = $a.attr('href') || '';
        if (!film || !hrefRaw) return;
        const detailUrl = hrefRaw.startsWith('http') ? hrefRaw : `${BASE_URL}${hrefRaw}`;
        if (!filmEntries.some((e) => e.detailUrl === detailUrl)) {
          filmEntries.push({ film, detailUrl });
        }
      });
    }

    if (filmEntries.length === 0) {
      console.log('Film Forum: No film entries found on now_playing page');
      return [];
    }

    // Fetch each film detail page and extract showtimes
    const showtimes: Showtime[] = [];
    await Promise.all(
      filmEntries.map(async ({ film, detailUrl, imageUrl }) => {
        try {
          const filmShowtimes = await scrapeFilmPage(film, detailUrl, imageUrl);
          showtimes.push(...filmShowtimes);
        } catch (err) {
          console.error(`Film Forum: Error scraping film page ${detailUrl}`, err);
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
 * Fetch a single Film Forum film page and extract its showtimes.
 *
 * Film detail pages have a schedule section that groups showtimes by date.
 * Common patterns observed:
 *   - table rows: <tr><td class="date">FRI FEB 21</td><td class="times"><a>1:15 PM</a>…</td></tr>
 *   - div groups: <div class="showtime-date"><span>FRI FEB 21</span>…<a>1:15 PM</a></div>
 *   - list items:  <ul class="showtimes"><li><span class="date">…</span><a>1:15 PM</a></li></ul>
 */
async function scrapeFilmPage(
  film: string,
  detailUrl: string,
  imageUrl?: string
): Promise<Showtime[]> {
  const response = await fetch(detailUrl, { headers: HEADERS });
  if (!response.ok) return [];

  const html = await response.text();
  const $ = cheerio.load(html);
  const showtimes: Showtime[] = [];

  // Description
  const description =
    $('p.synopsis, .film-description p, .description p, .synopsis')
      .first()
      .text()
      .trim() || undefined;

  // --- Strategy 1: table-based showtimes ---
  // <table class="showtimes"> or <table> containing date/time cells
  $('table.showtimes tr, .showtimes-table tr, table tr').each((_, tr) => {
    const $tr = $(tr);
    const cells = $tr.find('td');
    if (cells.length < 2) return;

    const dateText = cells.eq(0).text().trim();
    const isoDate = parseDateText(dateText);
    if (!isoDate) return;

    cells.each((i, td) => {
      if (i === 0) return; // skip date cell
      $(td)
        .find('a, span, .time')
        .each((_, timeEl) => {
          const time = normalizeTime($(timeEl).text().trim());
          if (!time) return;
          const href = $(timeEl).attr('href') || '';
          const ticketUrl = href
            ? href.startsWith('http')
              ? href
              : `${BASE_URL}${href}`
            : detailUrl;
          showtimes.push(
            makeShowtime(film, isoDate, time, ticketUrl, imageUrl, description)
          );
        });
    });
  });

  // --- Strategy 2: div/section-based date groups ---
  if (showtimes.length === 0) {
    const dateGroupSel =
      '.showtime-date, .showtimes-date, .date-group, ' +
      'div[class*="showtime"], div[class*="schedule-day"]';

    $(dateGroupSel).each((_, group) => {
      const $group = $(group);
      const dateText =
        $group.find('.date, .day, h3, h4, h5, strong').first().text().trim() ||
        $group.clone().children().remove().end().text().trim();
      const isoDate = parseDateText(dateText);
      if (!isoDate) return;

      $group.find('a, .time-link, .showtime-time').each((_, timeEl) => {
        const time = normalizeTime($(timeEl).text().trim());
        if (!time) return;
        const href = $(timeEl).attr('href') || '';
        const ticketUrl = href
          ? href.startsWith('http')
            ? href
            : `${BASE_URL}${href}`
          : detailUrl;
        showtimes.push(
          makeShowtime(film, isoDate, time, ticketUrl, imageUrl, description)
        );
      });
    });
  }

  // --- Strategy 3: flat list of time links with sibling date labels ---
  if (showtimes.length === 0) {
    let currentDate: string | null = null;

    // Walk elements in content containers looking for date headings and time links
    $('.showtimes, .schedule, main, .content, #content, article').find('*').each((_, el) => {
      const $el = $(el);
      const tag = (el as { tagName?: string }).tagName?.toLowerCase() || '';
      const text = $el.clone().children().remove().end().text().trim();

      // If this looks like a date heading, set current date
      if (['h2', 'h3', 'h4', 'h5', 'strong', 'b', 'span', 'p'].includes(tag)) {
        const d = parseDateText(text);
        if (d) {
          currentDate = d;
          return;
        }
      }

      // If this is a time link and we have a current date
      if (tag === 'a' && currentDate) {
        const time = normalizeTime(text);
        if (time) {
          const href = $el.attr('href') || '';
          const ticketUrl = href
            ? href.startsWith('http')
              ? href
              : `${BASE_URL}${href}`
            : detailUrl;
          showtimes.push(
            makeShowtime(film, currentDate, time, ticketUrl, imageUrl, description)
          );
        }
      }
    });
  }

  return showtimes;
}

/** Build a Showtime object. */
function makeShowtime(
  film: string,
  date: string,
  time: string,
  ticketUrl: string,
  imageUrl?: string,
  description?: string
): Showtime {
  return {
    id: `filmforum-${film}-${date}-${time}`
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/gi, '')
      .toLowerCase(),
    film,
    theater: 'Film Forum',
    date,
    time,
    ticketUrl,
    imageUrl,
    description,
  };
}

/**
 * Parse a date string into ISO YYYY-MM-DD.
 * Handles formats like "FRI FEB 21", "Feb 21", "February 21", "02/21", etc.
 * Infers year from proximity to today.
 */
function parseDateText(text: string): string | null {
  if (!text) return null;

  // Normalize: collapse whitespace, strip punctuation
  const clean = text.toUpperCase().replace(/[,\.]/g, ' ').replace(/\s+/g, ' ').trim();

  // Try "MON JAN 01" or "JAN 01" (with optional day-of-week prefix)
  const wordy = clean.match(
    /(?:MON|TUE|WED|THU|FRI|SAT|SUN)?\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{1,2})/
  );
  if (wordy) {
    const monthIdx = MONTH_MAP[wordy[1].toLowerCase().slice(0, 3)];
    if (monthIdx !== undefined) {
      const day = parseInt(wordy[2], 10);
      return makeISODate(monthIdx, day);
    }
  }

  // Try MM/DD or MM-DD
  const numeric = clean.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (numeric) {
    const month = parseInt(numeric[1], 10) - 1;
    const day = parseInt(numeric[2], 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return makeISODate(month, day);
    }
  }

  return null;
}

/** Construct an ISO date, rolling over to next year if the date appears to be in the past. */
function makeISODate(monthIdx: number, day: number): string {
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, monthIdx, day);
  // If more than 30 days in the past, assume next year
  if (candidate.getTime() < now.getTime() - PAST_DATE_THRESHOLD_MS) {
    year += 1;
  }
  const mm = String(monthIdx + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Normalize a raw time string into "H:MM AM/PM" format.
 * Handles "1:15 PM", "1:15pm", "13:15", "1 PM", etc.
 * Returns null if not a valid time.
 */
function normalizeTime(raw: string): string | null {
  if (!raw) return null;
  const clean = raw.trim();

  // 12-hour with minutes: "1:15 PM" or "1:15pm"
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    return `${match12[1]}:${match12[2]} ${match12[3].toUpperCase()}`;
  }

  // 12-hour without minutes: "1 PM" or "1pm"
  const match12NoMin = clean.match(/^(\d{1,2})\s*(AM|PM)$/i);
  if (match12NoMin) {
    return `${match12NoMin[1]}:00 ${match12NoMin[2].toUpperCase()}`;
  }

  // 24-hour: "13:15"
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    if (h > 23 || m > 59) return null;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${match24[2]} ${period}`;
  }

  return null;
}
