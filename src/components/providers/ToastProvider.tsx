'use client';

import { Toaster } from 'react-hot-toast';

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'white',
          color: '#1e293b',
          fontSize: '14px',
          border: '1px solid #e2e8f0',
          padding: '12px 16px',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        },
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: 'white',
          },
        },
        error: {
          duration: 6000,
          iconTheme: {
            primary: '#ef4444',
            secondary: 'white',
          },
        },
        loading: {
          iconTheme: {
            primary: '#3b82f6',
            secondary: 'white',
          },
        },
      }}
    />
  );
}
