import { Metadata } from "next";
import { AdminAuthProvider } from "@/lib/admin-auth-context";

export const metadata: Metadata = {
  title: "Check-in",
};

// This page authenticates with useRequireAdminAuth/useAdminAuth (it's a
// door-staff tool gated the same way as /admin), but sits outside the
// /admin route tree, so it needs its own AdminAuthProvider rather than
// inheriting one from app/admin/layout.tsx.
export default function CheckInLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
