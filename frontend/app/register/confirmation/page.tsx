import { Suspense } from "react";
import { ConfirmationClient } from "./confirmation-client";
import { FormBackButton } from "../../form-back-button";

export const dynamic = "force-dynamic";

export default function ConfirmationPage() {
  return (
    <main className="relative bg-white text-emerald flex-1 flex flex-col items-center px-4 py-10 sm:py-14">
      <FormBackButton className="lg:left-56" />
      <div className="w-full max-w-2xl">
        <Suspense fallback={null}>
          <ConfirmationClient />
        </Suspense>
      </div>
    </main>
  );
}
