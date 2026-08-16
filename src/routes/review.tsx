import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  Ear,
  Layers,
  Mic,
  PenLine,
  Repeat,
  ShieldCheck,
  Sparkles,
  Type,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell, PageTitle } from "@/components/verba/AppShell";
import { useDeviceId } from "@/hooks/use-device-id";
import { getDueBreakdown } from "@/lib/verba/api";
import type { Skill } from "@/lib/verba/types";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review — Verba" },
      {
        name: "description",
        content:
          "Verba's review queue targets your weakest skills: writing, speaking, recall and tense forms that are due today.",
      },
      { property: "og:title", content: "Review — Verba" },
      {
        property: "og:description",
        content: "Review exactly what's due, prioritised by your real performance.",
      },
    ],
  }),
  component: ReviewPage,
});

const ROWS: { skill: Skill; icon: typeof PenLine; label: string }[] = [
  { skill: "recognition", icon: Type, label: "Words" },
  { skill: "sentence_usage", icon: BookOpen, label: "Sentences" },
  { skill: "writing", icon: PenLine, label: "Writing" },
  { skill: "speaking", icon: Mic, label: "Speaking" },
  { skill: "recall", icon: Repeat, label: "Recall" },
  { skill: "listening", icon: Ear, label: "Listening" },
  { skill: "form", icon: Layers, label: "Forms & tenses" },
];

function ReviewPage() {
  const deviceId = useDeviceId();
  const { data, isPending } = useQuery({
    queryKey: ["due", deviceId],
    queryFn: () => getDueBreakdown(deviceId as string),
    enabled: Boolean(deviceId),
  });

  const total = data?.total ?? 0;

  return (
    <AppShell>
      <PageTitle title="Review" subtitle="Weakest and most overdue items come first." />

      {isPending ? (
        <Skeleton className="h-48 rounded-3xl" />
      ) : (
        <div className="bg-hero-gradient animate-rise rounded-3xl p-6 text-primary-foreground shadow-glow">
          <p className="text-sm opacity-85">Ready for review</p>
          <p className="mt-1 text-4xl font-bold">{total} items</p>
          <p className="mt-2 text-sm opacity-85">
            {total === 0
              ? "You're all caught up. New items unlock as they become due."
              : "Each item is scheduled by your past answers, not by a fixed loop."}
          </p>
        </div>
      )}

      <ul className="mt-5 space-y-2">
        {ROWS.map(({ skill, icon: Icon, label }) => {
          const count = data?.bySkill[skill] ?? 0;
          return (
            <li key={skill} className="card-surface flex items-center gap-3 p-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-deep">
                <Icon className="size-5" />
              </span>
              <span className="flex-1 font-semibold">{label}</span>
              <span
                className={
                  count > 0
                    ? "text-sm font-bold text-primary"
                    : "text-sm font-semibold text-muted-foreground"
                }
              >
                {count}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
        Verba stores every attempt and mistake, so weak spellings get writing drills and weak
        pronunciation gets speaking drills.
      </p>

      {total > 0 ? (
        <Button asChild size="lg" className="mt-6 w-full rounded-2xl">
          <Link to="/practice" search={{ set: undefined }}>
            Start Review
          </Link>
        </Button>
      ) : (
        <Button asChild size="lg" variant="secondary" className="mt-6 w-full rounded-2xl">
          <Link to="/add">
            <Sparkles className="size-5" /> Add a new set
          </Link>
        </Button>
      )}
    </AppShell>
  );
}
