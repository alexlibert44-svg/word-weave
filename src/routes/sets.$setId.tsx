import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Play, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/verba/AppShell";
import { MasteryBar, MasteryPill } from "@/components/verba/MasteryPill";
import { useI18n } from "@/lib/i18n";
import { language } from "@/lib/i18n/languages";
import { deleteSet, getSet } from "@/lib/verba/api";

export const Route = createFileRoute("/sets/$setId")({
  head: () => ({
    meta: [
      { title: "Word Set — LingoFlow" },
      {
        name: "description",
        content: "Every word in this set with its mastery, review count and practice history.",
      },
      { property: "og:title", content: "Word Set — LingoFlow" },
      {
        property: "og:description",
        content: "See how well you know each word and practice the whole set.",
      },
    ],
  }),
  component: SetDetail,
});

function SetDetail() {
  const { setId } = Route.useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({ queryKey: ["set", setId], queryFn: () => getSet(setId) });

  const remove = useMutation({
    mutationFn: () => deleteSet(setId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sets"] });
      void navigate({ to: "/sets" });
    },
  });

  if (!data) {
    return (
      <AppShell>
        <Skeleton className="h-32 rounded-2xl" />
      </AppShell>
    );
  }

  const { set, words, items } = data;
  const now = Date.now();
  const dueCount = items.filter((i) => new Date(i.next_review_at).getTime() <= now).length;
  const mastery =
    items.length === 0
      ? 0
      : Math.round(items.reduce((sum, i) => sum + Number(i.mastery), 0) / items.length);

  return (
    <AppShell>
      <div className="animate-rise flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}>
          <Link to="/sets">
            <ArrowLeft className="size-5 rtl:rotate-180" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("common.delete")}
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
        >
          <Trash2 className="size-5 text-destructive" />
        </Button>
      </div>

      <h1 className="mt-2 text-2xl font-bold">{set.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("set.pair", {
          target: language(set.target_language).native,
          native: language(set.native_language).native,
        })}
      </p>

      <div className="card-surface mt-5 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t("common.mastery")}</span>
          <span className="text-lg font-bold text-primary">{mastery}%</span>
        </div>
        <MasteryBar value={mastery} className="mt-3" />
        <p className="mt-3 text-xs text-muted-foreground">
          {t("sets.wordCount", { count: words.length })} · {t("set.dueToday", { count: dueCount })}
        </p>
      </div>

      <Button asChild size="lg" className="mt-4 w-full rounded-2xl">
        <Link to="/practice" search={{ set: setId }}>
          <Play className="size-4" /> {t("set.practice")}
        </Link>
      </Button>

      <h2 className="mt-7 mb-3 text-lg font-bold">{t("set.words")}</h2>
      <ul className="space-y-2.5">
        {words.map((word) => {
          const wordItems = items.filter((i) => i.word_id === word.id);
          const wordMastery =
            wordItems.length === 0
              ? 0
              : Math.round(
                  wordItems.reduce((sum, i) => sum + Number(i.mastery), 0) / wordItems.length,
                );
          const attempts = wordItems.reduce((sum, i) => sum + i.attempts, 0);
          return (
            <li key={word.id}>
              <Link
                to="/sets/$setId/words/$wordId"
                params={{ setId, wordId: word.id }}
                className="card-surface flex items-center gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold" lang={set.target_language}>
                    {word.text}
                    {word.pronunciation ? (
                      <span className="ms-2 text-xs font-normal text-muted-foreground">
                        {word.pronunciation}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {word.translation ?? word.meaning}
                  </p>
                  {word.part_of_speech ? (
                    <span className="mt-1 inline-block rounded-full bg-primary-soft px-2 py-0.5 text-[0.65rem] font-semibold text-primary-deep">
                      {t(`pos.${word.part_of_speech}` as never)}
                    </span>
                  ) : null}
                  <MasteryBar value={wordMastery} className="mt-2 h-1.5" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <MasteryPill mastery={wordMastery} />
                  <span className="text-[0.68rem] text-muted-foreground">
                    {attempts} · {wordMastery}%
                  </span>
                </div>
                <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
              </Link>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
