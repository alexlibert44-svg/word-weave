import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/verba/AppShell";
import { MasteryBar, MasteryPill } from "@/components/verba/MasteryPill";
import { useDeviceId } from "@/hooks/use-device-id";
import { getWord } from "@/lib/verba/api";
import { speak } from "@/lib/verba/speech";
import { SKILL_LABEL } from "@/lib/verba/types";

export const Route = createFileRoute("/sets/$setId/words/$wordId")({
  head: () => ({
    meta: [
      { title: "Word Detail — Verba" },
      {
        name: "description",
        content:
          "Meaning, pronunciation, example sentences and per-skill mastery for a single word in Verba.",
      },
      { property: "og:title", content: "Word Detail — Verba" },
      {
        property: "og:description",
        content: "See how well you know this word across writing, speaking and recall.",
      },
    ],
  }),
  component: WordDetailPage,
  errorComponent: ({ error }) => (
    <AppShell>
      <p role="alert" className="text-sm text-muted-foreground">
        {error.message}
      </p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p>This word no longer exists.</p>
    </AppShell>
  ),
});

function WordDetailPage() {
  const { setId, wordId } = Route.useParams();
  const deviceId = useDeviceId();

  const { data, isPending } = useQuery({
    queryKey: ["word", wordId, deviceId],
    queryFn: () => getWord(wordId),
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

  const { word, sentences, items } = data;
  const mastery =
    items.length === 0
      ? 0
      : Math.round(items.reduce((sum, item) => sum + Number(item.mastery), 0) / items.length);
  const example = sentences.find((s) => s.form === "base") ?? sentences[0];

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/sets/$setId" params={{ setId }}>
          <ArrowLeft className="size-4" /> Back to set
        </Link>
      </Button>

      <div className="card-surface animate-rise p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">{word.text}</h1>
            {word.pronunciation ? (
              <p className="mt-1 text-sm text-muted-foreground">{word.pronunciation}</p>
            ) : null}
          </div>
          <MasteryPill mastery={mastery} />
        </div>

        <p className="mt-4 text-base font-medium text-primary-deep">“{word.meaning}”</p>
        <p className="mt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {word.part_of_speech}
        </p>

        <Button variant="secondary" className="mt-4 rounded-xl" onClick={() => speak(word.text)}>
          <Volume2 className="size-4" /> Listen
        </Button>
      </div>

      {example ? (
        <div className="card-surface animate-rise mt-4 p-5">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Example sentence
          </p>
          <p className="mt-2 text-lg leading-relaxed font-semibold">{example.text}</p>
          <Button
            variant="ghost"
            className="mt-1 px-0 text-primary"
            onClick={() => speak(example.text)}
          >
            <Volume2 className="size-4" /> Listen
          </Button>
        </div>
      ) : null}

      <div className="card-surface animate-rise mt-4 p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-bold">Mastery</p>
          <p className="text-2xl font-bold text-primary">{mastery}%</p>
        </div>
        <MasteryBar value={mastery} className="mt-3" />

        <ul className="mt-5 space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {item.skill === "form"
                    ? `${SKILL_LABEL[item.skill]} · ${item.form}`
                    : SKILL_LABEL[item.skill]}
                </span>
                <span className="font-semibold text-muted-foreground">
                  {Math.round(Number(item.mastery))}%
                </span>
              </div>
              <MasteryBar value={Number(item.mastery)} className="mt-1.5 h-1.5" />
              <p className="mt-1 text-[0.7rem] text-muted-foreground">
                {item.attempts} attempts · {item.mistakes} mistakes
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <Button asChild size="lg" className="w-full rounded-2xl">
          <Link to="/practice" search={{ set: setId }}>
            Practice Word
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
