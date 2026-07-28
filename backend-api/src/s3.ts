import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'smartform-assets';

export const isS3Configured = Boolean(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ENDPOINT);

export const s3Client = isS3Configured ? new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  }
}) : null;

export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!s3Client) throw new Error('S3 is not configured');
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType
  });
  await s3Client.send(command);
  return key;
}

export async function getPresignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  if (!s3Client) throw new Error('S3 is not configured');
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key
  });
  return await getSignedUrl(s3Client, command, { expiresIn });
}

export async function getS3ObjectBuffer(key: string): Promise<Buffer> {
  if (!s3Client) throw new Error('S3 is not configured');
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key
  });
  const response = await s3Client.send(command);
  if (!response.Body) throw new Error('S3 response body is empty');
  
  const byteArray = await response.Body.transformToByteArray();
  return Buffer.from(byteArray);
}
