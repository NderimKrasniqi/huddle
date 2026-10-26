import huddleClassics from '../packs/huddle-classics.json';

import { type QuestionPack, questionPackSchema } from './question-pack';

export const CURATED_PACK: QuestionPack = questionPackSchema.parse(huddleClassics);
