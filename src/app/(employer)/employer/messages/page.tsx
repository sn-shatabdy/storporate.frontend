"use client";

import { listMyOutreach } from "@/lib/api/outreach";
import { ConversationListView } from "@/components/outreach/conversation-views";

/** `/employer/messages`: conversations the organization started. */
export default function EmployerMessagesPage() {
  return (
    <ConversationListView
      title="Messages"
      subtitle="Invitations you sent and how each student answered."
      loadingLabel="Loading your messages."
      errorTitle="Could not load your messages"
      emptyTitle="No conversations yet."
      emptyMessage="Invite a student from your shortlist or search results."
      load={listMyOutreach}
      hrefFor={(id) => `/employer/messages/${encodeURIComponent(id)}`}
    />
  );
}
