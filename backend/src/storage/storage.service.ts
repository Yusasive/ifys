import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const SIGNED_URL_TTL_SECONDS = 15 * 60;

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
    // Local dev (MinIO) needs explicit static credentials. On ECS, no
    // S3_ACCESS_KEY_ID is set and the SDK's default credential chain picks
    // up the task role's temporary credentials instead — no long-lived
    // secret to store or rotate in production.
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    this.client = new S3Client({
      region: this.config.getOrThrow<string>('S3_REGION'),
      endpoint: this.config.getOrThrow<string>('S3_ENDPOINT'),
      forcePathStyle: this.config.get('S3_FORCE_PATH_STYLE') === 'true',
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  // Private bucket, signed PUT for direct-from-browser uploads (student ID files).
  getUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });
  }

  // Signed GET so admins can view an uploaded student ID without making the bucket public.
  getDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, {
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });
  }

  // Server-side direct write (background jobs, e.g. the CSV export) —
  // distinct from getUploadUrl, which hands a signed PUT to the browser.
  async putObject(
    key: string,
    body: Buffer | string,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }
}
