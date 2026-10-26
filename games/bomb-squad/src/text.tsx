import { themedGameText } from '@huddle/ui/game-kit';

import { bomb, FONT } from './theme';

export const BombText = themedGameText(FONT, { weight: 'regular', color: bomb.cream, leading: 1.25 });
