/**
 * Auth layout — minimal wrapper without sidebar/nav.
 * Used for /login and /register pages.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      {children}
    </div>
  );
}
