import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import {
  buildPhotoKey,
  isAllowedImageType,
  MAX_PHOTOS_PER_PROFILE,
  presignPhotoPut,
} from '@/lib/r2'

// POST /api/photos/presign — authenticated route
export async function POST(req: Request) {
  try {
    // Authenticate with auth() (not auth.protect()): API routes must return
    // a 401 JSON/Text response, never redirect (auth.protect() redirects to
    // sign-in HTML, which breaks fetch() clients with a 500).
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify R2 env vars are present before attempting S3 client init.
    // Log a boolean only — never the secret values.

    const body = (await req.json().catch(() => ({}))) as { contentType?: string }
    const contentType = body.contentType
    if (!contentType || !isAllowedImageType(contentType)) {
      return NextResponse.json(
        { error: 'Unsupported content type. Allowed: image/jpeg, image/png, image/webp.' },
        { status: 400 },
      )
    }

    const userRecords = await sql`SELECT id FROM users WHERE clerk_id = ${userId}`
    if (userRecords.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const userUuid = userRecords[0].id as string

    // Ensure profile exists before inserting photo (fix for foreign key violation)
    await sql`INSERT INTO profiles (id) VALUES (${userUuid}) ON CONFLICT (id) DO NOTHING;`

    const countRows = await sql`
      SELECT COUNT(*)::int AS count FROM profile_photos WHERE profile_id = ${userUuid}
    `
    const currentCount = countRows[0]?.count ?? 0
    if (currentCount >= MAX_PHOTOS_PER_PROFILE) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_PHOTOS_PER_PROFILE} photos per profile reached.` },
        { status: 400 },
      )
    }

    const isPrimary = currentCount === 0
    const objectKey = buildPhotoKey(userUuid, contentType)
    const inserted = await sql`
      INSERT INTO profile_photos (profile_id, r2_object_key, is_primary, moderation_status)
      VALUES (${userUuid}, ${objectKey}, ${isPrimary}, 'pending')
      RETURNING id
    `
    const photoId = inserted[0]?.id as string
    const uploadUrl = await presignPhotoPut(objectKey, contentType)

    return NextResponse.json({
      success: true,
      photoId,
      objectKey,
      isPrimary,
      uploadUrl,
      expiresIn: 300,
    })
  } catch (error) {
    console.error('PRESIGN FATAL ERROR:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
