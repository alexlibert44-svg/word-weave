import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell, PageTitle } from "@/components/verba/AppShell";
import { useLearner } from "@/components/verba/AppGate";
import { useI18n } from "@/lib/i18n";
import { getDueBreakdown } from "@/lib/verba/api";
import { SKILL_KEY, type Skill } from "@/lib/verba/types";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review — LingoFlow" },
      {
        name: "description",
        content:
          "Spaced repetition keeps your words alive: see exactly what is due now and start reviewing.",
      },
      { property: "og:title", content: "Review — LingoFlow" },
      {
        property: "og:description",
        content: "What's due today, broken down by writing, speaking, recall and forms.",
      },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { deviceId } = useLearner();
  const { t, locale } = useI18n();

  const { data: due } = useQuery({
    queryKey: ["due", deviceId],
    queryFn: () => getDueBreakdown(deviceId),
  });

  return (
    <AppShell>
      <PageTitle title={t("review.title")} subtitle={t("review.subtitle")} />

      {due === undefined ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : due.total === 0 ? (
        <div className="card-surface p-7 text-center">
          <CheckCircle2 className="mx-auto size-8 text-success" />
          <p className="mt-3 text-sm font-semibold">{t("review.empty")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("review.emptyBody")}</p>
          {due.nextReviewAt ? (
            <p className="mt-3 text-xs font-semibold text-primary">
              {t("review.next")}:{" "}
              {new Date(due.nextReviewAt).toLocaleString(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="bg-hero-gradient animate-rise rounded-3xl p-6 text-primary-foreground">
            <p className="text-sm opacity-85">{t("review.due")}</p>
            <p className="mt-1 text-4xl font-bold">{due.total}</p>
            <Button
              asChild
              size="lg"
              className="mt-5 w-full rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Link to="/practice" search={{ set: undefined }}>
                <Play className="size-4" /> {t("review.start")}
              </Link>
            </Button>
          </div>

          <h2 className="mt-7 mb-3 text-lg font-bold">{t("review.bySkill")}</h2>
          <ul className="space-y-2.5">
            {(Object.entries(due.bySkill) as [Skill, number][])
              .filter(([, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([skill, count]) => (
                <li key={skill} className="card-surface flex items-center justify-between p-4">
                  <span className="text-sm font-semibold">{t(SKILL_KEY[skill])}</span>
                  <span className="text-sm font-bold text-primary">{count}</span>
                </li>
              ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}
