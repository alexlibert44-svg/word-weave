/**
 * Content generation layer.
 *
 * Today this produces sentences locally from linguistic templates so the MVP
 * is fully functional offline. It is the ONLY module that creates learning
 * content, so swapping in an AI generator later means replacing
 * `generateWordContent` with a server-function call that returns the same
 * shape — no other file changes.
 */

export interface GeneratedSentence {
  text: string;
  translation: string;
  form: string;
  variation_index: number;
}

export interface GeneratedWord {
  meaning: string;
  pronunciation: string;
  part_of_speech: string;
  sentences: GeneratedSentence[];
  /** Forms worth drilling later. Empty when the word has no useful variation. */
  forms: string[];
}

const VERB_HINTS = [
  "improve",
  "achieve",
  "practice",
  "go",
  "learn",
  "speak",
  "write",
  "read",
  "travel",
  "book",
  "order",
  "arrive",
  "explain",
  "decide",
  "plan",
  "build",
  "grow",
  "focus",
  "listen",
  "repeat",
];

const NOUN_SUFFIX = /(tion|ment|ness|ity|ship|ure|ance|ence|ism|dom)$/;
const ADJ_SUFFIX = /(ous|ful|ive|able|ible|ent|ant|al|ic|less)$/;

function classify(word: string): "verb" | "noun" | "adjective" {
  const w = word.toLowerCase();
  if (VERB_HINTS.includes(w)) return "verb";
  if (NOUN_SUFFIX.test(w)) return "noun";
  if (ADJ_SUFFIX.test(w)) return "adjective";
  if (w.endsWith("ing") || w.endsWith("ate") || w.endsWith("ify")) return "verb";
  return "noun";
}

function pastForm(word: string): string {
  const w = word.toLowerCase();
  const irregular: Record<string, string> = {
    go: "went",
    speak: "spoke",
    write: "wrote",
    read: "read",
    build: "built",
    grow: "grew",
    think: "thought",
    take: "took",
    make: "made",
  };
  if (irregular[w]) return irregular[w] as string;
  if (w.endsWith("e")) return `${w}d`;
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ied`;
  return `${w}ed`;
}

function ingForm(word: string): string {
  const w = word.toLowerCase();
  if (w.endsWith("e") && !w.endsWith("ee")) return `${w.slice(0, -1)}ing`;
  return `${w}ing`;
}

/** Placeholder phonetic hint until real pronunciation data is connected. */
function pronounce(word: string): string {
  return `/${word.toLowerCase().replace(/([aeiou])/g, "$1")}/`;
}

export function generateWordContent(raw: string): GeneratedWord {
  const word = raw.trim();
  const kind = classify(word);
  const lower = word.toLowerCase();

  if (kind === "verb") {
    return {
      meaning: `to ${lower}`,
      pronunciation: pronounce(word),
      part_of_speech: "verb",
      forms: ["base", "past", "future", "progressive"],
      sentences: [
        {
          text: `I want to ${lower} my English.`,
          translation: `I would like to ${lower} my English.`,
          form: "base",
          variation_index: 0,
        },
        {
          text: `She wants to ${lower} a little every day.`,
          translation: `She tries to ${lower} daily.`,
          form: "base",
          variation_index: 1,
        },
        {
          text: `Practice can help you ${lower} quickly.`,
          translation: `Practice makes you ${lower} faster.`,
          form: "base",
          variation_index: 2,
        },
        {
          text: `I ${pastForm(lower)} a lot yesterday.`,
          translation: `Yesterday I did this a lot.`,
          form: "past",
          variation_index: 0,
        },
        {
          text: `I will ${lower} again tomorrow.`,
          translation: `Tomorrow I plan to do this again.`,
          form: "future",
          variation_index: 0,
        },
        {
          text: `I am ${ingForm(lower)} right now.`,
          translation: `I am doing this at the moment.`,
          form: "progressive",
          variation_index: 0,
        },
      ],
    };
  }

  if (kind === "adjective") {
    return {
      meaning: `having the quality of being ${lower}`,
      pronunciation: pronounce(word),
      part_of_speech: "adjective",
      forms: ["base", "comparative"],
      sentences: [
        {
          text: `I try to be ${lower} every day.`,
          translation: `I aim to be ${lower} daily.`,
          form: "base",
          variation_index: 0,
        },
        {
          text: `Her work is very ${lower}.`,
          translation: `Her work shows this quality.`,
          form: "base",
          variation_index: 1,
        },
        {
          text: `Small habits make you more ${lower}.`,
          translation: `Habits increase this quality.`,
          form: "comparative",
          variation_index: 0,
        },
      ],
    };
  }

  return {
    meaning: `the idea of ${lower}`,
    pronunciation: pronounce(word),
    part_of_speech: "noun",
    forms: ["base"],
    sentences: [
      {
        text: `${capitalize(lower)} is important for me.`,
        translation: `This matters to me.`,
        form: "base",
        variation_index: 0,
      },
      {
        text: `I need more ${lower} in my daily routine.`,
        translation: `My routine needs more of this.`,
        form: "base",
        variation_index: 1,
      },
      {
        text: `We talked about ${lower} in class today.`,
        translation: `This was our class topic.`,
        form: "base",
        variation_index: 2,
      },
    ],
  };
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
