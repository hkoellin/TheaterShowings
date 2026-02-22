import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PreferenceType } from '@/app/generated/prisma/client';

/**
 * GET /api/subscribers/[id]
 * Get a subscriber profile with preferences.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const subscriber = await prisma.subscriber.findUnique({
      where: { id },
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

/**
 * PUT /api/subscribers/[id]
 * Update a subscriber's name, preferences, or active status.
 *
 * Body: {
 *   name?: string,
 *   active?: boolean,
 *   preferences?: { type: "director" | "film" | "actor", value: string }[]
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, active, preferences } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (active !== undefined) updateData.active = active;

    if (preferences && Array.isArray(preferences)) {
      const validTypes: PreferenceType[] = ['director', 'film', 'actor'];
      for (const pref of preferences) {
        if (!validTypes.includes(pref.type)) {
          return NextResponse.json({ error: `Invalid preference type: ${pref.type}` }, { status: 400 });
        }
      }
      updateData.preferences = {
        deleteMany: {},
        create: preferences.map((p: { type: PreferenceType; value: string }) => ({
          type: p.type,
          value: p.value.trim(),
        })),
      };
    }

    const subscriber = await prisma.subscriber.update({
      where: { id },
      data: updateData,
      include: { preferences: true },
    });

    return NextResponse.json({ subscriber });
  } catch (error) {
    console.error('Error updating subscriber:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/subscribers/[id]
 * Deactivate (soft-delete) a subscriber.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.subscriber.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subscriber:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
