"use client";

import Link from "next/link";

import { listSentRequests } from "@/lib/api/sponsorshipRequests";
import { RequestListView } from "@/components/requests/request-list-view";
import { Button } from "@/components/ui/button";

/** `/club/requests`: sponsorship requests the club sent. */
export default function ClubRequestsPage() {
  return (
    <RequestListView
      side="Club"
      title="Requests"
      subtitle="Sponsorship requests you sent and where each one stands."
      loadingLabel="Loading your requests."
      errorTitle="Could not load your requests"
      emptyTitle="No requests yet."
      emptyMessage="A request asks a company to back one of your events. Find a company to start."
      emptyAction={
        <Button asChild size="lg" className="mt-1 h-10 sm:h-9">
          <Link href="/club/sponsors">Find sponsors</Link>
        </Button>
      }
      load={listSentRequests}
      hrefFor={(id) => `/club/requests/${encodeURIComponent(id)}`}
    />
  );
}
