"use client";

import { useParams } from "next/navigation";

import {
  declineInvitation,
  getInboxConversation,
  replyToInvitation,
} from "@/lib/api/outreach";
import { ConversationPageView } from "@/components/outreach/conversation-views";

/** `/dashboard/inbox/{id}`: one invitation or conversation. */
export default function InboxConversationPage() {
  const params = useParams<{ id: string }>();
  return (
    <ConversationPageView
      role="student"
      id={params?.id}
      backHref="/dashboard/inbox"
      backLabel="Inbox"
      loadingLabel="Loading the conversation."
      load={getInboxConversation}
      send={replyToInvitation}
      decline={declineInvitation}
    />
  );
}
