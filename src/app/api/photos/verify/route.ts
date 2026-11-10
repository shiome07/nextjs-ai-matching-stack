import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getPhotoObject, isAllowedImageType, MAX_FILE_BYTES } from '@/lib/r2'
import { moderateImageWithOpenAI } from '@/lib/moderation/openai-image'
import { scanMediaWithArachnid } from '@/lib/moderation/arachnid'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as { objectKey?: string }
    const objectKey = typeof body.objectKey === 'string' ? body.objectKey.trim() : ''
    if (!objectKey) {
      return NextResponse.json({ error: 'objectKey is required.' }, { status: 400 })
    }

    const userRecords = await sql`SELECT id FROM users WHERE clerk_id = ${userId}`
    if (userRecords.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const userUuid = userRecords[0].id as string

    const photos = await sql`
      SELECT id, profile_id, is_primary, moderation_status
      FROM profile_photos
      WHERE r2_object_key = ${objectKey}
    `
    const photo = photos[0]
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    if ((photo.profile_id as string) !== userUuid) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    if (photo.moderation_status !== 'pending') {
      return NextResponse.json({
        success: false,
        status: photo.moderation_status,
        message: 'Photo has already been processed.',
      })
    }

    const { buffer, contentType } = await getPhotoObject(objectKey)

    // The bytes must actually be one of the allowed image types (R2 metadata is
    // client-supplied, so we validate before sending anywhere).
    if (!isAllowedImageType(contentType)) {
      await sql`
        UPDATE profile_photos SET moderation_status = 'rejected' WHERE id = ${photo.id}
      `
      return NextResponse.json(
        { success: false, status: 'rejected', reason: 'invalid-content-type' },
        { status: 200 },
      )
    }

    if (buffer.length > MAX_FILE_BYTES) {
      await sql`
        UPDATE profile_photos SET moderation_status = 'rejected' WHERE id = ${photo.id}
      `
      return NextResponse.json(
        { success: false, status: 'rejected', reason: 'image-too-large' },
        { status: 200 },
      )
    }

    const openAi = await moderateImageWithOpenAI(
      buffer as Buffer,
      contentType as 'image/jpeg' | 'image/png' | 'image/webp',
    )
    if (!openAi.ok || openAi.flagged) {
      const reason = openAi.flagged ? 'moderation-flag' : 'moderation-failed'
      await sql`
        UPDATE profile_photos SET moderation_status = 'rejected' WHERE id = ${photo.id}
      `
      console.error('OpenAI moderation rejected photo', photo.id, {
        flagged: openAi.flagged,
        error: openAi.error,
      })
      return NextResponse.json({ success: false, status: 'rejected', reason }, { status: 200 })
    }

    const arachnid = await scanMediaWithArachnid(
      buffer as Buffer,
      contentType as 'image/jpeg' | 'image/png' | 'image/webp',
    )
    if (!arachnid.ok || arachnid.flagged) {
      const isCsamFlag = arachnid.flagged
      const newStatus = isCsamFlag ? 'flagged' : 'rejected'
      await sql`
        UPDATE profile_photos SET moderation_status = ${newStatus} WHERE id = ${photo.id}
      `
      console.error('Arachnid Shield check failed for photo', photo.id, {
        classification: arachnid.classification,
        match_type: arachnid.match_type,
        error: arachnid.error,
      })
      return NextResponse.json(
        {
          success: false,
          status: newStatus,
          reason: isCsamFlag ? 'csam-flag' : 'csam-check-failed',
        },
        { status: 200 },
      )
    }

    await sql`
      UPDATE profile_photos SET moderation_status = 'approved' WHERE id = ${photo.id}
    `
    return NextResponse.json({ success: true, status: 'approved', photoId: photo.id })
  } catch (error) {
    console.error('Error verifying photo:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}