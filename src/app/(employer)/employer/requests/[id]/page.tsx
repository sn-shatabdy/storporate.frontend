"use client";

import { useParams } from "next/navigation";

import {
  acceptRequest,
  completeReceivedRequest,
  declineRequest,
  getReceivedRequest,
  sendReceivedRequestMessage,
} from "@/lib/api/sponsorshipRequests";
import { RequestDetailView } from "@/components/requests/request-detail-view";

/** `/employer/requests/{id}`: one request a club sent. Opening it marks it viewed. */
export default function EmployerRequestPage() {
  const params = useParams<{ id: string }>();
  return (
    <RequestDetailView
      side="Company"
      id={params?.id}
      backHref="/employer/requests"
      backLabel="Requests"
      loadingLabel="Loading the request."
      load={getReceivedRequest}
      send={sendReceivedRequestMessage}
      accept={acceptRequest}
      decline={declineRequest}
      complete={completeReceivedRequest}
    />
  );
}
