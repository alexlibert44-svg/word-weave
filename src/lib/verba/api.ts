import { supabase } from "@/integrations/supabase/client";

import { generateSetContent } from "./generation.functions";
import { isDue, priority, schedule } from "./srs";
import type {
  DailyProgress,
  Exercise,
  Learner,
  LearningItem,
  Sentence,
  SetSummary,
  Skill,
  Word,
  WordSet,
} from "./types";

/** Skills drilled for a freshly created word, in learning order. */
const CORE_SKILLS: Skill[] = ["recognition", "writing", "speaking", "recall"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ---------------------------------- learner --------------------------------- */

export async function ensureLearner(deviceId: string): Promise<Learner> {
  const { data } = await supabase
    .from("learners")
    .select("*")
    .eq("device_id", deviceId)
    .maybeSingle();
  if (data) return data as Learner;

  const { data: created, error } = await supabase
    .from("learners")
    .insert({ device_id: deviceId })
    .select("*")
    .single();
  if (error) throw error;
  return created as Learner;
}

export async function updateLearner(
  deviceId: string,
  patch: Partial<Omit<Learner, "device_id">>,
): Promise<Learner> {
  const { data, error } = await supabase
    .from("learners")
    .update(patch)
    .eq("device_id", deviceId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Learner;
}

/* ---------------------------------- sets ----------------------------------- */

export async function listSets(deviceId: string): Promise<SetSummary[]> {
  const [{ data: sets, error }, { data: words }, { data: items }] = await Promise.all([
    supabase
      .from("word_sets")
      .select("*")
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false }),
    supabase.from("words").select("id, set_id"),
    supabase
      .from("learning_items")
      .select("set_id, mastery, next_review_at")
      .eq("device_id", deviceId),
  ]);
  if (error) throw error;

  const now = Date.now();
  return (sets ?? []).map((set) => {
    const setWords = (words ?? []).filter((w) => w.set_id === set.id);
    const setItems = (items ?? []).filter((i) => i.set_id === set.id);
    const mastery =
      setItems.length === 0
        ? 0
        : Math.round(setItems.reduce((sum, i) => sum + Number(i.mastery), 0) / setItems.length);
    const dueCount = setItems.filter((i) => new Date(i.next_review_at).getTime() <= now).length;
    return { ...(set as WordSet), wordCount: setWords.length, mastery, dueCount };
  });
}

export async function getSet(setId: string): Promise<{
  set: WordSet;
  words: Word[];
  items: LearningItem[];
}> {
  const [{ data: set, error }, { data: words }, { data: items }] = await Promise.all([
    supabase.from("word_sets").select("*").eq("id", setId).single(),
    supabase.from("words").select("*").eq("set_id", setId).order("position"),
    supabase.from("learning_items").select("*").eq("set_id", setId),
  ]);
  if (error) throw error;
  return {
    set: set as WordSet,
    words: (words ?? []) as Word[],
    items: (items ?? []) as LearningItem[],
  };
}

export interface CreateSetInput {
  deviceId: string;
  name: string;
  words: string[];
  /** Language code of the language being learned. */
  targetLanguage: string;
  /** Language code of the learner's own language. */
  nativeLanguage: string;
  /** English names, used for the AI prompt. */
  targetLanguageName: string;
  nativeLanguageName: string;
}

export async function createSet(input: CreateSetInput): Promise<string> {
  if (input.words.length < 4) throw new Error("A set needs at least 4 words.");
  await ensureLearner(input.deviceId);

  // Generate first: a set is never stored without real lesson content.
  const generated = await generateSetContent({
    data: {
      words: input.words,
      targetLanguage: input.targetLanguageName,
      nativeLanguage: input.nativeLanguageName,
    },
  });

  const { data: set, error } = await supabase
    .from("word_sets")
    .insert({
      device_id: input.deviceId,
      name: input.name,
      target_language: input.targetLanguage,
      native_language: input.nativeLanguage,
    })
    .select("*")
    .single();
  if (error) throw error;

  await storeGenerated(input.deviceId, set.id as string, generated);
  return set.id as string;
}

type Generated = Awaited<ReturnType<typeof generateSetContent>>;

/** Persists AI content as words + sentences + trackable learning items. */
async function storeGenerated(deviceId: string, setId: string, generated: Generated) {
  const { data: words, error: wordError } = await supabase
    .from("words")
    .insert(
      generated.map((g, index) => ({
        set_id: setId,
        text: g.target_word,
        translation: g.translation,
        meaning: g.translation,
        pronunciation: g.pronunciation || null,
        part_of_speech: g.part_of_speech || null,
        position: index,
      })),
    )
    .select("*");
  if (wordError) throw wordError;

  const sentenceRows = (words ?? []).flatMap((word) => {
    const content = generated.find((g) => g.target_word === word.text);
    return (content?.sentences ?? []).map((s) => ({
      word_id: word.id,
      text: s.text,
      translation: s.translation,
      form: s.form,
      variation_index: s.variation_index,
      is_ai_generated: true,
    }));
  });

  const { data: sentences, error: sentenceError } = await supabase
    .from("sentences")
    .insert(sentenceRows)
    .select("*");
  if (sentenceError) throw sentenceError;

  const itemRows = (words ?? []).flatMap((word) => {
    const wordSentences = (sentences ?? []).filter((s) => s.word_id === word.id);
    const base = wordSentences.find((s) => s.form === "base" && s.variation_index === 0);
    const core = CORE_SKILLS.map((skill) => ({
      device_id: deviceId,
      set_id: setId,
      word_id: word.id,
      sentence_id: base?.id ?? null,
      skill,
      form: "base",
      next_review_at: new Date().toISOString(),
    }));

    // Context variations and grammatical forms are introduced gradually.
    const extras = wordSentences
      .filter((s) => !(s.form === "base" && s.variation_index === 0))
      .map((s, index) => ({
        device_id: deviceId,
        set_id: setId,
        word_id: word.id,
        sentence_id: s.id,
        skill: (s.form === "base" ? "sentence_usage" : "form") as Skill,
        form: s.form,
        next_review_at: new Date(Date.now() + (index + 2) * 86400000).toISOString(),
      }));

    return [...core, ...extras];
  });

  const { error: itemError } = await supabase.from("learning_items").insert(itemRows);
  if (itemError) throw itemError;
}

export async function renameSet(setId: string, name: string) {
  const { error } = await supabase.from("word_sets").update({ name }).eq("id", setId);
  if (error) throw error;
}

export async function deleteSet(setId: string) {
  const { error } = await supabase.from("word_sets").delete().eq("id", setId);
  if (error) throw error;
}

/* ---------------------------------- words ---------------------------------- */

export async function getWord(wordId: string): Promise<{
  word: Word;
  sentences: Sentence[];
  items: LearningItem[];
  set: WordSet;
}> {
  const { data: word, error } = await supabase
    .from("words")
    .select("*")
    .eq("id", wordId)
    .single();
  if (error) throw error;

  const [{ data: sentences }, { data: items }, { data: set }] = await Promise.all([
    supabase.from("sentences").select("*").eq("word_id", wordId).order("variation_index"),
    supabase.from("learning_items").select("*").eq("word_id", wordId),
    supabase.from("word_sets").select("*").eq("id", word.set_id).single(),
  ]);

  return {
    word: word as Word,
    sentences: (sentences ?? []) as Sentence[],
    items: (items ?? []) as LearningItem[],
    set: set as WordSet,
  };
}

/* -------------------------------- sessions --------------------------------- */

/**
 * Builds a session queue from real stored performance.
 * `setId` omitted => global review queue (weakest & most overdue first).
 */
export async function buildQueue(
  deviceId: string,
  setId: string | null,
  limit = 10,
): Promise<Exercise[]> {
  let query = supabase.from("learning_items").select("*").eq("device_id", deviceId);
  if (setId) query = query.eq("set_id", setId);
  const { data: rawItems, error } = await query;
  if (error) throw error;

  const items = (rawItems ?? []) as LearningItem[];
  if (items.length === 0) return [];

  const due = items.filter((i) => isDue(i));
  const pool = (due.length > 0 ? due : setId ? items : []).slice();
  pool.sort((a, b) => priority(b) - priority(a));
  const selected = pool.slice(0, limit);
  if (selected.length === 0) return [];

  const wordIds = [...new Set(selected.map((i) => i.word_id))];
  const [{ data: words }, { data: sentences }] = await Promise.all([
    supabase.from("words").select("*").in("id", wordIds),
    supabase.from("sentences").select("*").in("word_id", wordIds),
  ]);

  const exercises: Exercise[] = [];
  for (const item of selected) {
    const word = (words ?? []).find((w) => w.id === item.word_id) as Word | undefined;
    if (!word) continue;
    const wordSentences = ((sentences ?? []) as Sentence[]).filter(
      (s) => s.word_id === item.word_id,
    );
    // Rotate sentence variations so learners don't memorise a single sentence.
    const formSentences = wordSentences.filter((s) => s.form === item.form);
    const pickFrom = formSentences.length > 0 ? formSentences : wordSentences;
    const sentence =
      item.sentence_id && (item.skill === "form" || item.skill === "sentence_usage")
        ? (wordSentences.find((s) => s.id === item.sentence_id) ?? null)
        : (pickFrom[item.attempts % Math.max(pickFrom.length, 1)] ?? null);
    exercises.push({ item, word, sentence, skill: item.skill });
  }

  // Introduce a word before drilling it.
  const order: Record<Skill, number> = {
    recognition: 0,
    listening: 1,
    reading: 2,
    writing: 3,
    speaking: 4,
    recall: 5,
    sentence_usage: 6,
    form: 7,
  };
  exercises.sort((a, b) => order[a.skill] - order[b.skill]);
  return exercises;
}

export interface DueBreakdown {
  total: number;
  bySkill: Partial<Record<Skill, number>>;
  /** When the next item becomes due, if nothing is due right now. */
  nextReviewAt: string | null;
}

export async function getDueBreakdown(deviceId: string): Promise<DueBreakdown> {
  const now = new Date().toISOString();
  const [{ data, error }, { data: upcoming }] = await Promise.all([
    supabase
      .from("learning_items")
      .select("skill, next_review_at")
      .eq("device_id", deviceId)
      .lte("next_review_at", now),
    supabase
      .from("learning_items")
      .select("next_review_at")
      .eq("device_id", deviceId)
      .gt("next_review_at", now)
      .order("next_review_at", { ascending: true })
      .limit(1),
  ]);
  if (error) throw error;

  const bySkill: Partial<Record<Skill, number>> = {};
  for (const row of data ?? []) {
    const skill = row.skill as Skill;
    bySkill[skill] = (bySkill[skill] ?? 0) + 1;
  }
  return {
    total: (data ?? []).length,
    bySkill,
    nextReviewAt: upcoming?.[0]?.next_review_at ?? null,
  };
}

/** Persists one real attempt and re-schedules the item. */
export async function recordAttempt(
  deviceId: string,
  item: LearningItem,
  score: number,
  response: string | null,
): Promise<LearningItem> {
  const update = schedule(item, score);
  const [{ data, error }] = await Promise.all([
    supabase.from("learning_items").update(update).eq("id", item.id).select("*").single(),
    supabase.from("practice_attempts").insert({
      device_id: deviceId,
      learning_item_id: item.id,
      skill: item.skill,
      is_correct: score >= 0.6,
      score,
      response,
    }),
  ]);
  if (error) throw error;
  await supabase
    .from("word_sets")
    .update({ last_practiced_at: new Date().toISOString() })
    .eq("id", item.set_id);
  return data as LearningItem;
}

/* -------------------------------- progress --------------------------------- */

export async function getDailyProgress(deviceId: string): Promise<DailyProgress> {
  const { data } = await supabase
    .from("daily_progress")
    .select("*")
    .eq("device_id", deviceId)
    .eq("day", today())
    .maybeSingle();
  if (data) return data as DailyProgress;

  const learner = await ensureLearner(deviceId);
  const { data: created, error } = await supabase
    .from("daily_progress")
    .insert({ device_id: deviceId, day: today(), goal_minutes: learner.daily_goal_minutes })
    .select("*")
    .single();
  if (error) throw error;
  return created as DailyProgress;
}

/** Called when a session finishes: real minutes, real item count, real streak. */
export async function logSession(deviceId: string, minutes: number, itemsCompleted: number) {
  const progress = await getDailyProgress(deviceId);
  await supabase
    .from("daily_progress")
    .update({
      minutes_practiced: Number(progress.minutes_practiced) + minutes,
      items_completed: progress.items_completed + itemsCompleted,
    })
    .eq("id", progress.id);

  const learner = await ensureLearner(deviceId);
  const { data: history } = await supabase
    .from("daily_progress")
    .select("day, minutes_practiced")
    .eq("device_id", deviceId)
    .order("day", { ascending: false })
    .limit(60);

  const streak = computeStreak((history ?? []) as { day: string; minutes_practiced: number }[]);
  await updateLearner(deviceId, {
    streak,
    longest_streak: Math.max(learner.longest_streak, streak),
  });
}

function computeStreak(days: { day: string; minutes_practiced: number }[]): number {
  const active = new Set(days.filter((d) => Number(d.minutes_practiced) > 0).map((d) => d.day));
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!active.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface ProfileStats {
  totalWords: number;
  masteredWords: number;
  overallMastery: number;
}

export async function getProfileStats(deviceId: string): Promise<ProfileStats> {
  const { data: items } = await supabase
    .from("learning_items")
    .select("word_id, mastery")
    .eq("device_id", deviceId);

  const rows = (items ?? []) as { word_id: string; mastery: number }[];
  const byWord = new Map<string, number[]>();
  for (const row of rows) {
    byWord.set(row.word_id, [...(byWord.get(row.word_id) ?? []), Number(row.mastery)]);
  }
  const wordAverages = [...byWord.values()].map(
    (values) => values.reduce((a, b) => a + b, 0) / values.length,
  );

  return {
    totalWords: wordAverages.length,
    masteredWords: wordAverages.filter((m) => m >= 85).length,
    overallMastery:
      wordAverages.length === 0
        ? 0
        : Math.round(wordAverages.reduce((a, b) => a + b, 0) / wordAverages.length),
  };
}
