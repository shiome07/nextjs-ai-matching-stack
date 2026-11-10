import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// POST /api/messages — send a message in a match
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as { matchId?: string; content?: string }
    const { matchId, content } = body
    if (!matchId || !content) {
      return NextResponse.json({ error: 'Missing matchId or content' }, { status: 400 })
    }

    const userUuid = (
      await sql`SELECT id FROM users WHERE clerk_id = ${userId}`
    )[0]?.id as string
    if (!userUuid) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify user belongs to this match
    const match = (
      await sql`
        SELECT id, user1_id, user2_id FROM matches
        WHERE id = ${matchId} AND (user1_id = ${userUuid} OR user2_id = ${userUuid})
      `
    )[0]
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Check payment gate
    const tx = (
      await sql`
        SELECT id FROM transactions
        WHERE match_id = ${matchId} AND user_id = ${userUuid} AND type = 'unlock'
        LIMIT 1
      `
    )[0]
    if (!tx) {
      return NextResponse.json({ error: 'Conversation locked. Unlock to send messages.' }, { status: 403 })
    }

    await sql`
      INSERT INTO messages (match_id, sender_id, content)
      VALUES (${matchId}, ${userUuid}, ${content})
      RETURNING id
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('SEND MESSAGE ERROR:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
