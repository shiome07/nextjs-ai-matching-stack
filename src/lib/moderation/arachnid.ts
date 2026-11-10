export type ArachnidClassification =
  | 'csam'
  | 'harmful-abusive-material'
  | 'test'
  | 'no-known-match'

export type ArachnidMatchType = 'exact' | 'near' | null

export interface ArachnidScannedMedia {
  size_bytes: number
  sha1_base32: string
  sha256_hex: string
  classification: ArachnidClassification
  match_type: ArachnidMatchType
  near_match_details: unknown[]
}

export interface ArachnidScanResult {
  ok: boolean
  flagged: boolean
  classification?: ArachnidClassification
  match_type?: ArachnidMatchType
  raw?: ArachnidScannedMedia
  error?: string
}

const BASE_URL = 'https://shield.projectarachnid.com'

function getBasicAuthHeader(): string {
  const username = process.env.ARACHNID_USERNAME
  const password = process.env.ARACHNID_PASSWORD
  if (!username || !password) {
    throw new Error('Missing ARACHNID_USERNAME or ARACHNID_PASSWORD')
  }
  const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64')
  return `Basic ${token}`
}

export async function scanMediaWithArachnid(
  buffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<ArachnidScanResult> {
  try {
    const res = await fetch(`${BASE_URL}/v1/media`, {
      method: 'POST',
      headers: {
        Authorization: getBasicAuthHeader(),
        'Content-Type': mimeType,
      },
      body: new Uint8Array(buffer),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return {
        ok: false,
        flagged: false,
        error: `Arachnid Shield HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
      }
    }

    const data = (await res.json()) as ArachnidScannedMedia
    const classification = data.classification
    const flagged = classification === 'csam' || classification === 'harmful-abusive-material'

    return {
      ok: !flagged && classification === 'no-known-match',
      flagged,
      classification,
      match_type: data.match_type,
      raw: data,
    }
  } catch (err) {
    return {
      ok: false,
      flagged: false,
      error: err instanceof Error ? err.message : 'Arachnid Shield request failed',
    }
  }
}
