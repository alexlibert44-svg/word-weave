import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Award, Bell, Flame, Globe, Target, Trophy, Volume2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { AppShell, PageTitle } from "@/components/verba/AppShell";
import { MasteryBar } from "@/components/verba/MasteryPill";
import { useDeviceId } from "@/hooks/use-device-id";
import { ensureLearner, getProfileStats, updateLearner } from "@/lib/verba/api";
import type { Learner } from "@/lib/verba/types";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — Verba" },
      {
        name: "description",
        content:
          "Your Verba learning stats: words learned, sentences practiced, streaks, daily goal and learning settings.",
      },
      { property: "og:title", content: "Your Profile — Verba" },
      {
        property: "og:description",
        content: "Streaks, achievements and learning settings in one place.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const deviceId = useDeviceId();
  const queryClient = useQueryClient();

  const { data: learner } = useQuery({
    queryKey: ["learner", deviceId],
    queryFn: () => ensureLearner(deviceId as string),
    enabled: Boolean(deviceId),
  });
  const { data: stats } = useQuery({
    queryKey: ["stats", deviceId],
    queryFn: () => getProfileStats(deviceId as string),
    enabled: Boolean(deviceId),
  });

  const save = useMutation({
    mutationFn: (patch: Partial<Omit<Learner, "device_id">>) =>
      updateLearner(deviceId as string, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["learner"] });
    },
  });

  if (!learner || !stats) {
    return (
      <AppShell>
        <PageTitle title="Profile" />
        <Skeleton className="h-40 rounded-3xl" />
      </AppShell>
    );
  }

  const achievements = [
    { label: "First set created", earned: stats.totalWords > 0, icon: Award },
    { label: "10 sentences practiced", earned: stats.sentencesPracticed >= 10, icon: Trophy },
    { label: "3-day streak", earned: learner.streak >= 3, icon: Flame },
    { label: "First word mastered", earned: stats.wordsLearned > 0, icon: Target },
  ];

  return (
    <AppShell>
      <PageTitle title="Profile" subtitle={learner.display_name} />

      <div className="card-surface animate-rise p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-bold">Overall progress</p>
          <p className="text-2xl font-bold text-primary">{stats.overallMastery}%</p>
        </div>
        <MasteryBar value={stats.overallMastery} className="mt-3" />

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Stat label="Words learned" value={`${stats.wordsLearned} / ${stats.totalWords}`} />
          <Stat label="Sentences practiced" value={stats.sentencesPracticed} />
          <Stat label="Speaking practice" value={stats.speakingAttempts} />
          <Stat label="Writing practice" value={stats.writingAttempts} />
          <Stat label="Current streak" value={`${learner.streak} days`} />
          <Stat label="Longest streak" value={`${learner.longest_streak} days`} />
        </dl>
      </div>

      <h2 className="mt-7 mb-3 text-lg font-bold">Achievements</h2>
      <ul className="grid grid-cols-2 gap-3">
        {achievements.map(({ label, earned, icon: Icon }) => (
          <li
            key={label}
            className={
              earned
                ? "card-surface flex flex-col items-center gap-2 p-4 text-center"
                : "flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-4 text-center opacity-60"
            }
          >
            <Icon className={earned ? "size-6 text-accent" : "size-6 text-muted-foreground"} />
            <span className="text-xs font-semibold">{label}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-7 mb-3 text-lg font-bold">Settings</h2>
      <div className="card-surface divide-y divide-border">
        <SettingRow icon={Globe} label="Learning language">
          <Input
            value={learner.learning_language}
            onChange={(event) => save.mutate({ learning_language: event.target.value })}
            className="h-9 w-32 rounded-lg text-right"
          />
        </SettingRow>
        <SettingRow icon={Globe} label="Native language">
          <Input
            value={learner.native_language}
            onChange={(event) => save.mutate({ native_language: event.target.value })}
            className="h-9 w-32 rounded-lg text-right"
          />
        </SettingRow>
        <SettingRow icon={Target} label="Daily goal (minutes)">
          <Input
            type="number"
            min={5}
            max={120}
            value={learner.daily_goal_minutes}
            onChange={(event) =>
              save.mutate({ daily_goal_minutes: Number(event.target.value) || 15 })
            }
            className="h-9 w-20 rounded-lg text-right"
          />
        </SettingRow>
        <SettingRow icon={Bell} label="Notifications">
          <Switch
            checked={learner.notifications_enabled}
            onCheckedChange={(checked) => save.mutate({ notifications_enabled: checked })}
          />
        </SettingRow>
        <SettingRow icon={Volume2} label="Autoplay audio">
          <Switch
            checked={learner.audio_autoplay}
            onCheckedChange={(checked) => save.mutate({ audio_autoplay: checked })}
          />
        </SettingRow>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Account: this device. Sign-in and cross-device sync arrive in a later release, so your sets
        currently live on this device's profile.
      </p>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-secondary p-3">
      <dt className="text-[0.7rem] font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-base font-bold">{value}</dd>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Bell;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <Icon className="size-4 text-muted-foreground" />
      <Label className="flex-1 text-sm font-semibold">{label}</Label>
      {children}
    </div>
  );
}
