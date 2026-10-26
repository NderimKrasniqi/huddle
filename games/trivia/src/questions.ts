import { CURATED_PACK } from './content/curated-pack';
import { type Difficulty, type PackQuestion, RESERVED_CATEGORY } from './content/question-pack';

export type TriviaQuestion = {
  readonly text: string;
  readonly options: readonly [string, string, string, string];
  readonly correctIndex: number;
  readonly category?: string;
};

export const EVERY_CATEGORY = RESERVED_CATEGORY;

export const PACK_CATEGORIES: readonly string[] = [
  ...new Set(CURATED_PACK.questions.map((question) => question.category)),
];

function asked(question: PackQuestion): TriviaQuestion {
  return {
    text: question.text,
    options: question.options,
    correctIndex: question.correctIndex,
    category: question.category,
  };
}

function dealtByTurns(questions: readonly PackQuestion[], random?: () => number): readonly PackQuestion[] {
  const queues = new Map<string, PackQuestion[]>();

  for (const question of random ? shuffled(questions, random) : questions) {
    const queue = queues.get(question.category);

    if (queue === undefined) {
      queues.set(question.category, [question]);
    } else {
      queue.push(question);
    }
  }

  const rounds = Math.max(0, ...[...queues.values()].map((queue) => queue.length));
  const dealt: PackQuestion[] = [];

  for (let round = 0; round < rounds; round += 1) {
    for (const queue of queues.values()) {
      const question = queue[round];

      if (question !== undefined) {
        dealt.push(question);
      }
    }
  }

  return dealt;
}

function dealtByDifficulty(
  questions: readonly PackQuestion[],
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed',
  random?: () => number,
): readonly PackQuestion[] {
  if (difficulty === 'mixed') return dealtByTurns(questions, random);

  const order: readonly Difficulty[] =
    difficulty === 'easy'
      ? ['easy', 'medium', 'hard']
      : difficulty === 'medium'
        ? ['medium', 'easy', 'hard']
        : ['hard', 'medium', 'easy'];
  const prioritized = order.flatMap((level) => dealtByTurns(questions.filter((q) => q.difficulty === level), random));
  return prioritized;
}

export function questionsFor(
  category: string,
  count: number,
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed' = 'mixed',
  seed?: number,
): readonly TriviaQuestion[] {
  const random = seed === undefined ? undefined : seededRandom(seed);
  const inCategory =
    category === EVERY_CATEGORY
      ? CURATED_PACK.questions
      : CURATED_PACK.questions.filter((question) => question.category === category);

  const dealt = dealtByDifficulty(inCategory, difficulty, random).slice(0, count).map(asked);
  return random ? dealt.map((question) => withOptionsShuffled(question, random)) : dealt;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function withOptionsShuffled(question: TriviaQuestion, random: () => number): TriviaQuestion {
  const order = shuffled(question.options.map((_option, index) => index), random);
  return {
    ...question,
    options: order.map((index) => question.options[index]!) as unknown as TriviaQuestion['options'],
    correctIndex: order.indexOf(question.correctIndex),
  };
}
