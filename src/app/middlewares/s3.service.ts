import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../config/env.config';
import crypto from 'crypto';

//Subir archivos a s3

const client = new S3Client({ region: env.AWS_REGION });

export async function uploadFileToS3(fileBuffer: Buffer, mimetype: string, folder: string): Promise<string> {
  const fileKey = `${folder}/${crypto.randomUUID()}`;

  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: fileKey,
      Body: fileBuffer,
      ContentType: mimetype,
    })
  );

  return `https://${env.S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${fileKey}`;
}

export async function uploadBusinessLogo(fileBuffer: Buffer, mimetype: string) {
  return uploadFileToS3(fileBuffer, mimetype, 'businesses/logos');
}

export async function uploadBusinessPhoto(fileBuffer: Buffer, mimetype: string) {
  return uploadFileToS3(fileBuffer, mimetype, 'businesses/photos');
}

export async function uploadServicePhoto(fileBuffer: Buffer, mimetype: string) {
  return uploadFileToS3(fileBuffer, mimetype, 'services/photos');
}

export async function uploadUserPhoto(fileBuffer: Buffer, mimetype: string) {
  return uploadFileToS3(fileBuffer, mimetype, 'users/photos');
}
