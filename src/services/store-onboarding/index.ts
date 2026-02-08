/**
 * Store Onboarding Service
 *
 * Automatically creates Google Drive resources for new stores:
 * - Client folder
 * - Report spreadsheet from template
 * - Screenshots folder
 * - Updates client directory sheet
 */

export {
  onboardStore,
  triggerStoreOnboarding,
  isOnboardingConfigured
} from './onboarding-service';

export type {
  OnboardingResult,
  OnboardingStatus,
  StoreDriveLinks,
  OnboardingConfig
} from './types';
