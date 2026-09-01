import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/verba/AppShell";
import { MasteryBar, MasteryPill } from "@/components/verba/MasteryPill";
import { useI18n } from "@/lib/i18n";
import { speechLocale } from "@/lib/i18n/languages";
import { getWord } from "@/lib/verba/api";
import { speak } from "@/lib/verba/speech";
import { SKILL_KEY } from "@/lib/verba/types";

export const Route = createFileRoute("/sets/$setId/words/$wordId")({
  head: () => ({
    meta: [
      { title: "Word Detail — LingoFlow" },
      {
        name: "description",
        content:
          "Meaning, pronunciation, example sentences and your skill breakdown for this word.",
      },
      { property: "og:title", content: "Word Detail — LingoFlow" },
      {
        property: "og:description",
        content: "How well you know this word across writing, speaking and recall.",
      },
    ],
  }),
  component: WordDetail,
});

function WordDetail() {
  const { setId, wordId } = Route.useParams();
  const { t } = useI18n();

  const { data } = useQuery({ queryKey: ["word", wordId], queryFn: () => getWord(wordId) });

  if (!data) {
    return (
      <AppShell>
        <Skeleton className="h-40 rounded-2xl" />
      </AppShell>
    );
  }

  const { word, sentences, items, set } = data;
  const locale = speechLocale(set.target_language);
  const example = sentences.find((s) => s.form === "base") ?? sentences[0];
  const mastery =
    items.length === 0
      ? 0
      : Math.round(items.reduce((sum, i) => sum + Number(i.mastery), 0) / items.length);

  return (
    <AppShell>
      <Button asChild variant="ghost" size="icon" aria-label={t("word.backToSet")}>
        <Link to="/sets/$setId" params={{ setId }}>
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Link>
      </Button>

      <div className="card-surface animate-rise mt-2 p-6 text-center">
        <p className="text-3xl font-bold" lang={set.target_language}>
          {word.text}
        </p>
        {word.pronunciation ? (
          <p className="mt-1 text-sm text-muted-foreground">{word.pronunciation}</p>
        ) : null}
        {word.part_of_speech ? (
          <p className="mt-2 text-xs font-semibold tracking-wide text-primary uppercase">
            {word.part_of_speech}
          </p>
        ) : null}
        <Button
          variant="secondary"
          className="mt-4 rounded-xl"
          onClick={() => speak(word.text, locale)}
        >
          <Volume2 className="size-4" /> {t("common.listen")}
        </Button>
      </div>

      <div className="card-surface mt-4 p-5">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {t("word.translation")}
        </p>
        <p className="mt-1 text-base font-semibold">{word.translation ?? word.meaning}</p>
      </div>

      {example ? (
        <div className="card-surface mt-3 p-5">
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {t("word.example")}
          </p>
          <p className="mt-1.5 text-base font-semibold" lang={set.target_language}>
            {example.text}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{example.translation}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 rounded-xl px-2"
            onClick={() => speak(example.text, locale)}
          >
            <Volume2 className="size-4" /> {t("common.listen")}
          </Button>
        </div>
      ) : null}

      <div className="card-surface mt-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t("word.mastery")}</span>
          <MasteryPill mastery={mastery} />
        </div>
        <MasteryBar value={mastery} className="mt-3" />
      </div>

      <h2 className="mt-7 mb-3 text-lg font-bold">{t("word.skills")}</h2>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.id} className="card-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{t(SKILL_KEY[item.skill])}</span>
              <span className="text-sm font-bold text-primary">{Math.round(item.mastery)}%</span>
            </div>
            <MasteryBar value={Number(item.mastery)} className="mt-2 h-1.5" />
            <p className="mt-2 text-[0.7rem] text-muted-foreground">
              {t("word.attempts", { attempts: item.attempts, mistakes: item.mistakes })}
            </p>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
