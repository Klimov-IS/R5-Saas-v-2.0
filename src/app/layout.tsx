import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { ProgressWidgetContainer } from "@/components/sync/ProgressWidgetContainer";
import { QueryProvider } from "@/lib/query-provider";
import Link from "next/link";

export const metadata: Metadata = {
  title: "WB Reputation Manager",
  description: "Управление репутацией WB магазинов",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <QueryProvider>
          {children}
          <Toaster />
          <ToastProvider />
          <ProgressWidgetContainer />
        </QueryProvider>
      </body>
    </html>
  );
}
