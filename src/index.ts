import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { loadSecretsIntoEnv } from './config/secrets.config';
import { env } from './config/env.config';
import globalRouter from './app/routes';
import { prisma } from './database/prisma';
import { startSQSWorker } from './workers/sqs.worker';
import { metricsMiddleware } from './app/middlewares/metrics.middleware';

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5000",
    "http://bookio-static-website.s3-website-us-east-1.amazonaws.com",
    "https://bookio-static-website.s3.us-east-1.amazonaws.com",
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

app.use(express.json());
app.use(metricsMiddleware);
app.use('/api/v1', globalRouter);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Exportar para tests (Jest importa el módulo sin ejecutar el IIFE de abajo)
export default app;

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    // 1. En producción carga las vars desde Secrets Manager antes de usarlas.
    //    En desarrollo es un no-op; usa el .env directamente.
    await loadSecretsIntoEnv();

    // 2. Ahora que process.env tiene DATABASE_URL (del .env o de Secrets Manager),
    //    Prisma se inicializa de forma lazy en la primera llamada a $connect().
    await prisma.$connect();
    console.log('Database connected successfully');

    if (process.env.NODE_ENV === 'production') {
      startSQSWorker();
    }

    app.listen(env.PORT, () => {
      console.log(`[Server] Bookio Backend running on port ${env.PORT}`);
    });
  })().catch((err) => {
    console.error('[Startup] Fatal error:', err);
    process.exit(1);
  });
}
