import { PurposeScreen } from '@huddle/ui/native';

/** The room coordinator remains in TvSessionController; this seam renders its purpose only. */
export function RoomStage(_props: Record<string, unknown>) {
  return <PurposeScreen platform="tv" purpose="Room invitation" />;
}
