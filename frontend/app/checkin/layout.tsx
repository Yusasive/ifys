import { AdminAuthProvider } from "@/lib/admin-auth-context";

export default function CheckInLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <div className="min-h-screen bg-paper text-ink">{children}</div>
    </AdminAuthProvider>
  );
}
