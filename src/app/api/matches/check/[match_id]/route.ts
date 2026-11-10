import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const matchId = searchParams.get('match_id')
  if (!matchId) return NextResponse.json({ error: 'Missing match_id' }, { status: 400 })

  try {
    const result = await sql`SELECT id FROM transactions WHERE match_id = ${matchId} AND type = 'unlock' LIMIT 1`
    const unlocked = result.length > 0
    return NextResponse.json({ requiresPayment: !unlocked })
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}