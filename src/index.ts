import express from 'express';
import cors from 'cors';
import { env } from './config/env.config';
import globalRouter from './app/routes';

const app = express();

app.use(cors());
app.use(express.json());

// Main Router
app.use('/api/v1', globalRouter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

import { prisma } from './database/prisma';

const PORT = env.PORT;

if (process.env.NODE_ENV !== 'test') {
  prisma.$connect()
    .then(() => {
      console.log('Database connected successfully');
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error('Failed to connect to the database:', error);
      process.exit(1);
    });
}

export default app;
