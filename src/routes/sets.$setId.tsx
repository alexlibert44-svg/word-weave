import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/verba/AppShell";
import { MasteryBar, MasteryPill } from "@/components/verba/MasteryPill";
import { useDeviceId } from "@/hooks/use-device-id";
import { getSet } from "@/lib/verba/api";
import { isDue } from "@/lib/verba/srs";

export const Route = createFileRoute("/sets/$setId")({
  head: () => ({
    meta: [
      { title: "Word Set — Verba" },
      {
        name: "description",
        content:
          "Inside a Verba word set: every word with its own mastery level, reviews due and practice entry point.",
      },
      { property: "og:title", content: "Word Set — Verba" },
      {
        property: "og:description",
        content: "See mastery per word and start practicing this set.",
      },
    ],
  }),
  component: SetDetailPage,
  errorComponent: ({ error }) => (
    <AppShell>
      <p role="alert" className="text-sm text-muted-foreground">
        {error.message}
      </p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p>This set no longer exists.</p>
    </AppShell>
  ),
});

function SetDetailPage() {
  const { setId } = Route.useParams();
  const deviceId = useDeviceId();

  const { data, isPending } = useQuery({
    queryKey: ["set", setId, deviceId],
    queryFn: () => getSet(setId),
    enabled: Boolean(deviceId),
  });

  if (isPending || !data) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const { set, words, items } = data;
  const mastery =
    items.length === 0
      ? 0
      : Math.round(items.reduce((sum, item) => sum + Number(item.mastery), 0) / items.length);
  const dueCount = items.filter((item) => isDue(item)).length;

  const wordMastery = (wordId: string) => {
    const wordItems = items.filter((item) => item.word_id === wordId);
    if (wordItems.length === 0) return 0;
    return Math.round(
      wordItems.reduce((sum, item) => sum + Number(item.mastery), 0) / wordItems.length,
    );
  };

  return (
    <AppShell>
      <div className="bg-hero-gradient animate-rise -mx-5 -mt-6 rounded-b-4xl px-5 pt-6 pb-8 text-primary-foreground">
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 hover:bg-primary-foreground/10">
          <Link to="/sets">
            <ArrowLeft className="size-4" /> My Sets
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{set.name}</h1>
        <p className="mt-1 text-sm opacity-90">
          {words.length} words · {mastery}% mastery
        </p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-primary-foreground/25">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${Math.max(2, mastery)}%` }}
          />
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold">
          <CalendarClock className="size-3.5" /> {dueCount} reviews due today
        </p>
      </div>

      <h2 className="mt-7 mb-3 text-lg font-bold">Your Words</h2>
      <ul className="space-y-2">
        {words.map((word, index) => (
          <li key={word.id} className="animate-rise" style={{ animationDelay: `${index * 50}ms` }}>
            <Link
              to="/sets/$setId/words/$wordId"
              params={{ setId, wordId: word.id }}
              className="card-surface flex items-center gap-3 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{word.text}</p>
                <MasteryBar value={wordMastery(word.id)} className="mt-2 h-1.5" />
              </div>
              <MasteryPill mastery={wordMastery(word.id)} />
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="sticky bottom-24 mt-8">
        <Button asChild size="lg" className="w-full rounded-2xl shadow-glow">
          <Link to="/practice" search={{ set: setId }}>
            Practice This Set
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
