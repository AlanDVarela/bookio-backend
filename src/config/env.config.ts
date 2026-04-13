import "dotenv/config";

export const env = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL as string,
  JWT_SECRET: process.env.JWT_SECRET || "super-secret-default",
  AWS_REGION: process.env.AWS_REGION || "us-east-1",
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME as string,
  SNS_TOPIC_ARN: process.env.SNS_TOPIC_ARN as string,
};
