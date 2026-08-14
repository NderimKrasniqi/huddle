import { PurposeScreen } from '@huddle/ui/native';

export type PickAGameScreenProps = {
  readonly setupDraft: { readonly stage: 'configuring' | 'ready' } | null | undefined;
};

/** Registry browsing/setup state remains authoritative; the visual is one purpose label. */
export function PickAGameScreen({ setupDraft }: PickAGameScreenProps) {
  return (
    <PurposeScreen
      platform="phone"
      purpose={setupDraft === null || setupDraft === undefined ? 'Choose a game' : 'Game setup'}
    />
  );
}
