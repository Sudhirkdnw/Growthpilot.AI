import { PrismaClient } from '@prisma/client';
import path from 'path';

// Singleton instance of PrismaClient
let prisma: PrismaClient | null = null;

export function getDatabaseFilePath(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && envUrl.startsWith('file:')) {
    const rawPath = envUrl.replace(/^file:/, '');
    // In Prisma, SQLite file URLs are relative to the prisma/ directory
    if (rawPath.startsWith('.')) {
      return path.resolve(process.cwd(), 'prisma', rawPath);
    }
    return path.resolve(process.cwd(), rawPath);
  }
  return path.resolve(process.cwd(), 'data', 'rs_inventory.db');
}

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    // In production desktop environment, point to the userData data path
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prisma;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch (err) {
      console.warn('[DB] Error during prisma disconnect:', err);
    } finally {
      prisma = null;
    }
  }
}

/**
 * Configure SQLite PRAGMAs:
 * - WAL (Write-Ahead Logging) mode for concurrent read operations
 * - busy_timeout = 5000ms for busy handling
 * - foreign_keys = ON for relational integrity
 * - synchronous = NORMAL for high-performance durability
 */
export async function initializeDatabasePragmas(): Promise<void> {
  const client = getPrismaClient();
  try {
    await client.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`);
    await client.$queryRawUnsafe(`PRAGMA busy_timeout = 5000;`);
    await client.$queryRawUnsafe(`PRAGMA foreign_keys = ON;`);
    await client.$queryRawUnsafe(`PRAGMA synchronous = NORMAL;`);
    console.log('[DB] SQLite WAL mode, foreign keys, and 5000ms busy timeout enabled.');
  } catch (error) {
    console.error('[DB] Failed to configure SQLite pragmas:', error);
    throw error;
  }
}

/**
 * In-process Write Queue to serialize state-modifying database transactions.
 * Concurrent reads bypass this queue, ensuring high read concurrency.
 */
class WriteQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private isPaused = false;

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    this.processNext();
  }

  get paused(): boolean {
    return this.isPaused;
  }

  async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isPaused) {
      throw new Error('Database write operations are temporarily paused for system maintenance or database restore.');
    }
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeWithRetry(operation);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.isPaused || this.queue.length === 0) return;
    this.processing = true;

    const nextOp = this.queue.shift();
    if (nextOp) {
      try {
        await nextOp();
      } catch (err) {
        // Individual op error handled in promise rejection
      } finally {
        this.processing = false;
        this.processNext();
      }
    } else {
      this.processing = false;
    }
  }

  /**
   * Execute with safe exponential backoff for transient SQLITE_BUSY / SQLITE_LOCKED conditions.
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 5,
    initialDelayMs = 50
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (error: any) {
        attempt++;
        const isBusyError =
          error?.message?.includes('SQLITE_BUSY') ||
          error?.message?.includes('database is locked') ||
          error?.code === 'P2034'; // Prisma transaction conflict

        if (isBusyError && attempt < maxRetries) {
          const delay = initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 20;
          console.warn(`[DB] SQLite busy/locked on attempt ${attempt}. Retrying in ${Math.round(delay)}ms...`);
          await new Promise((res) => setTimeout(res, delay));
        } else {
          throw error;
        }
      }
    }
    throw new Error('Database write operation exceeded maximum retry attempts');
  }
}

export const dbWriteQueue = new WriteQueue();

/**
 * Execute an atomic transaction through the serialized write queue.
 */
export async function executeWriteTransaction<T>(
  txCallback: (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => Promise<T>
): Promise<T> {
  const client = getPrismaClient();
  return dbWriteQueue.enqueue(async () => {
    return await client.$transaction(async (tx) => {
      return await txCallback(tx);
    }, {
      timeout: 10000,
      maxWait: 5000,
    });
  });
}
