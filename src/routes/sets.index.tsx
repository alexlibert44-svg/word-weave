import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarClock, Layers, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle } from "@/components/verba/AppShell";
import { MasteryBar } from "@/components/verba/MasteryPill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeviceId } from "@/hooks/use-device-id";
import { deleteSet, listSets, renameSet } from "@/lib/verba/api";
import type { SetSummary } from "@/lib/verba/types";

export const Route = createFileRoute("/sets/")({
  head: () => ({
    meta: [
      { title: "My Word Sets — Verba" },
      {
        name: "description",
        content:
          "Your personal vocabulary library in Verba: every word set with mastery, reviews due and last practice.",
      },
      { property: "og:title", content: "My Word Sets — Verba" },
      {
        property: "og:description",
        content: "Track mastery and reviews due across all of your Verba word sets.",
      },
    ],
  }),
  component: SetsPage,
});

function lastPracticed(value: string | null) {
  if (!value) return "Not practiced yet";
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "Last practiced: Today";
  if (days === 1) return "Last practiced: Yesterday";
  return `Last practiced: ${days} days ago`;
}

function SetsPage() {
  const deviceId = useDeviceId();
  const queryClient = useQueryClient();
  const [renaming, setRenaming] = useState<SetSummary | null>(null);
  const [draftName, setDraftName] = useState("");

  const { data: sets, isPending } = useQuery({
    queryKey: ["sets", deviceId],
    queryFn: () => listSets(deviceId as string),
    enabled: Boolean(deviceId),
  });

  const rename = useMutation({
    mutationFn: () => renameSet(renaming!.id, draftName.trim()),
    onSuccess: async () => {
      toast.success("Set renamed");
      setRenaming(null);
      await queryClient.invalidateQueries({ queryKey: ["sets"] });
    },
    onError: () => toast.error("Could not rename the set"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSet(id),
    onSuccess: async () => {
      toast.success("Set deleted");
      await queryClient.invalidateQueries({ queryKey: ["sets"] });
    },
    onError: () => toast.error("Could not delete the set"),
  });

  return (
    <AppShell>
      <PageTitle title="My Word Sets" subtitle="Your words stay exactly where you put them." />

      <Button asChild variant="default" size="lg" className="mb-6 w-full rounded-2xl">
        <Link to="/add">
          <Plus className="size-5" /> Create New Set
        </Link>
      </Button>

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      ) : (sets ?? []).length === 0 ? (
        <div className="card-surface animate-rise p-8 text-center">
          <Layers className="mx-auto size-8 text-primary" />
          <h2 className="mt-3 text-lg font-semibold">No sets yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add 4 or more words and Verba turns them into sentences and exercises.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {(sets ?? []).map((set, index) => (
            <li
              key={set.id}
              className="card-surface animate-rise p-5"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <Link to="/sets/$setId" params={{ setId: set.id }} className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-bold">{set.name}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {set.wordCount} words · {set.mastery}% mastery
                  </p>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Options for ${set.name}`}>
                      <MoreVertical className="size-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setRenaming(set);
                        setDraftName(set.name);
                      }}
                    >
                      <Pencil className="size-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => remove.mutate(set.id)}
                    >
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <MasteryBar value={set.mastery} className="mt-4" />

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                  <CalendarClock className="size-3.5" />
                  {set.dueCount} reviews due
                </span>
                <span>{lastPracticed(set.last_practiced_at)}</span>
              </div>

              <div className="mt-4 flex gap-2">
                <Button asChild className="flex-1 rounded-xl">
                  <Link to="/practice" search={{ set: set.id }}>
                    Practice
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="rounded-xl">
                  <Link to="/sets/$setId" params={{ setId: set.id }}>
                    Open
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(renaming)} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename set</DialogTitle>
          </DialogHeader>
          <Input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Set name"
          />
          <DialogFooter>
            <Button
              onClick={() => rename.mutate()}
              disabled={draftName.trim().length === 0 || rename.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
