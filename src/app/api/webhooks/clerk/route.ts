import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(req: NextRequest) {
  let evt

  // Verify the webhook signature automatically
  try {
    evt = await verifyWebhook(req)
  } catch (err) {
    console.error('Webhook verification failed:', err)
    return new Response('Verification failed', { status: 400 })
  }

  const eventType = evt.type

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name } = evt.data
    const email = email_addresses[0]?.email_address

    try {
      // Ensure profile exists (required for photo uploads later)
      await sql`INSERT INTO profiles (id) VALUES (${id}) ON CONFLICT (id) DO NOTHING;`

      // Insert user record
      await sql`
        INSERT INTO users (clerk_id, email, first_name, last_name)
        VALUES (${id}, ${email}, ${first_name}, ${last_name})
        ON CONFLICT (clerk_id) DO NOTHING;
      `
    } catch (error) {
      console.error('Database error:', error)
      return new Response('Database error', { status: 500 })
    }
  }

  return new Response('Webhook received', { status: 200 })
}
