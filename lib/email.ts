import { Resend } from 'resend';
import { MatchedShowtime } from './matcher';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'notifications@theatershowings.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export interface NotificationEmail {
  subscriberEmail: string;
  subscriberName: string | null;
  subscriberId: string;
  matches: MatchedShowtime[];
}

/**
 * Send a notification email to a subscriber about matching showtimes.
 */
export async function sendNotificationEmail(notification: NotificationEmail) {
  const { subscriberEmail, subscriberName, subscriberId, matches } = notification;
  const greeting = subscriberName ? `Hi ${subscriberName}` : 'Hi there';
  const unsubscribeUrl = `${APP_URL}/api/subscribers/unsubscribe?email=${encodeURIComponent(subscriberEmail)}`;
  const manageUrl = `${APP_URL}/notifications?email=${encodeURIComponent(subscriberEmail)}`;

  // Group matches by film for cleaner presentation
  const byFilm = new Map<string, MatchedShowtime[]>();
  for (const m of matches) {
    const key = m.showtime.film;
    if (!byFilm.has(key)) byFilm.set(key, []);
    byFilm.get(key)!.push(m);
  }

  const filmSections = Array.from(byFilm.entries())
    .map(([film, showtimes]) => {
      const matchReasons = [...new Set(
        showtimes.flatMap(s =>
          s.matchedPreferences.map(p => `${p.type}: ${p.value}`)
        )
      )];

      const showtimeLines = showtimes.map(s => {
        const times = s.showtime.allTimes?.join(', ') || s.showtime.time;
        return `        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#374151">${s.showtime.theater}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#374151">${s.showtime.date}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#374151">${times}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">
            <a href="${s.showtime.ticketUrl}" style="color:#2563eb;text-decoration:none;font-weight:600">Tickets →</a>
          </td>
        </tr>`;
      }).join('\n');

      const desc = showtimes[0].showtime.description
        ? `<p style="color:#6b7280;font-size:14px;margin:4px 0 12px">${showtimes[0].showtime.description.slice(0, 200)}${showtimes[0].showtime.description.length > 200 ? '...' : ''}</p>`
        : '';

      return `
      <div style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <div style="background:#f9fafb;padding:12px 16px;border-bottom:1px solid #e5e7eb">
          <h2 style="margin:0;color:#111827;font-size:18px">${film}</h2>
          ${desc}
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af">Matched: ${matchReasons.join(', ')}</p>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase">Theater</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase">Date</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase">Times</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase"></th>
            </tr>
          </thead>
          <tbody>
${showtimeLines}
          </tbody>
        </table>
      </div>`;
    })
    .join('\n');

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background:#f3f4f6">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
      <h1 style="margin:0 0 4px;color:#111827;font-size:24px">🎬 New Showings For You!</h1>
      <p style="color:#6b7280;margin:0 0 24px;font-size:15px">${greeting}, we found ${matches.length} showing${matches.length === 1 ? '' : 's'} matching your preferences.</p>

${filmSections}

      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center">
        <a href="${manageUrl}" style="color:#2563eb;text-decoration:none;font-size:13px">Manage preferences</a>
        <span style="color:#d1d5db;margin:0 8px">|</span>
        <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:none;font-size:13px">Unsubscribe</a>
      </div>
    </div>
  </div>
</body>
</html>`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: subscriberEmail,
    subject: `🎬 ${matches.length} new showing${matches.length === 1 ? '' : 's'} matching your interests`,
    html,
  });

  if (error) {
    console.error(`Failed to send to ${subscriberEmail}:`, error);
    throw error;
  }

  console.log(`Notification sent to ${subscriberEmail} (${matches.length} matches)`);
}
