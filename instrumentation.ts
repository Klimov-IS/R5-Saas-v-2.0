/**
 * Next.js Instrumentation Hook
 *
 * This file is executed once when the Next.js server starts.
 * We use it to initialize cron jobs automatically.
 *
 * Documentation: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

// Add explicit logging at file load time
console.log('[INSTRUMENTATION] 📂 File loaded at:', new Date().toISOString());
console.log('[INSTRUMENTATION] 📊 Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_RUNTIME: process.env.NEXT_RUNTIME,
});

export async function register() {
  console.log('[INSTRUMENTATION] 🔧 register() function called');
  console.log('[INSTRUMENTATION] 📊 Runtime check:', process.env.NEXT_RUNTIME);

  // Only run in Node.js runtime (skip Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[INSTRUMENTATION] 🚀 Server starting, initializing cron jobs...');

    try {
      // Dynamically import to avoid issues with server-only code
      console.log('[INSTRUMENTATION] 📥 Importing init-server module...');
      const { initializeServer } = await import('./src/lib/init-server');

      console.log('[INSTRUMENTATION] ▶️  Calling initializeServer()...');
      // Initialize cron jobs
      initializeServer();

      console.log('[INSTRUMENTATION] ✅ Cron jobs initialized successfully');
    } catch (error) {
      console.error('[INSTRUMENTATION] ❌ Failed to initialize cron jobs:', error);
      console.error('[INSTRUMENTATION] 📋 Error stack:', error instanceof Error ? error.stack : 'No stack');
      // Don't throw - let server start even if cron initialization fails
    }
  } else {
    console.log('[INSTRUMENTATION] ⏭️  Skipping cron initialization (not Node.js runtime)');
    console.log('[INSTRUMENTATION] 🔍 Actual NEXT_RUNTIME value:', process.env.NEXT_RUNTIME);
  }
}
