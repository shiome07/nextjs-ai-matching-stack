import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// GET /api/admin/reports — fetch pending reports (admin only)
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is admin (role-based protection)
    const user = (
      await sql`SELECT id, role FROM users WHERE clerk_id = ${userId} LIMIT 1`
    )[0]
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const reports = await sql`
      SELECT r.id, r.reporter_id, r.reported_user_id, r.reason, r.status, r.created_at,
             u.first_name, u.last_name, u.email
      FROM reports r
      JOIN users u ON r.reported_user_id = u.id
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC
      LIMIT 100
    `

    return NextResponse.json({ reports })
  } catch (error) {
    console.error('ADMIN REPORTS ERROR:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
