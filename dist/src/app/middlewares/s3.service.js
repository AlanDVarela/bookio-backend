"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFileToS3 = uploadFileToS3;
exports.uploadBusinessLogo = uploadBusinessLogo;
exports.uploadBusinessPhoto = uploadBusinessPhoto;
exports.uploadServicePhoto = uploadServicePhoto;
exports.uploadUserPhoto = uploadUserPhoto;
const client_s3_1 = require("@aws-sdk/client-s3");
const env_config_1 = require("../../config/env.config");
const crypto_1 = __importDefault(require("crypto"));
//Subir archivos a s3
const client = new client_s3_1.S3Client({
    region: env_config_1.env.AWS_REGION,
    credentials: env_config_1.env.AWS_ACCESS_KEY_ID && env_config_1.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env_config_1.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env_config_1.env.AWS_SECRET_ACCESS_KEY,
            sessionToken: env_config_1.env.AWS_SESSION_TOKEN,
        }
        : undefined,
});
async function uploadFileToS3(fileBuffer, mimetype, folder) {
    const fileKey = `${folder}/${crypto_1.default.randomUUID()}`;
    try {
        await client.send(new client_s3_1.PutObjectCommand({
            Bucket: env_config_1.env.S3_BUCKET_NAME,
            Key: fileKey,
            Body: fileBuffer,
            ContentType: mimetype,
        }));
    }
    catch (error) {
        console.error(`[S3 Upload Error] Failed to upload to bucket ${env_config_1.env.S3_BUCKET_NAME}:`, error);
        throw error;
    }
    return `https://${env_config_1.env.S3_BUCKET_NAME}.s3.${env_config_1.env.AWS_REGION}.amazonaws.com/${fileKey}`;
}
async function uploadBusinessLogo(fileBuffer, mimetype) {
    return uploadFileToS3(fileBuffer, mimetype, 'businesses/logos');
}
async function uploadBusinessPhoto(fileBuffer, mimetype) {
    return uploadFileToS3(fileBuffer, mimetype, 'businesses/photos');
}
async function uploadServicePhoto(fileBuffer, mimetype) {
    return uploadFileToS3(fileBuffer, mimetype, 'services/photos');
}
async function uploadUserPhoto(fileBuffer, mimetype) {
    return uploadFileToS3(fileBuffer, mimetype, 'users/photos');
}
