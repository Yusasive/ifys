import { Metadata } from "next";
import { fetchVolunteerApplicationStatus } from "@/lib/api";
import { SiteHeader } from "../site-header";
import { FormBackButton } from "../form-back-button";
import { StatusCard } from "../status-card";
import { VolunteerForm } from "./volunteer-form";

export const metadata: Metadata = {
  title: "Volunteer",
};

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

// Pause state is live backend state, not buildable at compile time — this
// page must be rendered per-request.
export const dynamic = "force-dynamic";

export default async function VolunteerPage() {
  const { paused } = await fetchVolunteerApplicationStatus(EVENT_SLUG);

  if (paused) {
    return (
      <div className="flex-1 flex flex-col">
        <SiteHeader showJoinTeam={false} />
        <main className="relative bg-white text-emerald flex-1 flex flex-col items-center justify-center px-4 pt-14 pb-10">
          <FormBackButton />
          <div className="w-full max-w-lg">
            <StatusCard
              eyebrow="Volunteer Registration"
              subheading="Applications are paused"
              body="The form is not currently accepting applications. Please check back soon."
              icon="paused"
            />
          </div>
        </main>
      </div>
    );
  }

  return <VolunteerForm />;
}
