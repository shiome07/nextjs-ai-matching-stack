export interface OpenAIImageModerationResult {
  ok: boolean
  flagged: boolean
  error?: string
}

export async function moderateImageWithOpenAI(
  buffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<OpenAIImageModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { ok: false, flagged: false, error: 'Missing OPENAI_API_KEY' }
  }

  try {
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [
          {
            type: 'image_url',
            image_url: { url: dataUrl },
          },
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return {
        ok: false,
        flagged: false,
        error: `OpenAI moderation HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
      }
    }

    const json = (await res.json()) as { results?: Array<{ flagged?: boolean }> }
    const flagged = Boolean(json.results?.[0]?.flagged)
    return { ok: !flagged, flagged }
  } catch (err) {
    return {
      ok: false,
      flagged: false,
      error: err instanceof Error ? err.message : 'OpenAI moderation request failed',
    }
  }
}
