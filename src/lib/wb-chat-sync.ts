/**
 * WB Chat API Sync Helpers
 * Utilities for fetching full chat history from Wildberries API
 */

export interface WBChat {
  chatID: string;
  clientName: string;
  replySign: boolean;
  goodCard?: {
    nmID: number;
  };
}

export interface WBMessage {
  id: string;
  chatID: string;
  text: string;
  sender: 'client' | 'seller';
  addTime: string; // ISO timestamp
}

/**
 * Fetch all active chats from WB API
 */
export async function fetchWBAllChats(token: string): Promise<WBChat[]> {
  const response = await fetch('https://buyer-chat-api.wildberries.ru/api/v1/seller/chats', {
    headers: { 'Authorization': token },
    signal: AbortSignal.timeout(30000), // 30s timeout
  });

  if (!response.ok) {
    throw new Error(`WB API error (chats list): ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.result || [];
}

/**
 * Fetch ALL events (messages) from WB API
 * NOTE: WB API doesn't have /chats/{id}/messages endpoint
 * We must use /events and load everything from scratch
 */
export async function fetchWBAllEvents(token: string, startCursor: string | null = null): Promise<any[]> {
  let allEvents: any[] = [];
  let next = startCursor;
  let hasMore = true;
  let pageCount = 0;
  const MAX_PAGES = 1000; // Safety limit

  console.log(`[WB] Fetching events from cursor: ${next || 'beginning'}...`);

  while (hasMore && pageCount < MAX_PAGES) {
    const url = new URL('https://buyer-chat-api.wildberries.ru/api/v1/seller/events');
    if (next) url.searchParams.set('next', next);

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': token },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`WB API error (events): ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const events = (Array.isArray(data.result?.events) ? data.result.events : []) || [];

    allEvents.push(...events);
    pageCount++;

    const newNext = data.result?.next;
    hasMore = !!newNext && events.length > 0 && newNext !== next;

    if (hasMore) {
      next = newNext;
      console.log(`  Page ${pageCount}: ${events.length} events, continuing...`);
      await sleep(1500); // Rate limiting
    } else {
      console.log(`  Page ${pageCount}: ${events.length} events, done.`);
    }
  }

  console.log(`[WB] ✅ Total events fetched: ${allEvents.length} (${pageCount} pages)\n`);
  return allEvents;
}

/**
 * Sleep utility for rate limiting
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry helper with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on 404 (chat deleted)
      if (error.message?.includes('404')) {
        throw error;
      }

      // Exponential backoff: 1s → 2s → 4s
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[RETRY] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError || new Error('Max retries exceeded');
}
