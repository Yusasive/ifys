import { AdminAuthProvider } from "@/lib/admin-auth-context";

export default function CheckInLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <div className="min-h-screen bg-white text-emerald">{children}</div>
    </AdminAuthProvider>
  );
}
