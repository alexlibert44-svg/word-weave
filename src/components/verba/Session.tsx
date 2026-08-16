import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Mic,
  PartyPopper,
  RotateCcw,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MasteryBar } from "@/components/verba/MasteryPill";
import { cn } from "@/lib/utils";
import { logSession, recordAttempt } from "@/lib/verba/api";
import { listenOnce, speak, speechRecognitionSupported } from "@/lib/verba/speech";
import { normalize, similarity } from "@/lib/verba/srs";
import { SKILL_LABEL, type Exercise } from "@/lib/verba/types";

/** Builds a cloze prompt by hiding the target word inside its sentence. */
export function cloze(sentence: string, word: string) {
  const stem = word.toLowerCase().slice(0, Math.max(3, word.length - 2));
  const tokens = sentence.split(/(\s+)/);
  const targetIndex = tokens.findIndex((token) => normalize(token).startsWith(stem));
  if (targetIndex === -1) {
    return { prompt: sentence.replace(word, "___"), answer: word };
  }
  const answer = normalize(tokens[targetIndex] as string);
  const masked = tokens.slice();
  masked[targetIndex] = "___";
  return { prompt: masked.join(""), answer };
}

interface SessionProps {
  deviceId: string;
  exercises: Exercise[];
  title: string;
  onFinished: () => void;
}

export function Session({ deviceId, exercises, title, onFinished }: SessionProps) {
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState(0);
  const startedAt = useRef(Date.now());
  const [done, setDone] = useState(false);

  const current = exercises[index];
  const total = exercises.length;

  const finish = useMutation({
    mutationFn: async () => {
      const minutes = Math.max(0.5, Math.round(((Date.now() - startedAt.current) / 60000) * 10) / 10);
      await logSession(deviceId, minutes, completed + 1);
    },
    onSuccess: () => {
      setDone(true);
      onFinished();
    },
  });

  const advance = () => {
    if (index + 1 >= total) {
      finish.mutate();
    } else {
      setCompleted((value) => value + 1);
      setIndex((value) => value + 1);
    }
  };

  if (done || !current) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <span className="bg-hero-gradient flex size-20 items-center justify-center rounded-3xl text-primary-foreground shadow-glow">
          <PartyPopper className="size-9" />
        </span>
        <h1 className="mt-6 text-2xl font-bold">Session complete</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {total} {total === 1 ? "item" : "items"} practiced. Your progress and mistakes were saved
          for spaced repetition.
        </p>
        <Button asChild size="lg" className="mt-8 w-full rounded-2xl">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-6 pb-8">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-muted-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{SKILL_LABEL[current.skill]}</p>
          </div>
          <span className="text-sm font-bold text-primary">
            {index + 1} / {total}
          </span>
          <Button asChild variant="ghost" size="icon" aria-label="Exit session">
            <Link to="/">
              <X className="size-5" />
            </Link>
          </Button>
        </div>
        <MasteryBar value={((index) / total) * 100} className="mt-3" />
      </header>

      <ExerciseView
        key={current.item.id}
        deviceId={deviceId}
        exercise={current}
        onDone={advance}
      />
    </div>
  );
}

function ExerciseView({
  deviceId,
  exercise,
  onDone,
}: {
  deviceId: string;
  exercise: Exercise;
  onDone: () => void;
}) {
  switch (exercise.skill) {
    case "recognition":
      return <WordLearning deviceId={deviceId} exercise={exercise} onDone={onDone} />;
    case "speaking":
      return <SpeakingExercise deviceId={deviceId} exercise={exercise} onDone={onDone} />;
    case "recall":
      return <RecallExercise deviceId={deviceId} exercise={exercise} onDone={onDone} />;
    default:
      return <WritingExercise deviceId={deviceId} exercise={exercise} onDone={onDone} />;
  }
}

/* ------------------------------ word learning ------------------------------ */

function WordLearning({
  deviceId,
  exercise,
  onDone,
}: {
  deviceId: string;
  exercise: Exercise;
  onDone: () => void;
}) {
  const { word, sentence } = exercise;
  useEffect(() => {
    speak(word.text);
  }, [word.text]);

  const save = useMutation({
    mutationFn: () => recordAttempt(deviceId, exercise.item, 0.75, null),
    onSuccess: onDone,
    onError: onDone,
  });

  return (
    <div className="flex flex-1 flex-col">
      <div className="card-surface animate-rise p-6 text-center">
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          New word
        </p>
        <h1 className="mt-3 text-4xl font-bold">{word.text}</h1>
        {word.pronunciation ? (
          <p className="mt-1 text-sm text-muted-foreground">{word.pronunciation}</p>
        ) : null}
        <p className="mt-4 text-base font-medium text-primary-deep">“{word.meaning}”</p>
        <Button
          variant="secondary"
          className="mt-5 rounded-xl"
          onClick={() => speak(word.text)}
        >
          <Volume2 className="size-4" /> Listen
        </Button>
      </div>

      {sentence ? (
        <div className="card-surface animate-rise mt-4 p-5">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            In a sentence
          </p>
          <p className="mt-2 text-lg leading-relaxed font-semibold">{sentence.text}</p>
          <Button
            variant="ghost"
            className="mt-2 px-0 text-primary"
            onClick={() => speak(sentence.text)}
          >
            <Volume2 className="size-4" /> Listen to the sentence
          </Button>
        </div>
      ) : null}

      <div className="mt-auto pt-8">
        <Button
          size="lg"
          className="w-full rounded-2xl"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          Continue <ArrowRight className="size-5" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ writing / forms ---------------------------- */

function WritingExercise({
  deviceId,
  exercise,
  onDone,
}: {
  deviceId: string;
  exercise: Exercise;
  onDone: () => void;
}) {
  const { word, sentence } = exercise;
  const task = useMemo(
    () => cloze(sentence?.text ?? `I want to ${word.text}.`, word.text),
    [sentence?.text, word.text],
  );
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "wrong" | "correct">("idle");
  const [tries, setTries] = useState(0);

  const check = useMutation({
    mutationFn: async () => {
      const correct = normalize(value) === normalize(task.answer);
      const score = correct ? Math.max(0.55, 1 - tries * 0.25) : 0.2;
      await recordAttempt(deviceId, exercise.item, score, value);
      return correct;
    },
    onSuccess: (correct) => {
      if (correct) {
        setState("correct");
        speak(sentence?.text ?? task.answer);
      } else {
        setState("wrong");
        setTries((t) => t + 1);
      }
    },
  });

  return (
    <div className="flex flex-1 flex-col">
      <div className="card-surface animate-rise p-6">
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          {exercise.skill === "form"
            ? `Complete the sentence · ${exercise.item.form}`
            : "Complete the sentence"}
        </p>
        <p className="mt-3 text-2xl leading-snug font-bold">{task.prompt}</p>
        <p className="mt-3 text-sm text-muted-foreground">Meaning: {word.meaning}</p>

        <Input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (state !== "idle") setState("idle");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && value.trim()) {
              event.preventDefault();
              if (state === "correct") onDone();
              else check.mutate();
            }
          }}
          placeholder="Type the missing word"
          autoCapitalize="none"
          autoComplete="off"
          className={cn(
            "mt-5 h-14 rounded-2xl text-center text-lg font-semibold",
            state === "wrong" && "border-destructive",
            state === "correct" && "border-success",
          )}
        />

        {state === "wrong" ? (
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-destructive">
            <RotateCcw className="size-4" /> Try again — keep going until it's right.
          </p>
        ) : null}
        {state === "correct" ? (
          <div className="mt-3 rounded-2xl bg-success-soft p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-success">
              <Check className="size-4" /> Correct!
            </p>
            <p className="mt-1 text-sm text-foreground">{sentence?.text}</p>
          </div>
        ) : null}
        {tries >= 2 && state !== "correct" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Hint: the word starts with “{task.answer.slice(0, 2)}”.
          </p>
        ) : null}
      </div>

      <div className="mt-auto pt-8">
        {state === "correct" ? (
          <Button size="lg" className="w-full rounded-2xl" onClick={onDone}>
            Continue <ArrowRight className="size-5" />
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full rounded-2xl"
            disabled={value.trim().length === 0 || check.isPending}
            onClick={() => check.mutate()}
          >
            Check
          </Button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- speaking -------------------------------- */

function SpeakingExercise({
  deviceId,
  exercise,
  onDone,
}: {
  deviceId: string;
  exercise: Exercise;
  onDone: () => void;
}) {
  const target = exercise.sentence?.text ?? exercise.word.text;
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<{ score: number; transcript: string } | null>(null);
  const [supported, setSupported] = useState(true);
  const handle = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    setSupported(speechRecognitionSupported());
  }, []);

  const save = useMutation({
    mutationFn: (payload: { score: number; transcript: string | null }) =>
      recordAttempt(deviceId, exercise.item, payload.score, payload.transcript),
  });

  const start = () => {
    setResult(null);
    if (!supported) return;
    setListening(true);
    handle.current = listenOnce(
      (transcript) => {
        setListening(false);
        const score = Math.max(0.15, similarity(transcript, target));
        setResult({ score, transcript });
        save.mutate({ score, transcript });
      },
      () => {
        setListening(false);
        setResult({ score: 0.2, transcript: "" });
        save.mutate({ score: 0.2, transcript: null });
      },
    );
  };

  const stop = () => {
    setListening(false);
    handle.current?.stop();
  };

  const passed = (result?.score ?? 0) >= 0.6;

  return (
    <div className="flex flex-1 flex-col">
      <div className="card-surface animate-rise p-6 text-center">
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          Say the sentence
        </p>
        <p className="mt-3 text-2xl leading-snug font-bold">{target}</p>
        <Button variant="secondary" className="mt-5 rounded-xl" onClick={() => speak(target)}>
          <Volume2 className="size-4" /> Listen
        </Button>
      </div>

      <div className="mt-8 flex flex-col items-center">
        <button
          type="button"
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={stop}
          disabled={!supported}
          className={cn(
            "bg-hero-gradient flex size-28 flex-col items-center justify-center rounded-full text-primary-foreground shadow-glow transition-transform active:scale-95 disabled:opacity-60",
            listening && "animate-mic-pulse",
          )}
          aria-label="Hold to speak"
        >
          <Mic className="size-9" />
          <span className="mt-1 text-[0.7rem] font-bold">
            {listening ? "Listening..." : "Hold to Speak"}
          </span>
        </button>

        {!supported ? (
          <p className="mt-4 max-w-xs text-center text-xs text-muted-foreground">
            Speech recognition isn't available in this browser. Say the sentence out loud, then
            confirm below — your attempt is still recorded.
          </p>
        ) : null}

        {result ? (
          <div
            className={cn(
              "mt-6 w-full rounded-2xl p-4 text-center",
              passed ? "bg-success-soft" : "bg-destructive-soft",
            )}
          >
            <p
              className={cn(
                "text-sm font-bold",
                passed ? "text-success" : "text-destructive",
              )}
            >
              {passed ? "Good pronunciation" : "Try again"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Match {Math.round(result.score * 100)}%
              {result.transcript ? ` · heard “${result.transcript}”` : ""}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-auto space-y-2 pt-8">
        {supported ? (
          result && passed ? (
            <Button size="lg" className="w-full rounded-2xl" onClick={onDone}>
              Continue <ArrowRight className="size-5" />
            </Button>
          ) : (
            <>
              {result ? (
                <Button size="lg" className="w-full rounded-2xl" onClick={start}>
                  <RotateCcw className="size-5" /> Try again
                </Button>
              ) : null}
              {result ? (
                <Button variant="ghost" className="w-full" onClick={onDone}>
                  Skip for now
                </Button>
              ) : null}
            </>
          )
        ) : (
          <Button
            size="lg"
            className="w-full rounded-2xl"
            onClick={() => {
              save.mutate({ score: 0.7, transcript: null });
              onDone();
            }}
          >
            I said it <ArrowRight className="size-5" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- recall --------------------------------- */

function RecallExercise({
  deviceId,
  exercise,
  onDone,
}: {
  deviceId: string;
  exercise: Exercise;
  onDone: () => void;
}) {
  const target = exercise.sentence?.text ?? exercise.word.text;
  const hint = exercise.sentence?.translation ?? exercise.word.meaning ?? "";
  const [mode, setMode] = useState<"write" | "speak">("write");
  const [value, setValue] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [listening, setListening] = useState(false);

  const save = useMutation({
    mutationFn: (payload: { score: number; response: string | null }) =>
      recordAttempt(deviceId, exercise.item, payload.score, payload.response),
  });

  const evaluate = (response: string) => {
    const value = Math.max(0.15, similarity(response, target));
    setScore(value);
    save.mutate({ score: value, response });
  };

  const passed = (score ?? 0) >= 0.6;

  return (
    <div className="flex flex-1 flex-col">
      <div className="card-surface animate-rise p-6">
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          Say it in English
        </p>
        <p className="mt-3 text-xl leading-snug font-semibold text-primary-deep">“{hint}”</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the word <span className="font-bold text-foreground">{exercise.word.text}</span>.
        </p>

        <div className="mt-5 flex gap-2">
          <Button
            variant={mode === "write" ? "default" : "secondary"}
            className="flex-1 rounded-xl"
            onClick={() => setMode("write")}
          >
            Write
          </Button>
          <Button
            variant={mode === "speak" ? "default" : "secondary"}
            className="flex-1 rounded-xl"
            onClick={() => setMode("speak")}
          >
            Speak
          </Button>
        </div>

        {mode === "write" ? (
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Type the full sentence"
            className="mt-4 h-14 rounded-2xl text-base"
          />
        ) : (
          <Button
            variant="secondary"
            className="mt-4 h-14 w-full rounded-2xl"
            onClick={() => {
              if (!speechRecognitionSupported()) {
                evaluate(target);
                return;
              }
              setListening(true);
              listenOnce(
                (transcript) => {
                  setListening(false);
                  evaluate(transcript);
                },
                () => {
                  setListening(false);
                  setScore(0.2);
                  save.mutate({ score: 0.2, response: null });
                },
              );
            }}
          >
            <Mic className="size-5" /> {listening ? "Listening..." : "Tap and say it"}
          </Button>
        )}

        {score !== null ? (
          <div
            className={cn(
              "mt-4 rounded-2xl p-4",
              passed ? "bg-success-soft" : "bg-destructive-soft",
            )}
          >
            <p
              className={cn("text-sm font-bold", passed ? "text-success" : "text-destructive")}
            >
              {passed ? "Well recalled!" : "Not quite — try again"}
            </p>
            <p className="mt-1 text-sm text-foreground">Target: {target}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-auto pt-8">
        {passed ? (
          <Button size="lg" className="w-full rounded-2xl" onClick={onDone}>
            Continue <ArrowRight className="size-5" />
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full rounded-2xl"
            disabled={mode === "write" && value.trim().length === 0}
            onClick={() => {
              if (mode === "write") evaluate(value);
              else setScore(null);
            }}
          >
            {score === null ? "Check" : "Try again"}
          </Button>
        )}
      </div>
    </div>
  );
}
