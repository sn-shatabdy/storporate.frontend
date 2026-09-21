"use client";

import { useParams } from "next/navigation";

import { getOutreach, sendOutreachMessage } from "@/lib/api/outreach";
import { ConversationPageView } from "@/components/outreach/conversation-views";

/** `/employer/messages/{id}`: one conversation with a student. */
export default function EmployerConversationPage() {
  const params = useParams<{ id: string }>();
  return (
    <ConversationPageView
      role="employer"
      id={params?.id}
      backHref="/employer/messages"
      backLabel="Messages"
      loadingLabel="Loading the conversation."
      load={getOutreach}
      send={sendOutreachMessage}
    />
  );
}
