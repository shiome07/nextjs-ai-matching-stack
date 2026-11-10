import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(req: Request) {
  try {
    // 1. Verify the user is logged in via Clerk
    const { userId } = await auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // 2. Get the data from the form
    const body = await req.json()
    const { bio, gender, birthdate } = body

    // 3. Find the user's internal UUID in our database using their Clerk ID
    const userRecords = await sql`SELECT id FROM users WHERE clerk_id = ${userId}`
    if (userRecords.length === 0) {
      return new NextResponse('User not found in database', { status: 404 })
    }
    const userUuid = userRecords[0].id

    // 4. Insert or Update the profile
    await sql`
      INSERT INTO profiles (id, bio, gender, birthdate)
      VALUES (${userUuid}, ${bio}, ${gender}, ${birthdate})
      ON CONFLICT (id) DO UPDATE
      SET bio = EXCLUDED.bio,
          gender = EXCLUDED.gender,
          birthdate = EXCLUDED.birthdate;
    `

    return NextResponse.json({ success: true, message: 'Profile saved!' })
  } catch (error) {
    console.error('Error saving profile:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}