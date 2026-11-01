import { playroomTv } from '@huddle/design-tokens';
import { useWindowDimensions } from 'react-native';

export function useStageScale(): number {
  const { width, height } = useWindowDimensions();
  const scale = Math.min(width / playroomTv.width, height / playroomTv.height);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}
