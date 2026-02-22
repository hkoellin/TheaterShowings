import { prisma } from '@/lib/prisma';
import { getAllShowtimes } from '@/scrapers';
import { findMatches } from '@/lib/matcher';
import { sendNotificationEmail } from '@/lib/email';

export interface NotifyResult {
  subscriberEmail: string;
  matchesSent: number;
  alreadyNotified: number;
  totalShowtimes: number;
}

/**
 * Run the notification pipeline for a single subscriber:
 * 1. Scrape all current showtimes
 * 2. Match against the subscriber's preferences
 * 3. Filter out already-notified showtimes
 * 4. Send email with new matches
 * 5. Log sent notifications
 *
 * Optionally accepts pre-scraped showtimes to avoid redundant scraping
 * when called in a loop (e.g. the cron job).
 */
export async function notifySingleSubscriber(
  subscriberId: string,
  preloadedShowtimes?: Awaited<ReturnType<typeof getAllShowtimes>>
): Promise<NotifyResult | null> {
  const subscriber = await prisma.subscriber.findUnique({
    where: { id: subscriberId },
    include: { preferences: true },
  });

  if (!subscriber || !subscriber.active || subscriber.preferences.length === 0) {
    return null;
  }

  // Scrape showtimes (or reuse preloaded ones)
  const showtimes = preloadedShowtimes ?? await getAllShowtimes();

  if (showtimes.length === 0) {
    return { subscriberEmail: subscriber.email, matchesSent: 0, alreadyNotified: 0, totalShowtimes: 0 };
  }

  // Find matches against preferences
  const matches = findMatches(showtimes, subscriber.preferences);
  if (matches.length === 0) {
    return { subscriberEmail: subscriber.email, matchesSent: 0, alreadyNotified: 0, totalShowtimes: showtimes.length };
  }

  // Filter out already-notified showtimes
  const existingLogs = await prisma.notificationLog.findMany({
    where: {
      subscriberId: subscriber.id,
      showtimeId: { in: matches.map(m => m.showtime.id) },
    },
    select: { showtimeId: true },
  });
  const notifiedIds = new Set(existingLogs.map((l: { showtimeId: string }) => l.showtimeId));
  const newMatches = matches.filter(m => !notifiedIds.has(m.showtime.id));

  if (newMatches.length === 0) {
    return {
      subscriberEmail: subscriber.email,
      matchesSent: 0,
      alreadyNotified: matches.length,
      totalShowtimes: showtimes.length,
    };
  }

  // Send email
  await sendNotificationEmail({
    subscriberEmail: subscriber.email,
    subscriberName: subscriber.name,
    subscriberId: subscriber.id,
    matches: newMatches,
  });

  // Log sent notifications
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

  console.log(`Immediate notify: sent ${newMatches.length} matches to ${subscriber.email}`);

  return {
    subscriberEmail: subscriber.email,
    matchesSent: newMatches.length,
    alreadyNotified: matches.length - newMatches.length,
    totalShowtimes: showtimes.length,
  };
}
