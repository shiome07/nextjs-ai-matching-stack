import { sql } from '@/lib/db'
import { presignPhotoGet } from '@/lib/r2'

export interface Match {
  userId: string
  name: string
  bio: string
  photoUrl: string
  clerkId: string
}

export interface MatchResponse {
  success: boolean
  match: Match | null
  message?: string
}

// Placeholder embedding function (real implementation would use OpenAI)
async function ensureUserEmbedding(userId: string): Promise<null> {
  const userUuid = (
    await sql`SELECT id FROM users WHERE clerk_id = ${userId}`
  )[0]?.id as string
  if (!userUuid) throw new Error('User not found')
  // In real app: fetch embedding and store in profiles table
  return null
}

// Simplified preference matching (real app would use embedding similarity)
async function preferencesMatch(currentUserId: string, targetUserId: string): Promise<boolean> {
  const currentPrefs = (
    await sql`SELECT age, gender FROM user_preferences WHERE user_id = ${currentUserId}`
  )[0]
  const targetPrefs = (
    await sql`SELECT age_range, gender_pref FROM user_preferences WHERE user_id = ${targetUserId}`
  )[0]
  if (!currentPrefs || !targetPrefs) return false

  const ageOk = !currentPrefs.age || !targetPrefs.age_range ||
    (currentPrefs.age >= targetPrefs.age_range[0] && currentPrefs.age <= targetPrefs.age_range[1])
  const genderOk = !currentPrefs.gender || currentPrefs.gender === 'any' ||
    !targetPrefs.gender_pref || targetPrefs.gender_pref === 'any' ||
    currentPrefs.gender === targetPrefs.gender_pref
  return ageOk && genderOk
}

export async function fetchMatch(clerkUserId?: string): Promise<MatchResponse> {
  if (!clerkUserId) {
    return { success: false, match: null, message: 'Authentication required' }
  }

  try {
    const userUuid = (
      await sql`SELECT id FROM users WHERE clerk_id = ${clerkUserId}`
    )[0]?.id as string
    if (!userUuid) {
      return { success: false, match: null, message: 'User not found' }
    }

    // Ensure user has embedding (placeholder for demo)
    await ensureUserEmbedding(userUuid)

    // Get user's preferences
    const prefs = (
      await sql`SELECT age, gender FROM user_preferences WHERE user_id = ${userUuid}`
    )[0]

    // Find candidates using random selection for demo
    const candidates = (await sql`
      SELECT p.id, p.name, p.bio, u.clerk_id
      FROM profiles p
      JOIN users u ON p.id = u.id
      WHERE p.id <> ${userUuid}
      AND p.moderation_status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM swipes s
        WHERE s.user_id = ${userUuid} AND s.target_user_id = p.id
      )
      ORDER BY RANDOM()
      LIMIT 5
    `) as { id: string; name: string; bio: string; clerk_id: string }[]

    for (const cand of candidates) {
      if (await preferencesMatch(userUuid, cand.id)) {
        const photoResult = (await sql`
          SELECT r2_object_key FROM profile_photos
          WHERE profile_id = ${cand.id} AND is_primary = true LIMIT 1
        `) as { r2_object_key: string }[]
        const photoUrl = await presignPhotoGet(photoResult[0]?.r2_object_key as string)
        return {
          success: true,
          match: {
            userId: cand.id,
            name: cand.name,
            bio: cand.bio,
            photoUrl,
            clerkId: cand.clerk_id,
          },
        }
      }
    }

    return { success: true, match: null, message: 'No compatible matches found' }
  } catch (error) {
    console.error('Match fetch error:', error)
    return { success: false, match: null, message: 'Failed to find match' }
  }
}