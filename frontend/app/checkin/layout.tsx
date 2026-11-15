import { Metadata } from "next";
import { AdminAuthProvider } from "@/lib/admin-auth-context";

export const metadata: Metadata = {
  title: "Check-in",
};

export default function CheckInLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
