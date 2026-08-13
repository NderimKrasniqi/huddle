import { semanticStyles } from '@huddle/design-tokens';

/** Shared static layout styles for Kit primitives. Platform sizing stays local to each control. */
export const kitStyles = semanticStyles({
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roomCode: {
    flexDirection: 'row',
  },
  wrapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});
