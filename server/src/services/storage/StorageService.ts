import { Storage } from '@google-cloud/storage';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../../utils/logger';

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME ?? '';
const SIGNED_URL_TTL_MINUTES = 15;
const tracer = trace.getTracer('storage-service');

export interface SignedUploadUrl {
  uploadUrl: string;
  objectPath: string;
  expiresAt: Date;
}

export interface SignedDownloadUrl {
  downloadUrl: string;
  expiresAt: Date;
}

/**
 * Generates a V4 signed URL for a client-side direct upload.
 * The client PUTs directly to GCS; the backend never handles the file bytes.
 */
export async function createSignedUploadUrl(
  userId: string,
  filename: string,
  contentType: string,
): Promise<SignedUploadUrl> {
  return tracer.startActiveSpan('storage.createSignedUpload', async (span) => {
    const objectPath = `uploads/${userId}/${Date.now()}-${sanitizeFilename(filename)}`;
    span.setAttribute('object_path', objectPath);

    try {
      const bucket = storage.bucket(BUCKET_NAME);
      const file = bucket.file(objectPath);

      const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_MINUTES * 60 * 1000);

      const [uploadUrl] = await file.generateSignedUrl({
        version: 'v4',
        action: 'write',
        expires: expiresAt,
        contentType,
        extensionHeaders: {
          'x-goog-content-length-range': '0,104857600', // max 100 MB
        },
      });

      span.setStatus({ code: SpanStatusCode.OK });
      logger.info({ objectPath, expiresAt }, 'Signed upload URL created');

      return { uploadUrl, objectPath, expiresAt };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      span.recordException(err as Error);
      logger.error({ err, objectPath }, 'Failed to create signed upload URL');
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Generates a V4 signed URL for temporary read access to a GCS object.
 */
export async function createSignedDownloadUrl(
  objectPath: string,
): Promise<SignedDownloadUrl> {
  return tracer.startActiveSpan('storage.createSignedDownload', async (span) => {
    span.setAttribute('object_path', objectPath);

    try {
      const bucket = storage.bucket(BUCKET_NAME);
      const file = bucket.file(objectPath);

      const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_MINUTES * 60 * 1000);

      const [downloadUrl] = await file.generateSignedUrl({
        version: 'v4',
        action: 'read',
        expires: expiresAt,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return { downloadUrl, expiresAt };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      span.recordException(err as Error);
      logger.error({ err, objectPath }, 'Failed to create signed download URL');
      throw err;
    } finally {
      span.end();
    }
  });
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}
