// ginagamit kang cart route para mag read and write kang PostgreSQL
// para maka build rapport sa database, eme
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

// maghimo prisma database client
const createPrismaClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

const globalForPrisma = globalThis as unknown as { // tells ts to treat globalthis as an object nga ga contain reusable prisma client
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient(); // gina export para magamit sa iba nga part ka back

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db; // store ya lang client sa globalthis para ma reuse imbes nga mahimo pa extra clients

// makita mo warning sa terminal
// kung deployed pwede makita to sa mga hosting providers