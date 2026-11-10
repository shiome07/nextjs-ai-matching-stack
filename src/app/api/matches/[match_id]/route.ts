import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// GET /api/matches/[match_id] — check conversation gate + fetch messages
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ match_id: string }> },
) {
  try {
    const { match_id } = await params
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userUuid = (
      await sql`SELECT id FROM users WHERE clerk_id = ${userId}`
    )[0]?.id as string
    if (!userUuid) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify the user belongs to this match
    const match = (
      await sql`
        SELECT id, user1_id, user2_id FROM matches
        WHERE id = ${match_id} AND (user1_id = ${userUuid} OR user2_id = ${userUuid})
      `
    )[0]
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Check whether the user has paid to unlock this conversation
    const tx = (
      await sql`
        SELECT id FROM transactions
        WHERE match_id = ${match_id} AND user_id = ${userUuid} AND type = 'unlock'
        LIMIT 1
      `
    )[0]
    const requiresPayment = !tx

    const messages = requiresPayment
      ? []
      : await sql`
          SELECT sender_id, content, sent_at FROM messages
          WHERE match_id = ${match_id}
          ORDER BY sent_at ASC
        `

    return NextResponse.json({
      requiresPayment,
      messages: (messages as any[]).map((m) => ({
        sender: m.sender_id,
        content: m.content,
        sentAt: m.sent_at,
      })),
    })
  } catch (error) {
    console.error('MATCH CHAT ERROR:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
