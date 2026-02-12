/**
 * OZON Seller API Client
 *
 * HTTP client for OZON Seller API (https://api-seller.ozon.ru).
 * Auth: Client-Id + Api-Key headers. All requests are POST with JSON body.
 *
 * Rate limit: 50 req/sec (very generous).
 * Retry: 1 retry on 5xx, no retry on 4xx.
 *
 * Based on real API testing (2026-02-12) — see docs/product-specs/OZON/OZON-SELLER-API.md
 */

const OZON_BASE_URL = 'https://api-seller.ozon.ru';

// ============================================================================
// Types — based on real API responses, NOT official docs
// ============================================================================

export interface OzonClientConfig {
  clientId: string;
  apiKey: string;
}

/** POST /v1/seller/info */
export interface OzonSellerInfo {
  company: {
    name: string;
    display_name: string;
    inn: string;
    registration_date: string;
  };
  subscription: {
    type: string; // 'PREMIUM' | 'PREMIUM_PLUS' | 'PREMIUM_PRO'
    start_date: string;
    end_date: string;
  };
  ratings: Array<{
    group_name: string;
    rating_name: string;
    current_value: number;
    past_value: number;
  }>;
}

/** POST /v1/roles */
export interface OzonRole {
  id: number;
  name: string;
}

/** POST /v3/product/list — single item */
export interface OzonProductListItem {
  product_id: number;
  offer_id: string;
  is_fbo_visible: boolean;
  is_fbs_visible: boolean;
  archived: boolean;
  has_fbo_stocks: boolean;
  has_fbs_stocks: boolean;
}

/** POST /v3/product/info/list — full product info */
export interface OzonProductInfo {
  id: number;
  name: string;
  offer_id: string;
  barcode: string;
  description_category_id: number;
  type_id: number;
  created_at: string;
  images: string[];
  primary_image: string;
  price: string;
  old_price: string;
  marketing_price: string;
  min_price: string;
  currency_code: string;
  sources: Array<{
    source: string; // 'sds' (=FBO) or 'fbs'
    sku: number;
  }>;
  stocks: {
    coming: number;
    present: number;
    reserved: number;
  };
  visible_ids: number[];
  status: {
    state: string;
    state_failed: string;
    moderate_status: string;
    decline_reasons: string[];
    validation_state: string;
    state_name: string;
    state_description: string;
    is_failed: boolean;
    is_created: boolean;
    state_tooltip: string;
    item_errors: any[];
    state_updated_at: string;
  };
}

/** POST /v1/product/info/description */
export interface OzonProductDescription {
  id: number;
  offer_id: string;
  name: string;
  description: string;
}

/** POST /v1/rating/summary — single rating */
export interface OzonRating {
  group_name: string;
  rating_name: string;
  current_value: number;
  past_value: number;
  rating_direction: string;
  values: Array<{
    status: { key: string; value: string };
    value: number;
  }>;
  threshold: { key: string; value: number };
  danger_threshold: { key: string; value: number };
}

/** POST /v1/rating/history — single data point */
export interface OzonRatingHistoryItem {
  date: string;
  rating: number;
}

// ============================================================================
// Client
// ============================================================================

export class OzonApiClient {
  private clientId: string;
  private apiKey: string;

  constructor(config: OzonClientConfig) {
    this.clientId = config.clientId;
    this.apiKey = config.apiKey;
  }

  /**
   * Low-level POST request to OZON API.
   * Handles JSON serialization, error handling, and 1 retry on 5xx.
   */
  private async post<T>(path: string, body: Record<string, any> = {}): Promise<T> {
    const url = `${OZON_BASE_URL}${path}`;
    const headers = {
      'Client-Id': this.clientId,
      'Api-Key': this.apiKey,
      'Content-Type': 'application/json',
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (res.status >= 400 && res.status < 500) {
          // 4xx — client error, no retry
          const errorText = await res.text();
          throw new OzonApiError(
            `OZON API ${path}: ${res.status} — ${errorText.slice(0, 500)}`,
            res.status,
            path
          );
        }

        if (res.status >= 500) {
          // 5xx — server error, retry once
          const errorText = await res.text();
          lastError = new OzonApiError(
            `OZON API ${path}: ${res.status} — ${errorText.slice(0, 500)}`,
            res.status,
            path
          );
          if (attempt === 0) {
            console.warn(`[OZON-API] 5xx on ${path}, retrying in 1s...`);
            await sleep(1000);
            continue;
          }
          throw lastError;
        }

        const data = await res.json();
        return data as T;
      } catch (err) {
        if (err instanceof OzonApiError) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt === 0) {
          console.warn(`[OZON-API] Network error on ${path}, retrying in 1s...`);
          await sleep(1000);
          continue;
        }
      }
    }

    throw lastError || new Error(`OZON API ${path}: unknown error`);
  }

  // ========================================================================
  // Store / Auth
  // ========================================================================

  /**
   * Get seller info: company name, subscription, ratings.
   * Used for onboarding validation.
   */
  async getSellerInfo(): Promise<OzonSellerInfo> {
    return this.post<OzonSellerInfo>('/v1/seller/info');
  }

  /**
   * Get seller roles — validates API key is correct.
   * Returns array of roles (e.g. [{id: 1, name: "Admin"}]).
   */
  async getRoles(): Promise<OzonRole[]> {
    const data = await this.post<{ result?: OzonRole[] }>('/v1/roles');
    return data.result || [];
  }

  // ========================================================================
  // Products
  // ========================================================================

  /**
   * List all products (paginated by last_id).
   * Returns product_id + offer_id + stock flags.
   *
   * @param limit - Max items per page (default 100)
   * @param lastId - Pagination cursor (empty string for first page)
   */
  async getProducts(
    limit: number = 100,
    lastId: string = ''
  ): Promise<{
    items: OzonProductListItem[];
    total: number;
    lastId: string;
  }> {
    const data = await this.post<{
      result: {
        items: OzonProductListItem[];
        total: number;
        last_id: string;
      };
    }>('/v3/product/list', {
      filter: {},
      limit,
      last_id: lastId,
    });

    return {
      items: data.result.items,
      total: data.result.total,
      lastId: data.result.last_id,
    };
  }

  /**
   * Get full product info for multiple products (batch).
   * Max 20 products per request.
   *
   * @param productIds - Array of OZON product_id (numbers)
   */
  async getProductInfo(productIds: number[]): Promise<OzonProductInfo[]> {
    const data = await this.post<{ items: OzonProductInfo[] }>(
      '/v3/product/info/list',
      {
        offer_id: [],
        product_id: productIds,
        sku: [],
      }
    );
    return data.items;
  }

  /**
   * Get product description (HTML).
   * One product at a time.
   *
   * @param productId - OZON product_id (number)
   */
  async getProductDescription(
    productId: number
  ): Promise<OzonProductDescription> {
    const data = await this.post<{ result: OzonProductDescription }>(
      '/v1/product/info/description',
      { product_id: productId }
    );
    return data.result;
  }

  /**
   * Get ALL products with full info.
   * Handles pagination + batching automatically.
   */
  async getAllProductsWithInfo(): Promise<OzonProductInfo[]> {
    const allProducts: OzonProductListItem[] = [];
    let lastId = '';

    // Step 1: Paginate through product list
    while (true) {
      const page = await this.getProducts(100, lastId);
      allProducts.push(...page.items);

      if (page.items.length < 100 || !page.lastId) break;
      lastId = page.lastId;
    }

    if (allProducts.length === 0) return [];

    // Step 2: Get full info in batches of 20
    const allInfo: OzonProductInfo[] = [];
    const productIds = allProducts.map((p) => p.product_id);

    for (let i = 0; i < productIds.length; i += 20) {
      const batch = productIds.slice(i, i + 20);
      const info = await this.getProductInfo(batch);
      allInfo.push(...info);
    }

    return allInfo;
  }

  // ========================================================================
  // Ratings
  // ========================================================================

  /**
   * Get current rating summary.
   * Returns all rating groups and their values.
   */
  async getRatingSummary(): Promise<OzonRating[]> {
    const data = await this.post<{ groups: OzonRating[] }>(
      '/v1/rating/summary'
    );
    return data.groups;
  }

  /**
   * Get rating history over a date range.
   *
   * @param dateFrom - Start date (ISO string)
   * @param dateTo - End date (ISO string)
   * @param ratings - Rating names to query (e.g. ['rating_review_avg_score_total'])
   */
  async getRatingHistory(
    dateFrom: string,
    dateTo: string,
    ratings: string[]
  ): Promise<Record<string, OzonRatingHistoryItem[]>> {
    const data = await this.post<{
      ratings: Record<string, OzonRatingHistoryItem[]>;
    }>('/v1/rating/history', {
      date_from: dateFrom,
      date_to: dateTo,
      ratings,
      with_premium_scores: true,
    });
    return data.ratings;
  }
}

// ============================================================================
// Error class
// ============================================================================

export class OzonApiError extends Error {
  public status: number;
  public path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = 'OzonApiError';
    this.status = status;
    this.path = path;
  }

  /** True if this error is a Premium Plus restriction (403) */
  get isPremiumPlusRequired(): boolean {
    return this.status === 403;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create an OZON API client from store credentials.
 * Convenience factory for use in cron jobs and API routes.
 */
export function createOzonClient(
  ozonClientId: string,
  ozonApiKey: string
): OzonApiClient {
  return new OzonApiClient({
    clientId: ozonClientId,
    apiKey: ozonApiKey,
  });
}
