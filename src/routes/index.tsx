import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Flame, Plus, Sparkles, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/verba/AppShell";
import { MasteryBar } from "@/components/verba/MasteryPill";
import { useDeviceId } from "@/hooks/use-device-id";
import {
  ensureLearner,
  getDailyProgress,
  getDueBreakdown,
  listSets,
} from "@/lib/verba/api";
import { SKILL_LABEL } from "@/lib/verba/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Verba — Learn Words in Real Sentences" },
      {
        name: "description",
        content:
          "Verba turns the words you choose into sentences, listening, writing, speaking and recall drills with spaced repetition.",
      },
      { property: "og:title", content: "Verba — Learn Words in Real Sentences" },
      {
        property: "og:description",
        content: "Add 4 words, get sentences and daily practice built around your own vocabulary.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const deviceId = useDeviceId();
  const enabled = Boolean(deviceId);

  const { data: learner } = useQuery({
    queryKey: ["learner", deviceId],
    queryFn: () => ensureLearner(deviceId as string),
    enabled,
  });
  const { data: due } = useQuery({
    queryKey: ["due", deviceId],
    queryFn: () => getDueBreakdown(deviceId as string),
    enabled,
  });
  const { data: sets } = useQuery({
    queryKey: ["sets", deviceId],
    queryFn: () => listSets(deviceId as string),
    enabled,
  });
  const { data: today } = useQuery({
    queryKey: ["daily", deviceId],
    queryFn: () => getDailyProgress(deviceId as string),
    enabled,
  });

  const recent = sets?.[0];
  const goal = learner?.daily_goal_minutes ?? 15;
  const minutes = today?.minutes_practiced ?? 0;
  const goalPct = Math.min(100, Math.round((minutes / goal) * 100));

  return (
    <AppShell>
      <div className="bg-hero-gradient animate-rise -mx-5 -mt-6 rounded-b-4xl px-5 pt-8 pb-9 text-primary-foreground">
        <p className="text-sm opacity-85">Welcome back</p>
        <h1 className="mt-1 text-3xl font-bold">Verba</h1>

        <div className="mt-5 flex gap-3">
          <div className="flex-1 rounded-2xl bg-primary-foreground/12 p-4 backdrop-blur">
            <Flame className="size-5 text-accent" />
            <p className="mt-2 text-2xl font-bold">{learner?.streak ?? 0}</p>
            <p className="text-xs opacity-85">day streak</p>
          </div>
          <div className="flex-1 rounded-2xl bg-primary-foreground/12 p-4 backdrop-blur">
            <Target className="size-5 text-accent" />
            <p className="mt-2 text-2xl font-bold">
              {minutes}
              <span className="text-sm font-semibold opacity-80">/{goal}m</span>
            </p>
            <p className="text-xs opacity-85">daily goal · {goalPct}%</p>
          </div>
        </div>

        <Button
          asChild
          size="lg"
          className="mt-5 w-full rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Link to="/practice" search={{ set: undefined }}>
            {due && due.total > 0 ? `Practice ${due.total} due items` : "Start practicing"}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      <h2 className="mt-7 mb-3 text-lg font-bold">Today's review</h2>
      {due ? (
        <ul className="grid grid-cols-2 gap-2">
          {(Object.entries(due.bySkill) as [keyof typeof SKILL_LABEL, number][])
            .filter(([, count]) => count > 0)
            .map(([skill, count]) => (
              <li key={skill} className="card-surface flex items-center justify-between p-3.5">
                <span className="text-sm font-semibold">{SKILL_LABEL[skill]}</span>
                <span className="text-sm font-bold text-primary">{count}</span>
              </li>
            ))}
          {due.total === 0 ? (
            <li className="card-surface col-span-2 p-5 text-sm text-muted-foreground">
              Nothing due right now — add a new set to keep the momentum going.
            </li>
          ) : null}
        </ul>
      ) : (
        <Skeleton className="h-24 rounded-2xl" />
      )}

      <h2 className="mt-7 mb-3 text-lg font-bold">Continue learning</h2>
      {recent ? (
        <Link
          to="/sets/$setId"
          params={{ setId: recent.id }}
          className="card-surface animate-rise block p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-bold">{recent.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {recent.wordCount} words · {recent.dueCount} due
              </p>
            </div>
            <span className="text-lg font-bold text-primary">{recent.mastery}%</span>
          </div>
          <MasteryBar value={recent.mastery} className="mt-3" />
        </Link>
      ) : (
        <div className="card-surface p-6 text-center">
          <Sparkles className="mx-auto size-7 text-accent" />
          <p className="mt-3 text-sm font-semibold">No word sets yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add 4 or more words and Verba builds sentences and exercises for them.
          </p>
          <Button asChild className="mt-4 rounded-xl">
            <Link to="/add">
              <Plus className="size-4" /> Create your first set
            </Link>
          </Button>
        </div>
      )}
    </AppShell>
  );
}
