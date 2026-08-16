import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle } from "@/components/verba/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDeviceId } from "@/hooks/use-device-id";
import { createSet } from "@/lib/verba/api";

export const Route = createFileRoute("/add")({
  head: () => ({
    meta: [
      { title: "Create a New Word Set — Verba" },
      {
        name: "description",
        content:
          "Enter 4 or more words and Verba builds sentences, listening, writing and speaking practice around them.",
      },
      { property: "og:title", content: "Create a New Word Set — Verba" },
      {
        property: "og:description",
        content: "Add your own words and turn them into real sentence practice.",
      },
    ],
  }),
  component: AddPage,
});

const MINIMUM = 4;

function AddPage() {
  const deviceId = useDeviceId();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [words, setWords] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const addWord = () => {
    const cleaned = draft.trim().replace(/\s+/g, " ");
    if (!cleaned) return;
    if (editingIndex !== null) {
      setWords((prev) => prev.map((w, i) => (i === editingIndex ? cleaned : w)));
      setEditingIndex(null);
    } else if (words.some((w) => w.toLowerCase() === cleaned.toLowerCase())) {
      toast.info("That word is already in the set");
    } else {
      setWords((prev) => [...prev, cleaned]);
    }
    setDraft("");
  };

  const create = useMutation({
    mutationFn: () => createSet(deviceId as string, name.trim(), words),
    onSuccess: (setId) => {
      toast.success("Your set is ready");
      navigate({ to: "/sets/$setId", params: { setId } });
    },
    onError: () => toast.error("Could not create the set. Please try again."),
  });

  const canCreate =
    Boolean(deviceId) && name.trim().length > 0 && words.length >= MINIMUM && !create.isPending;

  if (create.isPending) {
    return (
      <AppShell>
        <div className="card-surface animate-rise mt-16 flex flex-col items-center p-10 text-center">
          <Loader2 className="size-9 animate-spin text-primary" />
          <h2 className="mt-5 text-lg font-bold">Preparing your learning experience...</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Building sentences, listening, writing and speaking practice for your {words.length}{" "}
            words.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTitle
        title="Create a New Word Set"
        subtitle="Your words, your set. Verba builds the sentences around them."
      />

      <div className="card-surface animate-rise space-y-3 p-5">
        <label htmlFor="set-name" className="text-sm font-semibold">
          Set name
        </label>
        <Input
          id="set-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Personal Growth"
          className="h-12 rounded-xl text-base"
        />
      </div>

      <div className="card-surface animate-rise mt-4 space-y-4 p-5">
        <div className="flex items-center justify-between">
          <label htmlFor="word-input" className="text-sm font-semibold">
            Add your words
          </label>
          <span
            className={
              words.length >= MINIMUM
                ? "text-xs font-bold text-success"
                : "text-xs font-bold text-muted-foreground"
            }
          >
            {words.length} / {MINIMUM} minimum
          </span>
        </div>

        <div className="flex gap-2">
          <Input
            id="word-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addWord();
              }
            }}
            placeholder="improve"
            className="h-12 rounded-xl text-base"
          />
          <Button
            type="button"
            onClick={addWord}
            size="icon"
            className="size-12 shrink-0 rounded-xl"
            aria-label={editingIndex === null ? "Add word" : "Save word"}
          >
            {editingIndex === null ? <Plus className="size-5" /> : <Check className="size-5" />}
          </Button>
        </div>

        {words.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {words.map((word, index) => (
              <li key={`${word}-${index}`}>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-1.5 pr-1.5 pl-3 text-sm font-semibold text-primary-deep">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(word);
                      setEditingIndex(index);
                    }}
                    className="max-w-40 truncate"
                  >
                    {word}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${word}`}
                    onClick={() => setWords((prev) => prev.filter((_, i) => i !== index))}
                    className="flex size-6 items-center justify-center rounded-full bg-card/70"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tip: enter words you actually want to use, like{" "}
            <span className="font-semibold text-foreground">improve, achieve, effort</span>.
          </p>
        )}
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
        Each word gets sentences, variations and separate tracking for writing, speaking and recall.
      </p>

      <Button
        size="lg"
        className="mt-5 w-full rounded-2xl"
        disabled={!canCreate}
        onClick={() => create.mutate()}
      >
        Create Set
      </Button>
      {words.length < MINIMUM ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Add at least {MINIMUM} words to continue.
        </p>
      ) : null}
    </AppShell>
  );
}
