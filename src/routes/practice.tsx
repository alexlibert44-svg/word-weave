import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Session } from "@/components/verba/Session";
import { useDeviceId } from "@/hooks/use-device-id";
import { buildQueue, getSet } from "@/lib/verba/api";

export const Route = createFileRoute("/practice")({
  validateSearch: (search: Record<string, unknown>) => ({
    set: typeof search["set"] === "string" ? (search["set"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Practice Session — Verba" },
      {
        name: "description",
        content:
          "A focused Verba session: listen, write, speak and recall your words inside real sentences.",
      },
      { property: "og:title", content: "Practice Session — Verba" },
      {
        property: "og:description",
        content: "One objective at a time: listening, writing, speaking and recall.",
      },
    ],
  }),
  component: PracticePage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center px-6 text-center" role="alert">
      <div>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button asChild className="mt-4 rounded-xl">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  ),
  notFoundComponent: () => <p className="p-8 text-center">Nothing to practice here.</p>,
});

function PracticePage() {
  const { set: setId } = Route.useSearch();
  const deviceId = useDeviceId();
  const queryClient = useQueryClient();

  const { data: exercises, isPending } = useQuery({
    queryKey: ["queue", deviceId, setId ?? "review"],
    queryFn: () => buildQueue(deviceId as string, setId ?? null),
    enabled: Boolean(deviceId),
    staleTime: Infinity,
    gcTime: 0,
  });

  const { data: setInfo } = useQuery({
    queryKey: ["set", setId],
    queryFn: () => getSet(setId as string),
    enabled: Boolean(setId),
  });

  if (!deviceId || isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!exercises || exercises.length === 0) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <Sparkles className="size-9 text-accent" />
        <h1 className="mt-5 text-xl font-bold">Nothing due right now</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything here is scheduled for later. Spaced repetition works best when you come back
          when items are due.
        </p>
        <Button asChild size="lg" className="mt-8 w-full rounded-2xl">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <Session
      deviceId={deviceId}
      exercises={exercises}
      title={setId ? (setInfo?.set.name ?? "Practice") : "Daily Review"}
      onFinished={() => {
        void queryClient.invalidateQueries();
      }}
    />
  );
}
