import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAllShowtimes } from '@/scrapers';
import { findMatches } from '@/lib/matcher';
import { sendNotificationEmail } from '@/lib/email';

/**
 * POST /api/notify
 *
 * Cron-triggered endpoint that:
 * 1. Scrapes all theater showtimes
 * 2. For each active subscriber, matches showtimes against preferences
 * 3. Filters out already-notified showtimes
 * 4. Sends email notifications for new matches
 * 5. Logs sent notifications to prevent duplicates
 *
 * Protected by CRON_SECRET header to prevent unauthorized triggers.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret (skip in development)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    console.log('Notification job started');

    // Step 1: Scrape all showtimes
    const showtimes = await getAllShowtimes();
    console.log(`Scraped ${showtimes.length} total showtimes`);

    if (showtimes.length === 0) {
      return NextResponse.json({ message: 'No showtimes found', notified: 0 });
    }

    // Step 2: Load all active subscribers with their preferences
    const subscribers = await prisma.subscriber.findMany({
      where: { active: true },
      include: { preferences: true },
    });
    console.log(`Found ${subscribers.length} active subscribers`);

    let totalNotified = 0;
    let totalMatches = 0;

    // Step 3: For each subscriber, find matches and send notifications
    for (const subscriber of subscribers) {
      if (subscriber.preferences.length === 0) continue;

      const matches = findMatches(showtimes, subscriber.preferences);
      if (matches.length === 0) continue;

      // Step 4: Filter out already-notified showtimes
      const existingLogs = await prisma.notificationLog.findMany({
        where: {
          subscriberId: subscriber.id,
          showtimeId: { in: matches.map(m => m.showtime.id) },
        },
        select: { showtimeId: true },
      });
      const notifiedIds = new Set(existingLogs.map((l: { showtimeId: string }) => l.showtimeId));
      const newMatches = matches.filter(m => !notifiedIds.has(m.showtime.id));

      if (newMatches.length === 0) continue;

      // Step 5: Send email
      try {
        await sendNotificationEmail({
          subscriberEmail: subscriber.email,
          subscriberName: subscriber.name,
          subscriberId: subscriber.id,
          matches: newMatches,
        });

        // Step 6: Log sent notifications
        await prisma.notificationLog.createMany({
          data: newMatches.map(m => ({
            subscriberId: subscriber.id,
            showtimeId: m.showtime.id,
            filmTitle: m.showtime.film,
            theater: m.showtime.theater,
            date: m.showtime.date,
          })),
          skipDuplicates: true,
        });

        totalNotified++;
        totalMatches += newMatches.length;
        console.log(`Sent ${newMatches.length} matches to ${subscriber.email}`);
      } catch (error) {
        console.error(`Failed to notify ${subscriber.email}:`, error);
      }
    }

    console.log(`Notification job complete: ${totalNotified} subscribers, ${totalMatches} matches`);

    return NextResponse.json({
      message: 'Notification job complete',
      subscribersNotified: totalNotified,
      totalMatchesSent: totalMatches,
      totalShowtimes: showtimes.length,
      totalSubscribers: subscribers.length,
    });
  } catch (error) {
    console.error('Notification job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
