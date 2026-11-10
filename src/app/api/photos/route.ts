import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { presignPhotoGet } from '@/lib/r2'

// GET /api/photos
// Returns the caller's OWN approved profile photos with short-lived presigned GET URLs.
// Photos are never served public: the URL is generated per authenticated request.
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRecords = await sql`SELECT id FROM users WHERE clerk_id = ${userId}`
    if (userRecords.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const userUuid = userRecords[0].id as string

    const photos = await sql`
      SELECT id, r2_object_key, is_primary
      FROM profile_photos
      WHERE profile_id = ${userUuid} AND moderation_status = 'approved'
      ORDER BY is_primary DESC, created_at ASC
    `

    const items = await Promise.all(
      photos.map(async (p) => ({
        photoId: p.id,
        isPrimary: p.is_primary,
        url: await presignPhotoGet(p.r2_object_key as string),
      })),
    )

    return NextResponse.json({ photos: items })
  } catch (error) {
    console.error('Error listing photos:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
