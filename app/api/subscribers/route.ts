import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PreferenceType } from '@/app/generated/prisma/client';

/**
 * POST /api/subscribers
 * Create a new subscriber with email and preferences.
 *
 * Body: {
 *   email: string,
 *   name?: string,
 *   preferences: { type: "director" | "film" | "actor", value: string }[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, preferences } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!preferences || !Array.isArray(preferences) || preferences.length === 0) {
      return NextResponse.json({ error: 'At least one preference is required' }, { status: 400 });
    }

    // Validate preference types
    const validTypes: PreferenceType[] = ['director', 'film', 'actor'];
    for (const pref of preferences) {
      if (!validTypes.includes(pref.type)) {
        return NextResponse.json({ error: `Invalid preference type: ${pref.type}` }, { status: 400 });
      }
      if (!pref.value || typeof pref.value !== 'string') {
        return NextResponse.json({ error: 'Preference value is required' }, { status: 400 });
      }
    }

    const subscriber = await prisma.subscriber.upsert({
      where: { email: email.toLowerCase().trim() },
      update: {
        name: name || undefined,
        active: true,
        preferences: {
          deleteMany: {},
          create: preferences.map((p: { type: PreferenceType; value: string }) => ({
            type: p.type,
            value: p.value.trim(),
          })),
        },
      },
      create: {
        email: email.toLowerCase().trim(),
        name: name || null,
        preferences: {
          create: preferences.map((p: { type: PreferenceType; value: string }) => ({
            type: p.type,
            value: p.value.trim(),
          })),
        },
      },
      include: { preferences: true },
    });

    return NextResponse.json({ subscriber }, { status: 201 });
  } catch (error) {
    console.error('Error creating subscriber:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/subscribers?email=...
 * Look up a subscriber by email.
 */
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');
    if (!email) {
      return NextResponse.json({ error: 'Email query param is required' }, { status: 400 });
    }

    const subscriber = await prisma.subscriber.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { preferences: true },
    });

    if (!subscriber) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
    }

    return NextResponse.json({ subscriber });
  } catch (error) {
    console.error('Error fetching subscriber:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
