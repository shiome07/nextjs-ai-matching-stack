import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await req.json()) as { matchId?: string }
    const matchId = body.matchId
    if (!matchId) return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })

    const userUuid = (
      await sql`SELECT id FROM users WHERE clerk_id = ${userId}`
    )[0]?.id as string
    if (!userUuid) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const match = (
      await sql`SELECT id FROM matches WHERE id = ${matchId} AND (user1_id = ${userUuid} OR user2_id = ${userUuid})`
    )[0]
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

    // Check if already unlocked
    const existing = (
      await sql`SELECT id FROM transactions WHERE match_id = ${matchId} AND user_id = ${userUuid} AND type = 'unlock' LIMIT 1`
    )[0]
    if (existing) return NextResponse.json({ success: true, unlocked: true }, { status: 200 })

    // Insert unlock transaction (real app would call Stripe)
    await sql`INSERT INTO transactions (match_id, user_id, type, amount, currency) VALUES (${matchId}, ${userUuid}, 'unlock', 200, 'USD')`

    return NextResponse.json({ success: true, unlocked: false }, { status: 200 })
  } catch (error) {
    console.error('Unlock error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}