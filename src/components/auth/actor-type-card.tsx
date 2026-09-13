import { Briefcase, Check, GraduationCap, Landmark, Users, type LucideIcon } from "lucide-react";

import type { ActorType } from "@/lib/api/auth";

export const ACTOR_TYPE_META: Record<ActorType, { title: string; description: string; icon: LucideIcon }> = {
  Student: {
    title: "Student",
    description: "Build your profile, collect verified evidence of your work, and get discovered.",
    icon: GraduationCap,
  },
  Organization: {
    title: "Organization",
    description: "Discover and evaluate students with real, verified proof of their skills.",
    icon: Briefcase,
  },
  University: {
    title: "University",
    description: "Manage your institution's presence and support your students.",
    icon: Landmark,
  },
  Club: {
    title: "Club",
    description: "Run your club's activities and help members showcase their contributions.",
    icon: Users,
  },
};

interface ActorTypeCardProps {
  type: ActorType;
  selected: boolean;
  onSelect: (type: ActorType) => void;
}

export function ActorTypeCard({ type, selected, onSelect }: ActorTypeCardProps) {
  const { title, description, icon: Icon } = ACTOR_TYPE_META[type];

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(type)}
      className="relative flex flex-col items-start gap-2.5 rounded-2xl border-2 p-4 text-left transition-colors outline-none focus-visible:ring-4 focus-visible:ring-[var(--auth-accent)]/25"
      style={{
        borderColor: selected ? "var(--auth-accent)" : "var(--auth-border)",
        backgroundColor: selected ? "color-mix(in oklab, var(--auth-accent) 8%, var(--auth-card-bg))" : "var(--auth-card-bg)",
      }}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: "var(--auth-accent)" }}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      )}
      <span
        aria-hidden
        className="flex size-11 items-center justify-center rounded-xl"
        style={{ backgroundColor: "var(--auth-tint-1)", color: "var(--auth-accent)" }}
      >
        <Icon className="size-5" />
      </span>
      <span className="font-heading-auth text-[16.5px] font-semibold" style={{ color: "var(--auth-text-primary)" }}>
        {title}
      </span>
      <span className="text-[13px] leading-snug" style={{ color: "var(--auth-text-muted)" }}>
        {description}
      </span>
    </button>
  );
}
