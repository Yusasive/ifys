import { AdminAuthProvider } from "@/lib/admin-auth-context";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <div className="min-h-screen bg-paper text-ink font-sans">{children}</div>
    </AdminAuthProvider>
  );
}
