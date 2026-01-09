/**
 * Additional filter logic for reviews (new status fields)
 * This module extends the filter capabilities in helpers.ts
 */

/**
 * Add new status filter clauses to WHERE conditions
 * @param whereClauses Array of WHERE clause strings to append to
 * @param params Array of query parameters to append to
 * @param paramIndex Current parameter index
 * @param options Filter options
 * @returns Updated paramIndex
 */
export function addReviewStatusFilters(
  whereClauses: string[],
  params: any[],
  paramIndex: number,
  options?: {
    reviewStatusWB?: string;
    productStatusByReview?: string;
    complaintStatus?: string;
  }
): number {
  let currentIndex = paramIndex;

  // Filter by review status on WB
  if (options?.reviewStatusWB && options.reviewStatusWB !== 'all') {
    whereClauses.push(`review_status_wb = $${currentIndex}`);
    params.push(options.reviewStatusWB);
    currentIndex++;
  }

  // Filter by product status (purchase/refusal)
  if (options?.productStatusByReview && options.productStatusByReview !== 'all') {
    whereClauses.push(`product_status_by_review = $${currentIndex}`);
    params.push(options.productStatusByReview);
    currentIndex++;
  }

  // Filter by complaint status (NEW: replaces hasComplaint logic)
  if (options?.complaintStatus && options.complaintStatus !== 'all') {
    whereClauses.push(`complaint_status = $${currentIndex}`);
    params.push(options.complaintStatus);
    currentIndex++;
  }

  return currentIndex;
}
