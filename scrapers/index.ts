import { Showtime } from '@/types/showtime';
import { scrapeMetrograph } from './metrograph';
import { scrapeBAM } from './bam';
import { scrapeLowCinema } from './lowcinema';
import { scrapeIFC } from './ifc';
import { scrapeFilmForum } from './filmforum';

/**
 * Aggregates showtimes from all theater scrapers.
 * 
 * This function runs all scrapers concurrently using Promise.allSettled,
 * which means that if one scraper fails, the others will still complete.
 * This ensures that the app remains functional even if one theater's
 * website is down or has changed its structure.
 * 
 * @returns Promise<Showtime[]> - Array of all showtimes sorted by date and time
 */
export async function getAllShowtimes(): Promise<Showtime[]> {
  // Run all scrapers concurrently
  const results = await Promise.allSettled([
    scrapeMetrograph(),
    scrapeBAM(),
    scrapeLowCinema(),
    scrapeIFC(),
    scrapeFilmForum(),
  ]);

  // Collect successful results and log failures
  const allShowtimes: Showtime[] = [];
  
  results.forEach((result, index) => {
    const theaterNames = ['Metrograph', 'BAM Rose Cinemas', 'Low Cinema', 'IFC Center', 'Film Forum'];
    
    if (result.status === 'fulfilled') {
      allShowtimes.push(...result.value);
      console.log(`✓ ${theaterNames[index]}: ${result.value.length} showtimes`);
    } else {
      console.error(`✗ ${theaterNames[index]} failed:`, result.reason);
    }
  });

  // Sort by date, then by time
  allShowtimes.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    
    // Convert time to 24-hour format for proper sorting
    const timeA = convertTo24Hour(a.time);
    const timeB = convertTo24Hour(b.time);
    return timeA.localeCompare(timeB);
  });

  return allShowtimes;
}

/**
 * Converts 12-hour time format to 24-hour format for sorting
 */
function convertTo24Hour(time12h: string): string {
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  
  if (hours === '12') {
    hours = '00';
  }
  
  if (modifier === 'PM') {
    hours = String(parseInt(hours, 10) + 12);
  }
  
  return `${hours.padStart(2, '0')}:${minutes}`;
}
