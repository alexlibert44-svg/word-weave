import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLearner } from "@/components/verba/AppGate";
import { Session } from "@/components/verba/Session";
import { useI18n } from "@/lib/i18n";
import { speechLocale } from "@/lib/i18n/languages";
import { buildQueue, getSet } from "@/lib/verba/api";

export const Route = createFileRoute("/practice")({
  validateSearch: (search: Record<string, unknown>) => ({
    set: typeof search["set"] === "string" ? (search["set"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Practice Session — LingoFlow" },
      {
        name: "description",
        content:
          "A focused LingoFlow session: listen, write, speak and recall your words inside real sentences.",
      },
      { property: "og:title", content: "Practice Session — LingoFlow" },
      {
        property: "og:description",
        content: "One objective at a time: writing, speaking, recall, variations and forms.",
      },
    ],
  }),
  component: PracticePage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center px-6 text-center" role="alert">
      <div>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button asChild className="mt-4 rounded-xl">
          <Link to="/">Home</Link>
        </Button>
      </div>
    </div>
  ),
  notFoundComponent: () => <p className="p-8 text-center">Nothing to practice here.</p>,
});

function PracticePage() {
  const { set: setId } = Route.useSearch();
  const { deviceId } = useLearner();
  const { t, targetSpeech } = useI18n();
  const queryClient = useQueryClient();

  const { data: exercises, isPending } = useQuery({
    queryKey: ["queue", deviceId, setId ?? "review"],
    queryFn: () => buildQueue(deviceId, setId ?? null),
    staleTime: Infinity,
    gcTime: 0,
  });

  const { data: setInfo } = useQuery({
    queryKey: ["set", setId],
    queryFn: () => getSet(setId as string),
    enabled: Boolean(setId),
  });

  if (isPending) {
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
        <h1 className="mt-5 text-xl font-bold">{t("practice.empty")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("practice.emptyBody")}</p>
        <Button asChild size="lg" className="mt-8 w-full rounded-2xl">
          <Link to="/">{t("practice.doneHome")}</Link>
        </Button>
      </div>
    );
  }

  const locale = setInfo ? speechLocale(setInfo.set.target_language) : targetSpeech;
  const title = setInfo?.set.name ?? t("review.title");

  return (
    <Session
      deviceId={deviceId}
      exercises={exercises}
      title={title}
      locale={locale}
      onFinished={() => {
        void queryClient.invalidateQueries({ queryKey: ["due", deviceId] });
        void queryClient.invalidateQueries({ queryKey: ["sets", deviceId] });
        void queryClient.invalidateQueries({ queryKey: ["daily", deviceId] });
        void queryClient.invalidateQueries({ queryKey: ["learner", deviceId] });
        if (setId) void queryClient.invalidateQueries({ queryKey: ["set", setId] });
      }}
    />
  );
}
