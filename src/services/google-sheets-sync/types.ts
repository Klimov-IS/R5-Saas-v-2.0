/**
 * Google Sheets Sync Types
 * Types for product rules export to Google Sheets
 */

export interface SheetRow {
  storeName: string;
  articleWb: string;
  productName: string;
  productStatus: string;
  // Жалобы
  complaintsEnabled: boolean;
  complaintRating1: boolean;
  complaintRating2: boolean;
  complaintRating3: boolean;
  complaintRating4: boolean;
  // Чаты
  chatsEnabled: boolean;
  chatRating1: boolean;
  chatRating2: boolean;
  chatRating3: boolean;
  chatRating4: boolean;
  chatStrategy: string;
  // Компенсация
  compensationEnabled: boolean;
  compensationType: string;
  maxCompensation: string;
  compensationBy: string;
  // Метаданные
  updatedAt: string;
}

export interface SyncResult {
  success: boolean;
  rowsWritten: number;
  storesProcessed: number;
  productsProcessed: number;
  duration_ms: number;
  error?: string;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName: string;
  serviceAccountEmail: string;
  privateKey: string;
}
