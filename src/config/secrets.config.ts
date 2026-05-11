import { getSecret } from '../app/middlewares/secretManager.service';

const SECRET_DB       = 'bookio/db';
const SECRET_FIREBASE = 'bookio/firebase';
const SECRET_SMTP     = 'bookio/smtp';

/**
 * En producción (NODE_ENV=production) inyecta las variables de entorno
 * leyéndolas directamente desde AWS Secrets Manager usando el LabInstanceProfile.
 *
 * En desarrollo usa el .env normal — no hace ninguna llamada a AWS.
 */
export const loadSecretsIntoEnv = async (): Promise<void> => {
  if (process.env.NODE_ENV !== 'production') return;

  console.log('[Secrets] Cargando variables desde AWS Secrets Manager...');

  const [dbRaw, firebaseRaw, smtpRaw] = await Promise.all([
    getSecret(SECRET_DB),
    getSecret(SECRET_FIREBASE),
    getSecret(SECRET_SMTP),
  ]);

  if (!dbRaw || !firebaseRaw || !smtpRaw) {
    throw new Error('[Secrets] No se pudieron obtener todos los secretos de AWS Secrets Manager.');
  }

  const db       = JSON.parse(dbRaw);
  const firebase = JSON.parse(firebaseRaw);
  const smtp     = JSON.parse(smtpRaw);

  // Inyectar directamente en process.env para que env.config.ts los lea
  process.env.DATABASE_URL         = db.url;
  process.env.FIREBASE_PROJECT_ID  = firebase.project_id;
  process.env.FIREBASE_CLIENT_EMAIL = firebase.client_email;
  process.env.FIREBASE_PRIVATE_KEY  = firebase.private_key;
  process.env.SMTP_USER             = smtp.smtp_user;
  process.env.SMTP_PASS             = smtp.smtp_pass;

  console.log('[Secrets] Variables de entorno cargadas correctamente desde Secrets Manager.');
};
