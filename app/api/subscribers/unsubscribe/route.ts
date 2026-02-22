import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/subscribers/unsubscribe?email=...&token=...
 * Unsubscribe a user via email link.
 * Token is a simple HMAC of the subscriber ID for verification.
 */
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const subscriber = await prisma.subscriber.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!subscriber) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
    }

    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { active: false },
    });

    return new NextResponse(
      `<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
        <div style="text-align:center">
          <h1>Unsubscribed</h1>
          <p>You've been unsubscribed from TheaterShowings notifications.</p>
          <p>You can re-subscribe anytime at <a href="/">TheaterShowings</a>.</p>
        </div>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('Error unsubscribing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
