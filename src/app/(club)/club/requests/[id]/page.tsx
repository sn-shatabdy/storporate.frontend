"use client";

import { useParams } from "next/navigation";

import {
  completeSentRequest,
  getSentRequest,
  sendSentRequestMessage,
} from "@/lib/api/sponsorshipRequests";
import { RequestDetailView } from "@/components/requests/request-detail-view";

/** `/club/requests/{id}`: one request the club sent. */
export default function ClubRequestPage() {
  const params = useParams<{ id: string }>();
  return (
    <RequestDetailView
      side="Club"
      id={params?.id}
      backHref="/club/requests"
      backLabel="Requests"
      loadingLabel="Loading the request."
      load={getSentRequest}
      send={sendSentRequestMessage}
      complete={completeSentRequest}
    />
  );
}
