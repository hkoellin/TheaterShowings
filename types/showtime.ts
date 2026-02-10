export interface Showtime {
  id: string;
  film: string;
  theater: string;
  date: string;        // ISO date string (YYYY-MM-DD)
  time: string;        // e.g., "7:30 PM"
  ticketUrl: string;   // direct link to buy tickets for this showing
  imageUrl?: string;   // film poster/image if available
  description?: string; // brief synopsis if available
}

export type TheaterName = 'Metrograph' | 'BAM Rose Cinemas' | 'Low Cinema' | 'IFC Center' | 'Film Forum';

export const THEATERS: TheaterName[] = ['Metrograph', 'BAM Rose Cinemas', 'Low Cinema', 'IFC Center', 'Film Forum'];
