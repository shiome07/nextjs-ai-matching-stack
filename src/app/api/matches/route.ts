import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { presignPhotoGet } from '@/lib/r2'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return new NextResponse('Unauthorized', { status: 401 })

    const userRecords = await sql`SELECT id FROM users WHERE clerk_id = ${userId}`
    if (userRecords.length === 0) return NextResponse.json({ success: false, message: 'User not found' })
    const userUuid = userRecords[0].id

    const candidates = await sql`
      SELECT 
        p.id as user_id,
        p.bio,
        p.gender,
        p.birthdate,
        u.first_name,
        pp.r2_object_key
      FROM profiles p
      JOIN users u ON u.id = p.id
      LEFT JOIN profile_photos pp ON pp.profile_id = p.id AND pp.moderation_status = 'approved'
      WHERE p.id != ${userUuid}
      AND p.id NOT IN (SELECT to_user_id FROM swipes WHERE from_user_id = ${userUuid})
      AND p.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ${userUuid})
      LIMIT 1
    `

    if (candidates.length === 0) {
      return NextResponse.json({ success: true, match: null })
    }

    const match = candidates[0]
    const photoUrl = match.r2_object_key ? await presignPhotoGet(match.r2_object_key) : null

    return NextResponse.json({
      success: true,
      match: {
        id: match.user_id,
        name: match.first_name || 'User',
        bio: match.bio,
        gender: match.gender,
        birthdate: match.birthdate,
        photoUrl
      }
    })
  } catch (error) {
    console.error('Error fetching daily match:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}