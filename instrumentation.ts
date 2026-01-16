/**
 * Next.js Instrumentation Hook
 *
 * This file is executed once when the Next.js server starts.
 * We use it to initialize cron jobs automatically.
 *
 * Documentation: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run in Node.js runtime (skip Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[INSTRUMENTATION] 🚀 Server starting, initializing cron jobs...');

    try {
      // Dynamically import to avoid issues with server-only code
      const { initializeServer } = await import('./src/lib/init-server');

      // Initialize cron jobs
      initializeServer();

      console.log('[INSTRUMENTATION] ✅ Cron jobs initialized successfully');
    } catch (error) {
      console.error('[INSTRUMENTATION] ❌ Failed to initialize cron jobs:', error);
      // Don't throw - let server start even if cron initialization fails
    }
  } else {
    console.log('[INSTRUMENTATION] ⏭️  Skipping cron initialization (not Node.js runtime)');
  }
}
