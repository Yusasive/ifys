import { AdminAuthProvider } from "@/lib/admin-auth-context";
import { ToastProvider } from "@/lib/toast-context";
import { AdminShell } from "./admin-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <ToastProvider>
        <div className="min-h-screen bg-white text-ink font-sans">
          <AdminShell>{children}</AdminShell>
        </div>
      </ToastProvider>
    </AdminAuthProvider>
  );
}
