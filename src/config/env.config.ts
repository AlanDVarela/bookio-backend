import "dotenv/config";

export const env = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL as string,
  AWS_REGION: process.env.AWS_REGION || "us-east-1",
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME as string,
  SNS_TOPIC_ARN: process.env.SNS_TOPIC_ARN as string,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID as string,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL as string,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY as string,
};
