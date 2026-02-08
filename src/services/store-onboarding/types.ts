/**
 * Types for Store Onboarding Service
 */

/**
 * Result of store onboarding
 */
export interface OnboardingResult {
  success: boolean;
  storeId: string;
  storeName: string;
  folderId?: string;
  folderLink?: string;
  reportId?: string;
  reportLink?: string;
  screenshotsId?: string;
  screenshotsLink?: string;
  error?: string;
  duration_ms: number;
}

/**
 * Onboarding status values
 */
export type OnboardingStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Store Drive links update
 */
export interface StoreDriveLinks {
  drive_folder_id?: string;
  drive_report_id?: string;
  drive_screenshots_id?: string;
  onboarding_status?: OnboardingStatus;
  onboarding_error?: string;
  onboarded_at?: string;
}

/**
 * Configuration for onboarding
 */
export interface OnboardingConfig {
  clientsFolderId: string;
  reportTemplateId: string;
}
