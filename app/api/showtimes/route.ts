import { NextResponse } from 'next/server';
import { getAllShowtimes } from '@/scrapers';

/**
 * GET /api/showtimes
 * 
 * Returns aggregated showtimes from all NYC theaters.
 * 
 * Features:
 * - Runs all scrapers concurrently
 * - Returns partial results if some scrapers fail
 * - Includes cache control headers (1 hour cache)
 * - Handles errors gracefully
 */
export async function GET() {
  try {
    const showtimes = await getAllShowtimes();

    return NextResponse.json(
      { 
        showtimes,
        timestamp: new Date().toISOString(),
        count: showtimes.length
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      }
    );
  } catch (error) {
    console.error('API Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch showtimes',
        showtimes: [],
        timestamp: new Date().toISOString(),
        count: 0
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}
