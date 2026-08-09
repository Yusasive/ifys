import { fetchSponsorApplicationStatus } from "@/lib/api";
import { SiteHeader } from "../site-header";
import { FormBackButton } from "../form-back-button";
import { StatusCard } from "../status-card";
import { SponsorForm } from "./sponsor-form";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

// Pause state is live backend state, not buildable at compile time — this
// page must be rendered per-request.
export const dynamic = "force-dynamic";

export default async function PartnerWithUsPage() {
  const { paused } = await fetchSponsorApplicationStatus(EVENT_SLUG);

  if (paused) {
    return (
      <>
        <SiteHeader />
        <main className="relative bg-white text-emerald flex-1 flex flex-col items-center px-4 pt-14 pb-10 sm:pb-14">
          <FormBackButton />
          <div className="w-full max-w-2xl">
            <StatusCard
              eyebrow="Partner With Us"
              subheading="Applications are paused"
              body="The form is not currently accepting applications. Please check back soon."
              icon="paused"
            />
          </div>
        </main>
      </>
    );
  }

  return <SponsorForm />;
}
