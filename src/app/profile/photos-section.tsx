'use client'

import { useCallback, useEffect, useState } from 'react'

interface Photo {
  photoId: string
  isPrimary: boolean
  url: string
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

export default function PhotosSection() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [loadingPhotos, setLoadingPhotos] = useState(true)

  const loadPhotos = useCallback(async () => {
    try {
      const res = await fetch('/api/photos')
      if (res.ok) {
        const data = (await res.json()) as { photos: Photo[] }
        setPhotos(data.photos)
      }
    } catch (e) {
      console.error('Failed to load photos', e)
    } finally {
      setLoadingPhotos(false)
    }
  }, [])

  useEffect(() => {
    loadPhotos()
  }, [loadPhotos])

  const handleFile = async (file: File) => {
    setMessage(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setMessage({ kind: 'err', text: 'Only JPEG, PNG, or WebP images are allowed.' })
      return
    }
    if (file.size > MAX_BYTES) {
      setMessage({ kind: 'err', text: 'Image must be 5MB or smaller.' })
      return
    }
    if (photos.length >= 6) {
      setMessage({ kind: 'err', text: 'A profile can have up to 6 photos.' })
      return
    }

    setUploading(true)
    try {
      // 1. Request a short-lived presigned PUT URL
      const presignRes = await fetch('/api/photos/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type }),
      })
      if (!presignRes.ok) {
        const err = (await presignRes.json().catch(() => ({}))) as { error?: string }
        setMessage({ kind: 'err', text: err.error || 'Failed to start upload.' })
        return
      }
      const presign = (await presignRes.json()) as {
        uploadUrl: string
        objectKey: string
      }

      // 2. Upload the raw bytes directly to R2
      const upload = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!upload.ok) {
        setMessage({ kind: 'err', text: 'Upload to storage failed. Check R2 bucket CORS.' })
        return
      }

      // 3. Trigger verification: OpenAI moderation -> Arachnid Shield CSAM scan
      const verifyRes = await fetch('/api/photos/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectKey: presign.objectKey }),
      })
      const verify = (await verifyRes.json()) as { success?: boolean; status?: string; reason?: string }

      if (verify.success && verify.status === 'approved') {
        setMessage({ kind: 'ok', text: 'Photo approved and visible on your profile.' })
        await loadPhotos()
      } else {
        const reasons: Record<string, string> = {
          'moderation-flag': 'Photo was rejected by automated moderation.',
          'csam-flag':
            'Photo was flagged for review and will not be shown. Our team will follow up.',
          'moderation-failed': 'Automated moderation could not be completed. Please try again.',
          'csam-check-failed': 'Safety check could not be completed. Please try again.',
          'image-too-large': 'Image is larger than 5MB.',
          'already-processed': 'This photo has already been processed.',
        }
        setMessage({ kind: 'err', text: reasons[verify.reason || ''] || 'Photo was not approved.' })
      }
    } catch (e) {
      console.error('Upload flow failed', e)
      setMessage({ kind: 'err', text: 'Upload failed. Please try again.' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-3">
      <h2 className="text-xl font-semibold">Profile Photos</h2>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed p-4 text-sm text-gray-600 hover:bg-gray-50">
        {uploading ? 'Uploading…' : 'Choose a photo (JPEG/PNG/WebP, ≤5MB)'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
      </label>

      {message && (
        <p className={message.kind === 'ok' ? 'text-green-700' : 'text-red-600'}>{message.text}</p>
      )}

      {loadingPhotos ? (
        <p className="text-sm text-gray-500">Loading photos…</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-gray-500">No approved photos yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.photoId} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="Profile photo" className="h-full w-full rounded-md object-cover" loading="lazy" />
              {p.isPrimary && (
                <span className="absolute bottom-1 left-1 rounded bg-blue-600 px-1 text-[10px] text-white">
                  Primary
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
