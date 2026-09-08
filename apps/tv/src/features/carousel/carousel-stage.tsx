import { StatusSurface } from '@huddle/ui/native';

export function CarouselStage(_props: Record<string, unknown>) {
  return (
    <StatusSurface
      platform="tv"
      variant="info"
      title="Choose a game"
      message="Use the Host phone to browse the Huddle game shelf."
      testID="tv-carousel-status"
    />
  );
}
