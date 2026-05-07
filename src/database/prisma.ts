import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Lazy initialization: el cliente se crea la primera vez que se usa,
// no cuando se importa este módulo. Así loadSecretsIntoEnv() puede
// inyectar DATABASE_URL antes de que Prisma lo lea.
const createClient = () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

let _instance: PrismaClient | undefined;

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    if (!_instance) _instance = createClient();
    const value = (_instance as any)[prop];
    return typeof value === 'function' ? value.bind(_instance) : value;
  },
});
