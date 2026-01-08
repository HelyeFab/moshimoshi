import { S3Client } from '@aws-sdk/client-s3'

const DEFAULT_SIGNED_URL_TTL_SECONDS = 300

let cachedClient: S3Client | null = null

type R2Config = {
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  endpoint: string
  region: string
  signedUrlTtlSeconds: number
}

function loadR2Config(): R2Config {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET
  const endpoint = process.env.R2_ENDPOINT
  const region = process.env.R2_REGION || 'auto'
  const ttlRaw = process.env.R2_SIGNED_URL_TTL_SECONDS

  const missing: string[] = []
  if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID')
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY')
  if (!bucket) missing.push('R2_BUCKET')
  if (!endpoint) missing.push('R2_ENDPOINT')

  if (missing.length > 0) {
    throw new Error(`Missing R2 config: ${missing.join(', ')}`)
  }

  const signedUrlTtlSeconds = Number.isFinite(Number(ttlRaw))
    ? Math.max(60, Number(ttlRaw))
    : DEFAULT_SIGNED_URL_TTL_SECONDS

  return {
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucket: bucket!,
    endpoint: endpoint!,
    region,
    signedUrlTtlSeconds,
  }
}

export function getR2Config(): { client: S3Client; bucket: string; signedUrlTtlSeconds: number } {
  const config = loadR2Config()

  if (!cachedClient) {
    cachedClient = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
      // Disable automatic checksums to avoid CORS issues with presigned URLs
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  }

  return {
    client: cachedClient,
    bucket: config.bucket,
    signedUrlTtlSeconds: config.signedUrlTtlSeconds,
  }
}
