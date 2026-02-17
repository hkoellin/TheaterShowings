export interface Showtime {
  id: string;
  film: string;
  theater: string;
  date: string;        // ISO date string (YYYY-MM-DD)
  time: string;        // e.g., "7:30 PM"
  ticketUrl: string;   // direct link to buy tickets for this showing
  imageUrl?: string;   // film poster/image if available
  description?: string; // brief synopsis if available
  popularity?: number; // 0-100 score derived from ticket sales / availability
  ticketsAvailable?: number; // remaining tickets if known
  totalCapacity?: number;    // total seats if known
  allTimes?: string[]; // all showtimes for this film on this date at this theater
}

export type TheaterName = 'Metrograph' | 'BAM Rose Cinemas' | 'Low Cinema' | 'IFC Center' | 'Film Forum';

export const THEATERS: TheaterName[] = ['Metrograph', 'BAM Rose Cinemas', 'Low Cinema', 'IFC Center', 'Film Forum'];
