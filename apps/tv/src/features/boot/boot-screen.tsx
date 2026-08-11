import { AnimatedScreen, HuddleLoadingSurface } from '@huddle/ui/native';

import { TvStage } from '../../ui';
import { tvBootPresentation, type TvBootPhase } from './boot-state';

/** The TV before it has a safe room code to show. */
export function TvBootScreen({ phase }: { readonly phase: TvBootPhase }) {
  const presentation = tvBootPresentation(phase);

  return (
    <AnimatedScreen key={phase}>
      <TvStage>
        <HuddleLoadingSurface platform="tv" {...presentation} />
      </TvStage>
    </AnimatedScreen>
  );
}
