import "dotenv/config";

// Getters: cada propiedad lee process.env en el momento en que se accede,
// no cuando se importa este módulo. Esto permite que loadSecretsIntoEnv()
// inyecte los valores de Secrets Manager antes de que se usen por primera vez.
export const env = {
  get PORT()                { return Number(process.env.PORT) || 3000; },
  get NODE_ENV()            { return process.env.NODE_ENV || "development"; },
  get DATABASE_URL()        { return process.env.DATABASE_URL as string; },
  get AWS_REGION()          { return process.env.AWS_REGION || "us-east-1"; },
  // En EC2 no se setean — el SDK las obtiene automáticamente del LabInstanceProfile
  get AWS_ACCESS_KEY_ID()   { return process.env.AWS_ACCESS_KEY_ID; },
  get AWS_SECRET_ACCESS_KEY(){ return process.env.AWS_SECRET_ACCESS_KEY; },
  get AWS_SESSION_TOKEN()   { return process.env.AWS_SESSION_TOKEN; },
  get S3_BUCKET_NAME()      { return process.env.S3_BUCKET_NAME as string; },
  get SQS_QUEUE_URL()       { return process.env.SQS_QUEUE_URL as string; },
  get SMTP_USER()           { return process.env.SMTP_USER as string; },
  get SMTP_PASS()           { return process.env.SMTP_PASS as string; },
  get FIREBASE_PROJECT_ID() { return process.env.FIREBASE_PROJECT_ID as string; },
  get FIREBASE_CLIENT_EMAIL(){ return process.env.FIREBASE_CLIENT_EMAIL as string; },
  get FIREBASE_PRIVATE_KEY() { return process.env.FIREBASE_PRIVATE_KEY as string; },
};
