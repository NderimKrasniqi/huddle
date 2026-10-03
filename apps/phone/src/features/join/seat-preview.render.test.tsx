import { act, render } from '@testing-library/react-native';

import { useSeatPreview } from './seat-preview';

const mockPreviewSeat = jest.fn(() => Promise.resolve(null));
const mockClearSeatPreview = jest.fn(() => Promise.resolve(null));
let mockMutationIndex = 0;

jest.mock('convex/react', () => ({
  useMutation: () => (mockMutationIndex++ % 2 === 0 ? mockPreviewSeat : mockClearSeatPreview),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'preview-key' }));

function Form(props: { nickname: string; active: boolean }) {
  useSeatPreview({ code: 'KWRD', avatarId: 'fox', ...props });
  return null;
}

describe('useSeatPreview', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockMutationIndex = 0;
    mockPreviewSeat.mockClear();
    mockClearSeatPreview.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('sends once typing settles, refreshes while open, and clears on leaving', async () => {
    const view = await render(<Form nickname="A" active />);
    await view.rerender(<Form nickname="Ada" active />);
    await act(async () => jest.advanceTimersByTime(300));

    expect(mockPreviewSeat).toHaveBeenCalledTimes(1);
    expect(mockPreviewSeat).toHaveBeenLastCalledWith({ code: 'KWRD', previewKey: 'preview-key', nickname: 'Ada', avatar: 'fox' });

    await act(async () => jest.advanceTimersByTime(10_000));
    expect(mockPreviewSeat).toHaveBeenCalledTimes(2);

    await view.unmount();
    expect(mockClearSeatPreview).toHaveBeenCalledWith({ previewKey: 'preview-key' });
  });

  it('sends nothing while inactive', async () => {
    await render(<Form nickname="Ada" active={false} />);
    await act(async () => jest.advanceTimersByTime(20_000));

    expect(mockPreviewSeat).not.toHaveBeenCalled();
    expect(mockClearSeatPreview).not.toHaveBeenCalled();
  });
});
