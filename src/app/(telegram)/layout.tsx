'use client';

import { TelegramAuthProvider } from '@/lib/telegram-auth-context';
import Script from 'next/script';
import './telegram.css';

export default function TelegramLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="tg-body">
        <TelegramAuthProvider>
          {children}
        </TelegramAuthProvider>
      </body>
    </html>
  );
}
