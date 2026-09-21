"use client";

import Link from "next/link";

import { listReceivedRequests } from "@/lib/api/sponsorshipRequests";
import { RequestListView } from "@/components/requests/request-list-view";
import { Button } from "@/components/ui/button";

/** `/employer/requests`: sponsorship requests clubs sent to the company. */
export default function EmployerRequestsPage() {
  return (
    <RequestListView
      side="Company"
      title="Requests"
      subtitle="Sponsorship requests from clubs. New ones are marked."
      loadingLabel="Loading requests."
      errorTitle="Could not load requests"
      emptyTitle="No requests yet."
      emptyMessage="Clubs send requests after they read your sponsorship goals."
      emptyAction={
        <Button asChild variant="outline" size="lg" className="mt-1 h-10 sm:h-9">
          <Link href="/employer/sponsorship">View your goals</Link>
        </Button>
      }
      load={listReceivedRequests}
      hrefFor={(id) => `/employer/requests/${encodeURIComponent(id)}`}
    />
  );
}
