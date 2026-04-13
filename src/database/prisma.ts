import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Using local process.env.DATABASE_URL or default to a dummy string to avoid crashing immediately in test without env setup.
const url = process.env.DATABASE_URL;

const pool = new Pool({ connectionString: url });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
