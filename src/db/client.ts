/**
 * PostgreSQL Database Client
 *
 * Singleton connection pool for Yandex Cloud Managed PostgreSQL.
 * Uses node-postgres (pg) with connection pooling for optimal performance.
 */

import { Pool, PoolClient, QueryResult } from 'pg';

// Environment variables validation
function validateEnv() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_HOST) {
    throw new Error(
      'Missing required environment variables: DATABASE_URL or POSTGRES_HOST\n' +
      'Please check your .env.local file.'
    );
  }
}

// Connection pool configuration
function getPoolConfig() {
  // Option 1: Use DATABASE_URL if available (preferred for Yandex Cloud)
  if (process.env.DATABASE_URL) {
    // Parse DATABASE_URL to remove sslmode query parameter
    // We'll handle SSL separately to avoid conflicts
    let connectionString = process.env.DATABASE_URL;
    if (connectionString.includes('?sslmode=')) {
      connectionString = connectionString.split('?')[0];
    }

    return {
      connectionString,
      max: 20, // Reduced from 50 to avoid pool exhaustion
      min: 5,  // Reduced from 10
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: {
        rejectUnauthorized: false // Required for Yandex Cloud self-signed certs
      },
      application_name: 'wb-reputation-v2',
      client_encoding: 'UTF8', // Explicit UTF-8 encoding for Cyrillic support
    };
  }

  // Option 2: Use individual parameters
  return {
    host: process.env.POSTGRES_HOST!,
    port: parseInt(process.env.POSTGRES_PORT || '6432', 10),
    database: process.env.POSTGRES_DB!,
    user: process.env.POSTGRES_USER!,
    password: process.env.POSTGRES_PASSWORD!,
    max: 20, // Reduced from 50 to avoid pool exhaustion
    min: 5,  // Reduced from 10
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: {
      rejectUnauthorized: false
    },
    application_name: 'wb-reputation-v2',
    client_encoding: 'UTF8', // Explicit UTF-8 encoding for Cyrillic support
  };
}

// Singleton pool instance
// IMPORTANT: Use globalThis in development to survive HMR (Hot Module Replacement)
// In Next.js dev mode, modules are reloaded frequently, which would create new pools
// By storing in globalThis, we ensure only ONE pool exists across HMR cycles
const globalForPool = globalThis as unknown as {
  pgPool: Pool | undefined;
};

/**
 * Get or create the PostgreSQL connection pool
 * @returns Pool instance
 */
export function getPool(): Pool {
  // Check if pool already exists in globalThis (survives HMR)
  if (!globalForPool.pgPool) {
    validateEnv();
    const config = getPoolConfig();
    const newPool = new Pool(config);

    // Store in globalThis for HMR persistence
    globalForPool.pgPool = newPool;

    // Error handler for pool
    newPool.on('error', (err, client) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });

    // Log pool creation ONLY when actually creating a new pool
    if ('connectionString' in config && config.connectionString) {
      const url = new URL(config.connectionString);
      console.log('[PostgreSQL] ✅ NEW Connection pool created (singleton):', {
        host: url.hostname,
        port: url.port,
        database: url.pathname.slice(1),
        user: url.username,
        max: config.max,
      });
    } else if ('host' in config) {
      console.log('[PostgreSQL] ✅ NEW Connection pool created (singleton):', {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        max: config.max,
      });
    }
  }

  return globalForPool.pgPool;
}

/**
 * Execute a query with automatic connection management
 * @param text SQL query string
 * @param params Query parameters (parameterized queries)
 * @returns Query result
 */
export async function query<T extends Record<string, any> = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    // Log slow queries (> 1000ms)
    if (duration > 1000) {
      console.warn('[PostgreSQL] Slow query detected:', {
        duration: `${duration}ms`,
        query: text.substring(0, 100),
        rowCount: result.rowCount,
      });
    }

    return result;
  } catch (error: any) {
    console.error('[PostgreSQL] Query error:', {
      error: error.message,
      query: text.substring(0, 100),
      params: params ? JSON.stringify(params).substring(0, 100) : 'none',
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * Remember to call client.release() when done!
 * @returns PoolClient
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return await pool.connect();
}

/**
 * Execute a transaction with automatic rollback on error
 * @param callback Transaction callback function
 * @returns Result of the transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Test database connection
 * @returns true if connection successful, false otherwise
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as current_time, current_database() as database, current_user as user');
    console.log('[PostgreSQL] Connection test successful:', result.rows[0]);
    return true;
  } catch (error: any) {
    console.error('[PostgreSQL] Connection test failed:', error.message);
    return false;
  }
}

/**
 * Close the connection pool
 * Call this when shutting down the application
 */
export async function closePool(): Promise<void> {
  if (globalForPool.pgPool) {
    await globalForPool.pgPool.end();
    globalForPool.pgPool = undefined;
    console.log('[PostgreSQL] Connection pool closed');
  }
}

// Handle process termination
if (typeof process !== 'undefined') {
  process.on('SIGTERM', closePool);
  process.on('SIGINT', closePool);
}
