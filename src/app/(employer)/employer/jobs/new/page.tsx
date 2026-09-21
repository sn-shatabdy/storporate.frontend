"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft } from "lucide-react";

import { createPosting, type JobPostingRequest } from "@/lib/api/jobPostings";
import { PostingForm } from "@/components/jobs/posting-form";

/** `/employer/jobs/new`: post a new job or internship. */
export default function NewPostingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  async function handleSubmit(request: JobPostingRequest) {
    if (!accessToken) throw new Error("Not signed in");
    await createPosting(accessToken, request);
    router.push("/employer/jobs?saved=created");
  }

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
        <div>
          <Link
            href="/employer/jobs"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Your openings
          </Link>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Post an opening
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Students see this right away and can check how their skills fit.
          </p>
        </div>
        <PostingForm
          submitLabel="Post opening"
          cancelHref="/employer/jobs"
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
