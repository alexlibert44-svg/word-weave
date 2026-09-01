import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Mic,
  PartyPopper,
  Play,
  RotateCcw,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MasteryBar } from "@/components/verba/MasteryPill";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { logSession, recordAttempt } from "@/lib/verba/api";
import { speak } from "@/lib/verba/speech";
import { normalize, similarity } from "@/lib/verba/srs";
import type { Exercise, LearningItem, Sentence, Skill, Word } from "@/lib/verba/types";

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

/* ------------------------------ session model ------------------------------ */

type Step = "recognition" | "speak" | "write" | "meaning";
const STEPS: Step[] = ["recognition", "speak", "write", "meaning"];

interface WordUnit {
  word: Word;
  sentence: Sentence | null;
  /** Real learning items for this word, keyed by skill, used for SRS updates. */
  items: Partial<Record<Skill, LearningItem>>;
  fallbackItem: LearningItem;
}

/** Groups the SRS queue into one training unit per word, in queue order. */
function buildUnits(exercises: Exercise[]): WordUnit[] {
  const order: string[] = [];
  const byWord = new Map<string, WordUnit>();
  for (const exercise of exercises) {
    const id = exercise.word.id;
    let unit = byWord.get(id);
    if (!unit) {
      unit = {
        word: exercise.word,
        sentence: exercise.sentence,
        items: {},
        fallbackItem: exercise.item,
      };
      byWord.set(id, unit);
      order.push(id);
    }
    if (!unit.sentence && exercise.sentence) unit.sentence = exercise.sentence;
    if (!unit.items[exercise.skill]) unit.items[exercise.skill] = exercise.item;
  }
  return order.map((id) => byWord.get(id) as WordUnit);
}

interface SessionProps {
  deviceId: string;
  exercises: Exercise[];
  title: string;
  /** BCP-47 tag of the language being learned. */
  locale: string;
  onFinished: () => void;
  onRestart?: () => void;
}

export function Session({
  deviceId,
  exercises,
  title,
  locale,
  onFinished,
  onRestart,
}: SessionProps) {
  const { t } = useI18n();
  const units = useMemo(() => buildUnits(exercises), [exercises]);
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<Step>("recognition");
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({
    writeCorrect: 0,
    writeTotal: 0,
    meaningCorrect: 0,
    meaningTotal: 0,
  });
  const startedAt = useRef(Date.now());

  const unit = units[index];
  const total = units.length;

  /** Persists a real attempt against the matching learning item. */
  const record = useCallback(
    (skill: Skill, score: number, response: string | null) => {
      if (!unit) return;
      const item = unit.items[skill] ?? unit.fallbackItem;
      void recordAttempt(deviceId, item, score, response).catch(() => undefined);
    },
    [deviceId, unit],
  );

  const finish = useCallback(() => {
    const minutes = Math.max(0.5, Math.round(((Date.now() - startedAt.current) / 60000) * 10) / 10);
    void logSession(deviceId, minutes, total).catch(() => undefined);
    setDone(true);
    onFinished();
  }, [deviceId, onFinished, total]);

  const next = () => {
    const position = STEPS.indexOf(step);
    if (position < STEPS.length - 1) {
      setStep(STEPS[position + 1] as Step);
      return;
    }
    if (index + 1 >= total) finish();
    else {
      setIndex((value) => value + 1);
      setStep("recognition");
    }
  };

  const restart = () => {
    setStats({ writeCorrect: 0, writeTotal: 0, meaningCorrect: 0, meaningTotal: 0 });
    setIndex(0);
    setStep("recognition");
    setDone(false);
    startedAt.current = Date.now();
    setAttempt((value) => value + 1);
    onRestart?.();
  };

  if (done || !unit) {
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
        <div className="card-surface mt-6 w-full space-y-2 p-5 text-start text-sm">
          <ResultRow label={t("train.resultWords")} value={`${total}`} />
          <ResultRow
            label={t("train.resultWriting")}
            value={`${stats.writeCorrect}/${stats.writeTotal}`}
          />
          <ResultRow
            label={t("train.resultMeaning")}
            value={`${stats.meaningCorrect}/${stats.meaningTotal}`}
          />
        </div>
        <Button size="lg" className="mt-6 w-full rounded-2xl" onClick={restart}>
          <RotateCcw className="size-4" /> {t("train.restart")}
        </Button>
        <Button asChild size="lg" variant="secondary" className="mt-2.5 w-full rounded-2xl">
          <Link to="/sets">{t("train.exit")}</Link>
        </Button>
      </div>
    );
  }

  const progress = ((index + STEPS.indexOf(step) / STEPS.length) / total) * 100;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-6 pb-8">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-muted-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{t(`train.step.${step}` as never)}</p>
          </div>
          <span className="text-sm font-bold text-primary">
            {t("practice.progress", { current: index + 1, total })}
          </span>
          <Button asChild variant="ghost" size="icon" aria-label={t("train.exit")}>
            <Link to="/sets">
              <X className="size-5" />
            </Link>
          </Button>
        </div>
        <MasteryBar value={progress} className="mt-3" />
      </header>

      {step === "recognition" ? (
        <RecognitionStep
          key={`r-${attempt}-${unit.word.id}`}
          unit={unit}
          locale={locale}
          onReady={() => {
            record("recognition", 0.75, null);
            next();
          }}
        />
      ) : step === "speak" ? (
        <SpeakStep
          key={`s-${attempt}-${unit.word.id}`}
          unit={unit}
          locale={locale}
          onDone={(score, note) => {
            record("speaking", score, note);
            next();
          }}
        />
      ) : step === "write" ? (
        <WriteStep
          key={`w-${attempt}-${unit.word.id}`}
          unit={unit}
          locale={locale}
          onDone={(score, response) => {
            record("writing", score, response);
            setStats((s) => ({
              ...s,
              writeTotal: s.writeTotal + 1,
              writeCorrect: s.writeCorrect + (score >= 0.9 ? 1 : 0),
            }));
            next();
          }}
        />
      ) : (
        <MeaningStep
          key={`m-${attempt}-${unit.word.id}`}
          unit={unit}
          units={units}
          locale={locale}
          onDone={(correct, response) => {
            record("recall", correct ? 1 : 0.2, response);
            setStats((s) => ({
              ...s,
              meaningTotal: s.meaningTotal + 1,
              meaningCorrect: s.meaningCorrect + (correct ? 1 : 0),
            }));
            next();
          }}
        />
      )}
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-primary">{value}</span>
    </div>
  );
}

/* --------------------------------- audio ---------------------------------- */

function AudioButtons({
  word,
  sentence,
  locale,
}: {
  word: string;
  sentence: string | null;
  locale: string;
}) {
  const { t } = useI18n();
  return (
    <div className="mt-5 grid gap-2">
      <Button variant="secondary" className="w-full rounded-xl" onClick={() => speak(word, locale)}>
        <Volume2 className="size-4" /> {t("train.wordAudio")}
      </Button>
      {sentence ? (
        <Button
          variant="secondary"
          className="w-full rounded-xl"
          onClick={() => speak(sentence, locale)}
        >
          <Volume2 className="size-4" /> {t("train.sentenceAudio")}
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------- recognition ------------------------------- */

function RecognitionStep({
  unit,
  locale,
  onReady,
}: {
  unit: WordUnit;
  locale: string;
  onReady: () => void;
}) {
  const { t } = useI18n();
  const { word, sentence } = unit;

  useEffect(() => {
    speak(word.text, locale);
  }, [word.text, locale]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="card-surface animate-rise p-6 text-center">
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
        {word.part_of_speech ? (
          <p className="mt-1 text-xs text-muted-foreground">{word.part_of_speech}</p>
        ) : null}
        {sentence ? (
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-base font-semibold" lang={locale}>
              {sentence.text}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{sentence.translation}</p>
          </div>
        ) : null}
        <AudioButtons word={word.text} sentence={sentence?.text ?? null} locale={locale} />
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">{t("practice.newWordBody")}</p>
      <Button size="lg" className="mt-auto w-full rounded-2xl" onClick={onReady}>
        {t("train.ready")} <ArrowRight className="size-4 rtl:rotate-180" />
      </Button>
    </div>
  );
}

/* --------------------------------- speak ---------------------------------- */

type RecorderState = "idle" | "recording" | "recorded" | "denied";

function SpeakStep({
  unit,
  locale,
  onDone,
}: {
  unit: WordUnit;
  locale: string;
  onDone: (score: number, note: string | null) => void;
}) {
  const { t } = useI18n();
  const { word, sentence } = unit;
  const target = sentence?.text ?? word.text;
  const [state, setState] = useState<RecorderState>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );

  const start = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("denied");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        setState("recorded");
      };
      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
    } catch {
      setState("denied");
    }
  };

  const stop = () => recorderRef.current?.stop();

  return (
    <div className="flex flex-1 flex-col">
      <h2 className="text-lg font-bold">{t("practice.speakingTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("train.speakHint")}</p>

      <div className="card-surface animate-rise mt-4 p-6">
        <p className="text-2xl font-bold" lang={locale}>
          {word.text}
        </p>
        {sentence ? (
          <>
            <p className="mt-3 text-base font-semibold" lang={locale}>
              {sentence.text}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{sentence.translation}</p>
          </>
        ) : null}
        <AudioButtons word={word.text} sentence={sentence?.text ?? null} locale={locale} />
      </div>

      <div className="mt-5 space-y-2.5">
        {state === "recording" ? (
          <Button size="lg" className="w-full rounded-2xl" onClick={stop}>
            <Square className="size-4" /> {t("train.stopRecording")}
          </Button>
        ) : (
          <Button
            size="lg"
            variant={state === "recorded" ? "secondary" : "default"}
            className="w-full rounded-2xl"
            onClick={() => void start()}
          >
            <Mic className="size-4" />{" "}
            {state === "recorded" ? t("train.recordAgain") : t("train.record")}
          </Button>
        )}

        {state === "recording" ? (
          <p className="text-center text-sm font-semibold text-primary">
            {t("practice.speakingListening")}
          </p>
        ) : null}

        {audioUrl ? (
          <div className="card-surface p-4">
            <p className="text-sm font-semibold">{t("train.playback")}</p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio className="mt-2 w-full" controls src={audioUrl} />
          </div>
        ) : null}

        {state === "denied" ? (
          <p className="text-sm font-semibold text-destructive" role="alert">
            {t("train.micDenied")}
          </p>
        ) : null}
      </div>

      <div className="mt-auto space-y-2.5 pt-6">
        <p className="text-center text-xs text-muted-foreground">{t("train.selfCheckNote")}</p>
        <Button
          size="lg"
          className="w-full rounded-2xl"
          onClick={() => onDone(0.9, `self:ok:${target}`)}
        >
          <Check className="size-4" /> {t("practice.speakingSelfOk")}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="w-full rounded-2xl"
          onClick={() => onDone(0.4, `self:practice:${target}`)}
        >
          {t("practice.speakingSelfNo")}
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------- write ---------------------------------- */

function WriteStep({
  unit,
  locale,
  onDone,
}: {
  unit: WordUnit;
  locale: string;
  onDone: (score: number, response: string) => void;
}) {
  const { t } = useI18n();
  const { word, sentence } = unit;
  const { prompt, answer } = sentence
    ? cloze(sentence.text, word.text)
    : { prompt: word.translation ?? word.meaning ?? word.text, answer: word.text };
  const [value, setValue] = useState("");
  const [score, setScore] = useState<number | null>(null);

  const check = () => {
    const clean = value.trim().replace(/\s+/g, " ");
    const exact = normalize(clean) === normalize(answer);
    setScore(exact ? 1 : similarity(normalize(clean), normalize(answer)));
  };

  return (
    <div className="flex flex-1 flex-col">
      <h2 className="text-lg font-bold">{t("practice.writingTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("train.writeHint")}</p>

      <div className="card-surface animate-rise mt-4 p-6">
        <p className="text-lg leading-relaxed font-semibold" lang={locale}>
          {prompt}
        </p>
        {sentence?.translation ? (
          <p className="mt-2 text-sm text-muted-foreground">{sentence.translation}</p>
        ) : null}
      </div>

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

      {score !== null ? (
        <div
          className={cn(
            "mt-4 rounded-2xl px-4 py-3 text-sm font-semibold",
            score >= 0.9
              ? "bg-success-soft text-success"
              : "bg-destructive/10 text-destructive",
          )}
          role="status"
        >
          {score >= 0.9 ? t("practice.correct") : t("practice.wrong")}{" "}
          {score >= 0.9 ? null : <span className="font-bold">{answer}</span>}
        </div>
      ) : null}

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
        <Button
          size="lg"
          className="mt-auto w-full rounded-2xl"
          onClick={() => onDone(score, value)}
        >
          {t("common.next")} <ArrowRight className="size-4 rtl:rotate-180" />
        </Button>
      )}
    </div>
  );
}

/* -------------------------------- meaning --------------------------------- */

function MeaningStep({
  unit,
  units,
  locale,
  onDone,
}: {
  unit: WordUnit;
  units: WordUnit[];
  locale: string;
  onDone: (correct: boolean, response: string) => void;
}) {
  const { t } = useI18n();
  const correct = unit.word.translation ?? unit.word.meaning ?? "";
  const [picked, setPicked] = useState<string | null>(null);

  const options = useMemo(() => {
    const distractors = units
      .filter((other) => other.word.id !== unit.word.id)
      .map((other) => other.word.translation ?? other.word.meaning ?? "")
      .filter((value) => value && value !== correct);
    const unique = [...new Set(distractors)].slice(0, 3);
    const all = [correct, ...unique];
    // Stable shuffle per word so re-renders keep the same order.
    const seed = unit.word.id.charCodeAt(0) + unit.word.id.length;
    return all
      .map((value, i) => ({ value, key: (i * 7 + seed) % all.length }))
      .sort((a, b) => a.key - b.key)
      .map((entry) => entry.value);
  }, [correct, unit.word.id, units]);

  return (
    <div className="flex flex-1 flex-col">
      <h2 className="text-lg font-bold">{t("train.meaningTitle")}</h2>
      <div className="card-surface animate-rise mt-4 p-6 text-center">
        <p className="text-3xl font-bold" lang={locale}>
          {unit.word.text}
        </p>
        <Button
          variant="secondary"
          className="mt-4 w-full rounded-xl"
          onClick={() => speak(unit.word.text, locale)}
        >
          <Volume2 className="size-4" /> {t("train.wordAudio")}
        </Button>
      </div>

      <ul className="mt-4 space-y-2.5">
        {options.map((option) => {
          const isCorrect = option === correct;
          const chosen = picked === option;
          return (
            <li key={option}>
              <button
                type="button"
                disabled={picked !== null}
                onClick={() => setPicked(option)}
                className={cn(
                  "card-surface w-full p-4 text-start text-sm font-semibold transition",
                  picked !== null && isCorrect && "bg-success-soft text-success",
                  chosen && !isCorrect && "bg-destructive/10 text-destructive",
                )}
              >
                {option}
              </button>
            </li>
          );
        })}
      </ul>

      {picked !== null ? (
        <Button
          size="lg"
          className="mt-auto w-full rounded-2xl"
          onClick={() => onDone(picked === correct, picked)}
        >
          {t("common.next")} <ArrowRight className="size-4 rtl:rotate-180" />
        </Button>
      ) : (
        <p className="mt-auto pt-6 text-center text-sm text-muted-foreground">
          {t("train.meaningHint")}
        </p>
      )}
    </div>
  );
}

/* ------------------------------- playback icon ----------------------------- */

export const PlayIcon = Play;
