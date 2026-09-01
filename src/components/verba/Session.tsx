import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Mic, PartyPopper, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MasteryBar } from "@/components/verba/MasteryPill";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { logSession, recordAttempt } from "@/lib/verba/api";
import { listenOnce, speak, speechRecognitionSupported } from "@/lib/verba/speech";
import { normalize, similarity } from "@/lib/verba/srs";
import { SKILL_KEY, type Exercise } from "@/lib/verba/types";

/** Builds a cloze prompt by hiding the target word inside its sentence. */
export function cloze(sentence: string, word: string) {
  const stem = normalize(word).slice(0, Math.max(2, word.length - 2));
  const tokens = sentence.split(/(\s+)/);
  const targetIndex = tokens.findIndex((token) => normalize(token).startsWith(stem));
  if (targetIndex === -1) {
    return { prompt: sentence.replace(word, "____"), answer: word };
  }
  const answer = normalize(tokens[targetIndex] as string);
  const masked = tokens.slice();
  masked[targetIndex] = "____";
  return { prompt: masked.join(""), answer };
}

interface CommonProps {
  deviceId: string;
  exercise: Exercise;
  locale: string;
  onDone: () => void;
}

interface SessionProps {
  deviceId: string;
  exercises: Exercise[];
  title: string;
  /** BCP-47 tag of the language being learned. */
  locale: string;
  onFinished: () => void;
}

export function Session({ deviceId, exercises, title, locale, onFinished }: SessionProps) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const startedAt = useRef(Date.now());
  const [done, setDone] = useState(false);

  const current = exercises[index];
  const total = exercises.length;

  const finish = useMutation({
    mutationFn: async () => {
      const minutes =
        Math.max(0.5, Math.round(((Date.now() - startedAt.current) / 60000) * 10) / 10);
      await logSession(deviceId, minutes, total);
    },
    onSuccess: () => {
      setDone(true);
      onFinished();
    },
    onError: () => {
      setDone(true);
      onFinished();
    },
  });

  const advance = () => {
    if (index + 1 >= total) finish.mutate();
    else setIndex((value) => value + 1);
  };

  if (done || !current) {
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <span className="bg-hero-gradient flex size-20 items-center justify-center rounded-3xl text-primary-foreground shadow-glow">
          <PartyPopper className="size-9" />
        </span>
        <h1 className="mt-6 text-2xl font-bold">{t("practice.done")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("practice.doneBody", { count: total, minutes })}
        </p>
        <Button asChild size="lg" className="mt-8 w-full rounded-2xl">
          <Link to="/">{t("practice.doneHome")}</Link>
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
            <p className="text-xs text-muted-foreground">{t(SKILL_KEY[current.skill])}</p>
          </div>
          <span className="text-sm font-bold text-primary">
            {t("practice.progress", { current: index + 1, total })}
          </span>
          <Button asChild variant="ghost" size="icon" aria-label={t("practice.exit")}>
            <Link to="/">
              <X className="size-5" />
            </Link>
          </Button>
        </div>
        <MasteryBar value={(index / total) * 100} className="mt-3" />
      </header>

      <ExerciseView
        key={current.item.id}
        deviceId={deviceId}
        exercise={current}
        locale={locale}
        onDone={advance}
      />
    </div>
  );
}

function ExerciseView(props: CommonProps) {
  switch (props.exercise.skill) {
    case "recognition":
      return <WordLearning {...props} />;
    case "speaking":
      return <SpeakingExercise {...props} />;
    case "recall":
      return <RecallExercise {...props} />;
    default:
      return <WritingExercise {...props} />;
  }
}

/* --------------------------------- helpers --------------------------------- */

function SentenceCard({
  children,
  onListen,
  className,
}: {
  children: ReactNode;
  onListen?: (() => void) | undefined;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={cn("card-surface animate-rise p-6", className)}>
      {children}
      {onListen ? (
        <Button variant="secondary" className="mt-5 w-full rounded-xl" onClick={onListen}>
          <Volume2 className="size-4" /> {t("common.listen")}
        </Button>
      ) : null}
    </div>
  );
}

function Feedback({ score, answer }: { score: number; answer: string }) {
  const { t } = useI18n();
  const tone =
    score >= 0.9
      ? "bg-success-soft text-success"
      : score >= 0.6
        ? "bg-warning-soft text-accent-foreground"
        : "bg-destructive/10 text-destructive";
  const label =
    score >= 0.9 ? t("practice.correct") : score >= 0.6 ? t("practice.almost") : t("practice.wrong");
  return (
    <div className={cn("mt-4 rounded-2xl px-4 py-3 text-sm font-semibold", tone)} role="status">
      {label} {score >= 0.9 ? null : <span className="font-bold">{answer}</span>}
    </div>
  );
}

/* ------------------------------ word learning ------------------------------ */

function WordLearning({ deviceId, exercise, locale, onDone }: CommonProps) {
  const { t } = useI18n();
  const { word, sentence } = exercise;

  useEffect(() => {
    speak(word.text, locale);
  }, [word.text, locale]);

  const save = useMutation({
    mutationFn: () => recordAttempt(deviceId, exercise.item, 0.75, null),
    onSuccess: onDone,
    onError: onDone,
  });

  return (
    <div className="flex flex-1 flex-col">
      <SentenceCard onListen={() => speak(word.text, locale)} className="text-center">
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          {t("practice.newWord")}
        </p>
        <p className="mt-3 text-3xl font-bold" lang={locale}>
          {word.text}
        </p>
        {word.pronunciation ? (
          <p className="mt-1 text-sm text-muted-foreground">{word.pronunciation}</p>
        ) : null}
        <p className="mt-3 text-base font-semibold text-primary">
          {word.translation ?? word.meaning}
        </p>
        {sentence ? (
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-base font-semibold" lang={locale}>
              {sentence.text}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{sentence.translation}</p>
          </div>
        ) : null}
      </SentenceCard>
      <p className="mt-4 text-center text-sm text-muted-foreground">{t("practice.newWordBody")}</p>
      <Button
        size="lg"
        className="mt-auto w-full rounded-2xl"
        onClick={() => save.mutate()}
        disabled={save.isPending}
      >
        {t("common.continue")} <ArrowRight className="size-4 rtl:rotate-180" />
      </Button>
    </div>
  );
}

/* -------------------------------- writing --------------------------------- */

function WritingExercise({ deviceId, exercise, locale, onDone }: CommonProps) {
  const { t } = useI18n();
  const { word, sentence, skill } = exercise;
  const source = sentence?.text ?? word.text;
  const { prompt, answer } = cloze(source, word.text);
  const [value, setValue] = useState("");
  const [score, setScore] = useState<number | null>(null);

  const save = useMutation({
    mutationFn: (result: number) => recordAttempt(deviceId, exercise.item, result, value),
  });

  const check = () => {
    const result = similarity(normalize(value), normalize(answer));
    setScore(result);
    save.mutate(result);
  };

  const title =
    skill === "form"
      ? t("practice.formTitle")
      : skill === "sentence_usage"
        ? t("practice.variationTitle")
        : t("practice.writingTitle");

  return (
    <div className="flex flex-1 flex-col">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("practice.writingHint")}</p>
      <SentenceCard className="mt-4" onListen={sentence ? () => speak(sentence.text, locale) : undefined}>
        <p className="text-lg font-semibold leading-relaxed" lang={locale}>
          {prompt}
        </p>
        {sentence?.translation ? (
          <p className="mt-2 text-sm text-muted-foreground">{sentence.translation}</p>
        ) : null}
      </SentenceCard>

      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t("practice.writingPlaceholder")}
        aria-label={t("practice.writingPlaceholder")}
        lang={locale}
        disabled={score !== null}
        className="mt-4 h-12 rounded-2xl"
        onKeyDown={(event) => {
          if (event.key === "Enter" && score === null && value.trim()) check();
        }}
      />
      {score !== null ? <Feedback score={score} answer={answer} /> : null}

      {score === null ? (
        <Button
          size="lg"
          className="mt-auto w-full rounded-2xl"
          disabled={!value.trim()}
          onClick={check}
        >
          <Check className="size-4" /> {t("common.check")}
        </Button>
      ) : (
        <Button size="lg" className="mt-auto w-full rounded-2xl" onClick={onDone}>
          {t("common.next")} <ArrowRight className="size-4 rtl:rotate-180" />
        </Button>
      )}
    </div>
  );
}

/* -------------------------------- speaking -------------------------------- */

function SpeakingExercise({ deviceId, exercise, locale, onDone }: CommonProps) {
  const { t } = useI18n();
  const { word, sentence } = exercise;
  const target = sentence?.text ?? word.text;
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const supported = speechRecognitionSupported();

  const save = useMutation({
    mutationFn: (result: number) => recordAttempt(deviceId, exercise.item, result, heard),
  });

  const record = () => {
    setListening(true);
    const handle = listenOnce(
      (transcript) => {
        setListening(false);
        setHeard(transcript);
        const result = similarity(normalize(transcript), normalize(target));
        setScore(result);
        save.mutate(result);
      },
      () => setListening(false),
      locale,
    );
    if (!handle) setListening(false);
  };

  const selfMark = (result: number) => {
    setScore(result);
    save.mutate(result);
  };

  return (
    <div className="flex flex-1 flex-col">
      <h2 className="text-lg font-bold">{t("practice.speakingTitle")}</h2>
      <SentenceCard className="mt-4" onListen={() => speak(target, locale)}>
        <p className="text-lg font-semibold leading-relaxed" lang={locale}>
          {target}
        </p>
        {sentence?.translation ? (
          <p className="mt-2 text-sm text-muted-foreground">{sentence.translation}</p>
        ) : null}
      </SentenceCard>

      {heard ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("practice.speakingHeard", { text: heard })}
        </p>
      ) : null}
      {score !== null ? <Feedback score={score} answer={target} /> : null}

      {score === null ? (
        supported ? (
          <button
            type="button"
            onClick={record}
            disabled={listening}
            className="mt-auto flex flex-col items-center gap-3 py-6"
          >
            <span
              className={cn(
                "bg-hero-gradient flex size-20 items-center justify-center rounded-full text-primary-foreground shadow-glow",
                listening && "animate-pulse",
              )}
            >
              <Mic className="size-8" />
            </span>
            <span className="text-sm font-semibold">
              {listening ? t("practice.speakingListening") : t("practice.speakingTap")}
            </span>
          </button>
        ) : (
          <div className="mt-auto space-y-2.5">
            <p className="text-center text-sm text-muted-foreground">
              {t("practice.speakingUnsupported")}
            </p>
            <Button size="lg" className="w-full rounded-2xl" onClick={() => selfMark(0.9)}>
              {t("practice.speakingSelfOk")}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="w-full rounded-2xl"
              onClick={() => selfMark(0.4)}
            >
              {t("practice.speakingSelfNo")}
            </Button>
          </div>
        )
      ) : (
        <Button size="lg" className="mt-auto w-full rounded-2xl" onClick={onDone}>
          {t("common.next")} <ArrowRight className="size-4 rtl:rotate-180" />
        </Button>
      )}
    </div>
  );
}

/* --------------------------------- recall --------------------------------- */

function RecallExercise({ deviceId, exercise, locale, onDone }: CommonProps) {
  const { t, target } = useI18n();
  const { word, sentence } = exercise;
  const prompt = sentence?.translation ?? word.translation ?? word.meaning ?? word.text;
  const answer = sentence?.text ?? word.text;
  const [value, setValue] = useState("");
  const [score, setScore] = useState<number | null>(null);

  const save = useMutation({
    mutationFn: (result: number) => recordAttempt(deviceId, exercise.item, result, value),
  });

  const check = () => {
    const result = similarity(normalize(value), normalize(answer));
    setScore(result);
    save.mutate(result);
  };

  return (
    <div className="flex flex-1 flex-col">
      <h2 className="text-lg font-bold">{t("practice.recallTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("practice.recallHint", { language: target.native })}
      </p>
      <SentenceCard className="mt-4">
        <p className="text-lg font-semibold leading-relaxed">{prompt}</p>
      </SentenceCard>

      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t("practice.recallPlaceholder")}
        aria-label={t("practice.recallPlaceholder")}
        lang={locale}
        disabled={score !== null}
        className="mt-4 h-12 rounded-2xl"
        onKeyDown={(event) => {
          if (event.key === "Enter" && score === null && value.trim()) check();
        }}
      />
      {score !== null ? <Feedback score={score} answer={answer} /> : null}

      {score === null ? (
        <Button
          size="lg"
          className="mt-auto w-full rounded-2xl"
          disabled={!value.trim()}
          onClick={check}
        >
          <Check className="size-4" /> {t("common.check")}
        </Button>
      ) : (
        <Button size="lg" className="mt-auto w-full rounded-2xl" onClick={onDone}>
          {t("common.next")} <ArrowRight className="size-4 rtl:rotate-180" />
        </Button>
      )}
    </div>
  );
}
