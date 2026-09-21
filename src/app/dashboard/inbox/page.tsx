"use client";

import { listInbox } from "@/lib/api/outreach";
import { ConversationListView } from "@/components/outreach/conversation-views";

/** `/dashboard/inbox`: invitations and conversations from organizations. */
export default function InboxPage() {
  return (
    <ConversationListView
      title="Inbox"
      subtitle="Invitations from organizations. You choose whether to reply."
      loadingLabel="Loading your inbox."
      errorTitle="Could not load your inbox"
      emptyTitle="No messages yet."
      emptyMessage="When an organization invites you, it shows up here."
      load={listInbox}
      hrefFor={(id) => `/dashboard/inbox/${encodeURIComponent(id)}`}
    />
  );
}
