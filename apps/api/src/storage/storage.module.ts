import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  BadRequestException,
  Global,
  Injectable,
  Module,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

/**
 * Stockage de fichiers compatible S3 (MinIO en local, voir docker-compose).
 * Bucket privé : les fichiers passent toujours par l'API, qui vérifie les droits.
 * Variables : S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET (défaut « soukoulou »), S3_REGION.
 */
@Injectable()
export class StorageService {
  private client?: S3Client;
  private bucketReady?: Promise<void>;

  constructor(private readonly config: ConfigService) {}

  private get bucket() {
    return this.config.get<string>('S3_BUCKET') ?? 'soukoulou';
  }

  private s3() {
    if (this.client) return this.client;
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.config.get<string>('S3_SECRET_KEY');
    if (!endpoint || !accessKeyId || !secretAccessKey)
      throw new ServiceUnavailableException(
        'Le stockage des fichiers n’est pas configuré (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY).',
      );
    this.client = new S3Client({
      endpoint,
      region: this.config.get<string>('S3_REGION') ?? 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true, // MinIO : http://hôte:9000/bucket/clé
    });
    return this.client;
  }

  /** Crée le bucket au premier envoi s'il n'existe pas. */
  private ready() {
    this.bucketReady ??= this.s3()
      .send(new HeadBucketCommand({ Bucket: this.bucket }))
      .then(
        () => undefined,
        async () => {
          await this.s3().send(
            new CreateBucketCommand({ Bucket: this.bucket }),
          );
        },
      )
      .catch((e: unknown) => {
        this.bucketReady = undefined;
        throw e;
      });
    return this.bucketReady;
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.ready();
    await this.s3().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string) {
    const r = await this.s3().send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return {
      stream: r.Body as Readable,
      contentType: r.ContentType ?? 'application/octet-stream',
    };
  }

  /**
   * Photo de profil : JPEG, PNG ou WebP (vérifié sur les octets) rangée sous `prefix`.
   * Renvoie la nouvelle clé ; l'appelant l'enregistre puis supprime l'ancienne.
   */
  async putImage(prefix: string, file: Express.Multer.File | undefined) {
    const type = file && imageType(file.buffer);
    if (!file || !type)
      throw new BadRequestException('Choisissez une photo JPEG, PNG ou WebP.');
    const key = `${prefix}/${randomUUID()}`;
    await this.put(key, file.buffer, type);
    return key;
  }

  /** Suppression silencieuse : un fichier déjà absent n'est pas une erreur. */
  async remove(key: string) {
    await this.s3()
      .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
      .catch(() => undefined);
  }
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}

/** Type réel d'une image d'après ses premiers octets (on ne croit pas l'extension). */
export function imageType(
  b: Buffer,
): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return 'image/jpeg';
  if (
    b.length >= 8 &&
    b
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (
    b.length >= 12 &&
    b.subarray(0, 4).toString('latin1') === 'RIFF' &&
    b.subarray(8, 12).toString('latin1') === 'WEBP'
  )
    return 'image/webp';
  return null;
}

/** Dernière partie de la clé : change à chaque nouvelle photo (sert à rafraîchir les caches). */
export const photoVersion = (key: string | null) =>
  key?.split('/').pop() ?? null;
