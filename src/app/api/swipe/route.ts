import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as { targetUserId?: string; action?: string }
    const { targetUserId, action } = body
    if (!targetUserId || !action) {
      return NextResponse.json({ error: 'Missing targetUserId or action' }, { status: 400 })
    }

    const userUuid = (
      await sql`SELECT id FROM users WHERE clerk_id = ${userId}`
    )[0]?.id as string
    if (!userUuid) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Record swipe
    await sql`
      INSERT INTO swipes (user_id, target_user_id, action)
      VALUES (${userUuid}, ${targetUserId}, ${action})
      ON CONFLICT (user_id, target_user_id) DO NOTHING
    `

    // Check for mutual like
    if (action === 'like') {
      const mutual = await sql`
        SELECT COUNT(*) FROM swipes
        WHERE user_id = ${targetUserId} AND target_user_id = ${userUuid} AND action = 'like'
      `
      if (mutual[0]?.count > 0) {
        // Create match entry
        await sql`
          INSERT INTO matches (user1_id, user2_id)
          VALUES (${userUuid}, ${targetUserId})
          ON CONFLICT (user1_id, user2_id) DO NOTHING
        `
        return NextResponse.json({ success: true, mutual: true })
      }
    }

    return NextResponse.json({ success: true, mutual: false })
  } catch (error) {
    console.error('SWIPE ERROR:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
