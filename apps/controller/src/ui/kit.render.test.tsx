import { render, screen, userEvent } from '@testing-library/react-native';
import { View } from 'react-native';

import { PageDots, PrimaryButton, RoomCode, SegmentedControl } from '@huddle/ui/kit';

describe('Huddle Kit accessibility contracts', () => {
  it('exposes named action state and forwards interaction', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();

    await render(<PrimaryButton label="Join room" onPress={onPress} busy />);

    const button = await screen.findByRole('button', { name: 'Join room' });
    expect(button.props.accessibilityState).toMatchObject({ busy: true });
    await user.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes selected choice and room code as readable labels', async () => {
    const onChange = jest.fn();

    await render(
      <View>
        <SegmentedControl options={['Quick', 'Custom'] as const} value="Quick" onChange={onChange} />
        <RoomCode code="ABCD" />
      </View>,
    );

    const quick = await screen.findByRole('button', { name: 'Quick' });
    expect(quick.props.accessibilityState).toMatchObject({ selected: true });
    expect(await screen.findByLabelText('Room code A B C D')).toBeTruthy();
  });

  it('announces carousel position through a progressbar', async () => {
    await render(<PageDots count={4} activeIndex={1} />);

    const progress = await screen.findByLabelText('Page 2 of 4');
    expect(progress.props.accessibilityValue).toMatchObject({ min: 1, max: 4, now: 2 });
  });
});
