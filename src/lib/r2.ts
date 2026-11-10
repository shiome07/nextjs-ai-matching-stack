import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

const REQUIRED_ENV = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
] as const

function requireR2Env() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(`Missing R2 environment variables: ${missing.join(', ')}`)
  }
  return {
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucket: process.env.R2_BUCKET_NAME!,
  }
}

let _client: S3Client | null = null

export function getR2Client() {
  if (_client) return _client
  const { accountId, accessKeyId, secretAccessKey } = requireR2Env()
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
  return _client
}

export function getR2Bucket() {
  return requireR2Env().bucket
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_PHOTOS_PER_PROFILE = 6

export function extForMime(mime: string): 'jpg' | 'png' | 'webp' {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  throw new Error(`Unsupported image type: ${mime}`)
}

export function isAllowedImageType(mime: string): mime is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mime)
}

export function buildPhotoKey(profileId: string, mime: AllowedImageType) {
  return `profiles/${profileId}/${randomUUID()}.${extForMime(mime)}`
}

export async function presignPhotoPut(objectKey: string, contentType: AllowedImageType) {
  const client = getR2Client()
  const bucket = getR2Bucket()
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
  })
  return getSignedUrl(client, cmd, { expiresIn: 60 * 5 })
}

export async function presignPhotoGet(objectKey: string) {
  const client = getR2Client()
  const bucket = getR2Bucket()
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: objectKey })
  return getSignedUrl(client, cmd, { expiresIn: 60 * 10 })
}

export async function getPhotoObject(objectKey: string): Promise<{ buffer: Buffer; contentType: string }> {
  const client = getR2Client()
  const bucket = getR2Bucket()
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }))
  if (!res.Body) throw new Error('Empty R2 object body')
  const bytes = await res.Body.transformToByteArray()
  const contentType = res.ContentType || 'application/octet-stream'
  return { buffer: Buffer.from(bytes), contentType }
}
